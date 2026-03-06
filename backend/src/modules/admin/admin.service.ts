import { Injectable } from "@nestjs/common";
import { DbService } from "../../common/db.service";
import { AdminMailerService } from "./admin-mailer.service";

const SETTINGS_DEFAULTS = {
  general: {
    site_name: "Страницы памяти",
    site_tagline: "Платформа страниц памяти",
    support_email: "",
    contact_phone: "",
    default_locale: "ru",
    default_timezone: "Europe/Samara",
  },
  branding: {
    icon_path: "",
  },
  access: {
    allow_registration: true,
    enable_memorial_creation: true,
    enable_memories: true,
    enable_comments: true,
    enable_public_profiles: true,
  },
  moderation: {
    auto_publish_memorials: false,
    moderate_memories: false,
    moderate_comments: false,
  },
  notifications: {
    admin_notification_email: "",
    notify_new_user: true,
    notify_new_memorial: true,
    notify_new_comment: false,
  },
  maintenance: {
    maintenance_mode: false,
    maintenance_message: "Сервис временно недоступен. Скоро вернемся.",
  },
  analytics: {
    gtm_id: "",
  },
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: JsonRecord, patch: JsonRecord): JsonRecord {
  const result: JsonRecord = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = result[key];
    if (isRecord(baseValue) && isRecord(value)) {
      result[key] = deepMerge(baseValue, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DbService,
    private readonly adminMailerService: AdminMailerService,
  ) {}

  async ensureAdmin(userId: number): Promise<void> {
    const sql = `
      SELECT id
      FROM users
      WHERE id = $1
        AND LOWER(COALESCE(role, '')) IN ('admin', 'superadmin', 'super_admin')
      LIMIT 1
    `;
    const result = await this.db.client.query(sql, [userId]);
    if (result.rows.length === 0) {
      throw new Error("Доступ запрещен");
    }
  }

  async getDashboard() {
    const statsSql = `
      SELECT
        (SELECT COUNT(*)::bigint FROM users) AS users,
        (SELECT COUNT(*)::bigint FROM memorials) AS memorials,
        (SELECT COUNT(*)::bigint FROM memories) AS memories
    `;
    const statsResult = await this.db.client.query(statsSql);
    const statsRow = statsResult.rows[0] ?? { users: 0, memorials: 0, memories: 0 };

    const recentUsersSql = `
      SELECT id, name, email, created_at::text
      FROM users
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `;
    const recentUsers = await this.db.client.query(recentUsersSql);

    const recentMemorialsSql = `
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.created_at::text,
        u.id AS user_id,
        u.name AS user_name
      FROM memorials m
      LEFT JOIN users u ON u.id = m.user_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 5
    `;
    const recentMemorials = await this.db.client.query(recentMemorialsSql);

    return {
      stats: {
        users: Number(statsRow.users ?? 0),
        memorials: Number(statsRow.memorials ?? 0),
        memories: Number(statsRow.memories ?? 0),
      },
      recent_users: recentUsers.rows,
      recent_memorials: recentMemorials.rows,
    };
  }

  async getUsers(page: number, perPage = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const offset = (safePage - 1) * perPage;

    const countSql = `SELECT COUNT(*)::bigint AS total FROM users`;
    const countResult = await this.db.client.query(countSql);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const usersSql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_memorial,
        u.created_at::text,
        COUNT(m.id)::bigint AS memorials_count
      FROM users u
      LEFT JOIN memorials m ON m.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $1 OFFSET $2
    `;
    const usersResult = await this.db.client.query(usersSql, [perPage, offset]);

    return {
      data: usersResult.rows,
      pagination: {
        page: safePage,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async deleteUser(id: number) {
    const findSql = `SELECT id, role FROM users WHERE id = $1 LIMIT 1`;
    const found = await this.db.client.query(findSql, [id]);
    const row = found.rows[0] as { id: number; role: string } | undefined;
    if (!row) {
      throw new Error("Пользователь не найден");
    }
    if (["admin", "superadmin", "super_admin"].includes(String(row.role || "").toLowerCase())) {
      throw new Error("Нельзя удалить администратора");
    }

    const deleteSql = `DELETE FROM users WHERE id = $1`;
    await this.db.client.query(deleteSql, [id]);
  }

  async getMemorials(status: string, page: number, perPage = 20) {
    const safeStatus = status === "published" || status === "draft" ? status : "all";
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const offset = (safePage - 1) * perPage;

    const countSql =
      safeStatus === "all"
        ? `SELECT COUNT(*)::bigint AS total FROM memorials`
        : `SELECT COUNT(*)::bigint AS total FROM memorials WHERE status = $1`;
    const countResult =
      safeStatus === "all"
        ? await this.db.client.query(countSql)
        : await this.db.client.query(countSql, [safeStatus]);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const memorialsSql = `
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.status,
        m.user_id,
        m.created_at::text,
        u.name AS user_name
      FROM memorials m
      LEFT JOIN users u ON u.id = m.user_id
      ${safeStatus === "all" ? "" : "WHERE m.status = $1"}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $${safeStatus === "all" ? 1 : 2} OFFSET $${safeStatus === "all" ? 2 : 3}
    `;

    const memorialsResult =
      safeStatus === "all"
        ? await this.db.client.query(memorialsSql, [perPage, offset])
        : await this.db.client.query(memorialsSql, [safeStatus, perPage, offset]);

    return {
      data: memorialsResult.rows,
      pagination: {
        page: safePage,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async deleteMemorial(id: number) {
    const sql = `DELETE FROM memorials WHERE id = $1`;
    const result = await this.db.client.query(sql, [id]);
    if ((result.rowCount ?? 0) === 0) {
      throw new Error("Мемориал не найден");
    }
  }

  private async getStoredSettings(): Promise<JsonRecord> {
    const sql = `SELECT data FROM app_settings WHERE id = 1 LIMIT 1`;
    const result = await this.db.client.query(sql);
    const row = result.rows[0] as { data?: unknown } | undefined;
    const stored = isRecord(row?.data) ? row.data : {};
    return deepMerge(SETTINGS_DEFAULTS as JsonRecord, stored);
  }

  async getSettings() {
    return this.getStoredSettings();
  }

  async updateSettings(patch: JsonRecord) {
    const current = await this.getStoredSettings();
    const next = deepMerge(current, patch);

    const upsertSql = `
      INSERT INTO app_settings (id, data, created_at, updated_at)
      VALUES (1, $1::jsonb, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      RETURNING data
    `;
    const result = await this.db.client.query(upsertSql, [JSON.stringify(next)]);
    const row = result.rows[0] as { data?: unknown } | undefined;
    return isRecord(row?.data) ? row.data : next;
  }

  async getAnalytics() {
    const settings = await this.getStoredSettings();
    const analytics = isRecord(settings.analytics) ? settings.analytics : {};
    return {
      gtm_id: typeof analytics.gtm_id === "string" ? analytics.gtm_id : "",
    };
  }

  async updateAnalytics(gtmId: string) {
    const settings = await this.getStoredSettings();
    const next = deepMerge(settings, {
      analytics: {
        gtm_id: gtmId,
      },
    });

    const upsertSql = `
      INSERT INTO app_settings (id, data, created_at, updated_at)
      VALUES (1, $1::jsonb, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    await this.db.client.query(upsertSql, [JSON.stringify(next)]);

    return { gtm_id: gtmId };
  }

  async getNewsletterMeta() {
    const allUsersSql = `
      SELECT COUNT(*)::bigint AS total
      FROM users
      WHERE email IS NOT NULL
        AND BTRIM(email) <> ''
    `;
    const allUsersResult = await this.db.client.query(allUsersSql);
    const allUsersCount = Number(allUsersResult.rows[0]?.total ?? 0);

    const ownersSql = `
      SELECT COUNT(DISTINCT u.id)::bigint AS total
      FROM users u
      WHERE u.email IS NOT NULL
        AND BTRIM(u.email) <> ''
        AND EXISTS (
          SELECT 1
          FROM memorials m
          WHERE m.user_id = u.id
            AND m.status = 'published'
        )
    `;
    const ownersResult = await this.db.client.query(ownersSql);
    const ownersCount = Number(ownersResult.rows[0]?.total ?? 0);

    return {
      mailStatus: this.adminMailerService.getMailStatus(),
      audiences: [
        { key: "all_users", label: "Все пользователи", count: allUsersCount },
        {
          key: "published_memorial_owners",
          label: "Владельцы опубликованных мемориалов",
          count: ownersCount,
        },
      ],
      systemTemplates: {
        welcome: "Приветствие после регистрации",
        memorial_created: "Уведомление о создании мемориала",
        memorial_published: "Уведомление о публикации мемориала",
        new_memory_notification: "Уведомление владельцу о новом воспоминании",
        new_comment_notification: "Уведомление автору о новом комментарии",
      },
    };
  }

  async sendNewsletterTest(email: string, subject: string, content: string): Promise<boolean> {
    return this.adminMailerService.sendNewsletterEmail(email, subject, content, true);
  }

  private normalizeEmail(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const email = value.trim().toLowerCase();
    if (!email) {
      return null;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }

  private async getAudienceRecipients(audience: string): Promise<string[]> {
    const baseSql = `
      SELECT DISTINCT LOWER(BTRIM(u.email)) AS email
      FROM users u
      WHERE u.email IS NOT NULL
        AND BTRIM(u.email) <> ''
    `;

    const ownersSql = `
      SELECT DISTINCT LOWER(BTRIM(u.email)) AS email
      FROM users u
      WHERE u.email IS NOT NULL
        AND BTRIM(u.email) <> ''
        AND EXISTS (
          SELECT 1
          FROM memorials m
          WHERE m.user_id = u.id
            AND m.status = 'published'
        )
    `;

    const result =
      audience === "published_memorial_owners"
        ? await this.db.client.query(ownersSql)
        : await this.db.client.query(baseSql);

    const recipients = result.rows
      .map((row) => this.normalizeEmail(row.email))
      .filter((email): email is string => Boolean(email));

    return Array.from(new Set(recipients));
  }

  async sendNewsletterCampaign(audience: string, subject: string, content: string): Promise<number> {
    const recipients = await this.getAudienceRecipients(audience);
    let sentCount = 0;

    for (const email of recipients) {
      const sent = await this.adminMailerService.sendNewsletterEmail(email, subject, content, false);
      if (sent) {
        sentCount += 1;
      }
    }

    return sentCount;
  }
}
