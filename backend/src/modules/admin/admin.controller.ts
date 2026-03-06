import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthService } from "../auth/auth.service";
import type { Request } from "express";
import { getAuthToken } from "../../common/auth-cookie";

class UpdateAnalyticsDto {
  gtm_id?: string;
}

class NewsletterTestDto {
  test_email?: string;
  subject?: string;
  content?: string;
}

class NewsletterCampaignDto {
  audience?: string;
  subject?: string;
  content?: string;
}

@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  private async requireAdmin(req: Request) {
    const token = getAuthToken(req);
    if (!token) {
      throw new UnauthorizedException("Не авторизован");
    }

    const user = await this.authService.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }

    try {
      await this.adminService.ensureAdmin(user.id);
    } catch {
      throw new UnauthorizedException("Доступ запрещен");
    }

    return user;
  }

  @Get("dashboard")
  async dashboard(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getDashboard();
  }

  @Get("users")
  async users(@Req() req: Request, @Query("page") page = "1") {
    await this.requireAdmin(req);
    const pageNumber = Number(page || 1);
    return this.adminService.getUsers(pageNumber, 20);
  }

  @Delete("users/:id")
  async deleteUser(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    await this.requireAdmin(req);
    try {
      await this.adminService.deleteUser(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить пользователя";
      throw new BadRequestException(message);
    }
  }

  @Get("memorials")
  async memorials(
    @Req() req: Request,
    @Query("status") status = "all",
    @Query("page") page = "1",
  ) {
    await this.requireAdmin(req);
    const pageNumber = Number(page || 1);
    return this.adminService.getMemorials(status, pageNumber, 20);
  }

  @Delete("memorials/:id")
  async deleteMemorial(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    await this.requireAdmin(req);
    try {
      await this.adminService.deleteMemorial(id);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить мемориал";
      throw new BadRequestException(message);
    }
  }

  @Get("analytics")
  async analytics(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getAnalytics();
  }

  @Post("analytics")
  async updateAnalytics(@Req() req: Request, @Body() body: UpdateAnalyticsDto) {
    await this.requireAdmin(req);
    const gtmId = String(body.gtm_id || "").trim();
    if (gtmId && !/^GTM-[A-Z0-9]+$/i.test(gtmId)) {
      throw new BadRequestException("Некорректный формат GTM ID");
    }
    return this.adminService.updateAnalytics(gtmId);
  }

  @Get("settings")
  async settings(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getSettings();
  }

  @Post("settings")
  async updateSettings(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.requireAdmin(req);
    return this.adminService.updateSettings(body);
  }

  @Get("newsletter")
  async newsletter(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getNewsletterMeta();
  }

  private ensureNonEmptyString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== "string") {
      throw new BadRequestException(`Поле ${field} обязательно`);
    }
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`Поле ${field} обязательно`);
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(`Поле ${field} превышает лимит ${maxLength} символов`);
    }
    return normalized;
  }

  private ensureEmail(value: unknown): string {
    const email = this.ensureNonEmptyString(value, "test_email", 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Некорректный email");
    }
    return email;
  }

  @Post("newsletter/test")
  async newsletterTest(@Req() req: Request, @Body() body: NewsletterTestDto) {
    await this.requireAdmin(req);
    const email = this.ensureEmail(body.test_email);
    const subject = this.ensureNonEmptyString(body.subject, "subject", 150);
    const content = this.ensureNonEmptyString(body.content, "content", 5000);

    const sent = await this.adminService.sendNewsletterTest(email, subject, content);
    if (!sent) {
      return {
        success: false,
        message: "Не удалось отправить тестовое письмо. Проверьте настройки почты.",
      };
    }

    return {
      success: true,
      message: `Тестовое письмо отправлено на ${email}`,
    };
  }

  @Post("newsletter/send")
  async newsletterSend(@Req() req: Request, @Body() body: NewsletterCampaignDto) {
    await this.requireAdmin(req);
    const audience = this.ensureNonEmptyString(body.audience, "audience", 120);
    if (audience !== "all_users" && audience !== "published_memorial_owners") {
      throw new BadRequestException("Некорректная аудитория");
    }

    const subject = this.ensureNonEmptyString(body.subject, "subject", 150);
    const content = this.ensureNonEmptyString(body.content, "content", 5000);
    const sentCount = await this.adminService.sendNewsletterCampaign(audience, subject, content);

    return {
      success: true,
      sent_count: sentCount,
      message: `Рассылка отправлена. Успешно доставлено: ${sentCount}`,
    };
  }
}
