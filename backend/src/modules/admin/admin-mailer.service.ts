import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface MailStatusDto {
  mailer: string;
  host: string;
  port: string;
  encryption: string;
  from_address: string;
  from_name: string;
  is_configured: boolean;
}

function normalizeEnv(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "null") {
    return "";
  }
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

@Injectable()
export class AdminMailerService {
  private readonly logger = new Logger(AdminMailerService.name);
  private transporter: Transporter | null = null;
  private transporterKey = "";

  getMailStatus(): MailStatusDto {
    const mailer = normalizeEnv(process.env.MAIL_MAILER) || "smtp";
    const host = normalizeEnv(process.env.MAIL_HOST) || "n/a";
    const port = normalizeEnv(process.env.MAIL_PORT) || "n/a";
    const encryption = normalizeEnv(process.env.MAIL_ENCRYPTION) || "none";
    const fromAddress = normalizeEnv(process.env.MAIL_FROM_ADDRESS);
    const fromName = normalizeEnv(process.env.MAIL_FROM_NAME);

    return {
      mailer,
      host,
      port,
      encryption,
      from_address: fromAddress || "не задан",
      from_name: fromName || "не задан",
      is_configured: fromAddress.length > 0,
    };
  }

  private getTransporter(): Transporter | null {
    const mailer = normalizeEnv(process.env.MAIL_MAILER).toLowerCase() || "smtp";
    const host = normalizeEnv(process.env.MAIL_HOST);
    const port = Number(normalizeEnv(process.env.MAIL_PORT) || "587");
    const encryption = normalizeEnv(process.env.MAIL_ENCRYPTION).toLowerCase();
    const username = normalizeEnv(process.env.MAIL_USERNAME);
    const password = normalizeEnv(process.env.MAIL_PASSWORD);

    const key = JSON.stringify({
      mailer,
      host,
      port,
      encryption,
      username,
      password,
    });

    if (this.transporter && this.transporterKey === key) {
      return this.transporter;
    }

    if (mailer === "log") {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.transporterKey = key;
      return this.transporter;
    }

    if (!host || !Number.isFinite(port) || port <= 0) {
      return null;
    }

    const secure = encryption === "ssl" || encryption === "smtps";
    const ignoreTLS = encryption === "none";
    const auth = username ? { user: username, pass: password } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ignoreTLS,
      auth,
    });
    this.transporterKey = key;
    return this.transporter;
  }

  private renderNewsletterHtml(subject: string, content: string, isTest: boolean): string {
    const appUrl = normalizeEnv(process.env.APP_URL).replace(/\/$/, "");
    const projectIconUrl = normalizeEnv(process.env.PROJECT_ICON_URL);
    const iconUrl = projectIconUrl || (appUrl ? `${appUrl}/brand/memory-icon.png` : "");
    let hostLabel = "memory";
    if (appUrl) {
      try {
        hostLabel = new URL(appUrl).host;
      } catch {
        hostLabel = appUrl;
      }
    }
    const escapedSubject = escapeHtml(subject);
    const escapedContent = escapeHtml(content).replace(/\n/g, "<br>");

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapedSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#1f2937;padding:16px 24px;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  ${
                    iconUrl
                      ? `<td style="padding-right:10px;vertical-align:middle;"><img src="${escapeHtml(iconUrl)}" alt="Memory" width="28" height="28" style="display:block;border:0;border-radius:6px;"></td>`
                      : ""
                  }
                  <td style="vertical-align:middle;font-size:20px;font-weight:700;line-height:1.2;">
                    Memory ${isTest ? "• Тестовое письмо" : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 16px;font-size:22px;">${escapedSubject}</h1>
              <div style="line-height:1.7;white-space:normal;">${escapedContent}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px;color:#9ca3af;font-size:12px;">${escapeHtml(hostLabel)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  async sendNewsletterEmail(
    email: string,
    subject: string,
    content: string,
    isTest: boolean,
  ): Promise<boolean> {
    const to = normalizeEnv(email);
    if (!to) {
      return false;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.error("Mailer не настроен: проверьте MAIL_HOST/MAIL_PORT и MAIL_MAILER");
      return false;
    }

    const fromAddress = normalizeEnv(process.env.MAIL_FROM_ADDRESS);
    const fromName = normalizeEnv(process.env.MAIL_FROM_NAME) || "Memory";
    const from = fromAddress ? `"${fromName}" <${fromAddress}>` : fromName;

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: content,
        html: this.renderNewsletterHtml(subject, content, isTest),
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ошибка отправки email (${to}): ${message}`);
      return false;
    }
  }
}
