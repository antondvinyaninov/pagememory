import { Injectable, NotFoundException } from "@nestjs/common";
import { DbService } from "../../common/db.service";
import * as bcrypt from "bcrypt";

export interface UserMemorialSummary {
  id: number;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  biography: string | null;
  photo: string | null;
  religion: string | null;
  status: string | null;
  views: number | null;
  memories_count: number;
}

export interface UserMemorySummary {
  id: number;
  content: string;
  created_at: string;
  memorial_id: number | null;
  memorial_first_name: string | null;
  memorial_last_name: string | null;
  memorial_photo: string | null;
  photos?: string[] | null;
  videos?: string[] | null;
}

export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  profile_type: string | null;
  show_email: boolean;
  show_memorials: boolean;
  created_at?: string | null;
  memorials: UserMemorialSummary[];
  memories: UserMemorySummary[];
}

export interface UpdateProfileInput {
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  email: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  avatar?: string | null;
}

export interface UpdatePrivacyInput {
  profile_type: "public" | "private";
  show_email: boolean;
  show_memorials: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async findPublicProfile(id: number): Promise<UserProfileDto> {
    const userSql = `
      SELECT
        id,
        name,
        email,
        avatar,
        country,
        region,
        city,
        profile_type,
        COALESCE(show_email, false) AS show_email,
        COALESCE(show_memorials, true) AS show_memorials,
        created_at::text AS created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;

    const userResult = await this.db.client.query(userSql, [id]);
    const userRow = userResult.rows[0];
    if (!userRow) {
      throw new NotFoundException("User not found");
    }

    const memorialsSql = `
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.middle_name,
        m.birth_date::text,
        m.death_date::text,
        m.birth_place,
        m.biography,
        m.photo,
        m.religion,
        m.status,
        m.views,
        COUNT(mem.id) AS memories_count
      FROM memorials m
      LEFT JOIN memories mem ON mem.memorial_id = m.id
      WHERE m.user_id = $1
      GROUP BY
        m.id,
        m.first_name,
        m.last_name,
        m.middle_name,
        m.birth_date,
        m.death_date,
        m.birth_place,
        m.biography,
        m.photo,
        m.religion,
        m.status,
        m.views
      ORDER BY m.created_at DESC, m.id DESC
    `;

    const memorialsResult = await this.db.client.query(memorialsSql, [id]);

    const memoriesSql = `
      SELECT
        mem.id,
        mem.content,
        mem.created_at::text,
        mem.memorial_id,
        mem.media::jsonb AS media,
        m.first_name AS memorial_first_name,
        m.last_name AS memorial_last_name,
        m.photo AS memorial_photo
      FROM memories mem
      LEFT JOIN memorials m ON m.id = mem.memorial_id
      WHERE mem.user_id = $1
      ORDER BY mem.created_at DESC, mem.id DESC
    `;

    const memoriesResult = await this.db.client.query(memoriesSql, [id]);
    
    // Извлекаем медиа из JSON и преобразуем в полные URL
    const S3_BASE_URL = process.env.S3_PUBLIC_URL || "https://s3.firstvds.ru/memory";
    const extractMedia = (media: unknown): { photos: string[]; videos: string[] } => {
      const photos: string[] = [];
      const videos: string[] = [];
      
      if (!media || typeof media !== "object") {
        return { photos, videos };
      }
      
      const items = Array.isArray(media) ? media : [];
      for (const item of items) {
        if (typeof item === "object" && item !== null && "type" in item && "url" in item) {
          const url = String(item.url || "");
          if (url) {
            const fullUrl = url.startsWith("http://") || url.startsWith("https://")
              ? url
              : `${S3_BASE_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
            
            if (item.type === "image") {
              photos.push(fullUrl);
            } else if (item.type === "video") {
              videos.push(fullUrl);
            }
          }
        }
      }
      
      return { photos, videos };
    };
    
    const processedMemories = memoriesResult.rows.map((row) => {
      const { photos, videos } = extractMedia(row.media);
      return {
        ...row,
        photos: photos.length > 0 ? photos : null,
        videos: videos.length > 0 ? videos : null,
      };
    });

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatar: userRow.avatar ?? null,
      country: userRow.country,
      region: userRow.region,
      city: userRow.city,
      profile_type: userRow.profile_type,
      show_email: userRow.show_email,
      show_memorials: userRow.show_memorials,
      created_at: userRow.created_at ? String(userRow.created_at) : null,
      memorials: memorialsResult.rows as UserMemorialSummary[],
      memories: processedMemories as UserMemorySummary[],
    };
  }

  async updateProfile(userId: number, input: UpdateProfileInput) {
    const firstName = String(input.first_name || "").trim();
    const lastName = String(input.last_name || "").trim();
    const middleName = String(input.middle_name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      throw new Error("Заполните обязательные поля");
    }

    const emailCheckSql = `
      SELECT id
      FROM users
      WHERE lower(email) = lower($1)
        AND id <> $2
      LIMIT 1
    `;
    const emailCheck = await this.db.client.query(emailCheckSql, [email, userId]);
    if (emailCheck.rows.length > 0) {
      throw new Error("Email уже используется другим пользователем");
    }

    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim();

    const sql = `
      UPDATE users
      SET
        name = $1,
        email = $2,
        country = $3,
        region = $4,
        city = $5,
        avatar = COALESCE($6, avatar),
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        name,
        email,
        avatar,
        country,
        region,
        city,
        profile_type,
        COALESCE(show_email, false) AS show_email,
        COALESCE(show_memorials, true) AS show_memorials
    `;

    const result = await this.db.client.query(sql, [
      fullName,
      email,
      input.country?.trim() || null,
      input.region?.trim() || null,
      input.city?.trim() || null,
      input.avatar?.trim() || null,
      userId,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("User not found");
    }
    return row;
  }

  async updatePassword(userId: number, currentPassword: string, password: string) {
    if (!currentPassword || !password) {
      throw new Error("Заполните обязательные поля");
    }
    if (password.length < 6) {
      throw new Error("Пароль должен быть минимум 6 символов");
    }

    const userSql = `
      SELECT id, password
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const userResult = await this.db.client.query(userSql, [userId]);
    const user = userResult.rows[0] as { id: number; password: string } | undefined;
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.password);
    if (!validCurrent) {
      throw new Error("Неверный текущий пароль");
    }

    const hashed = await bcrypt.hash(password, 10);
    const updateSql = `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await this.db.client.query(updateSql, [hashed, userId]);
  }

  async updatePrivacy(userId: number, input: UpdatePrivacyInput) {
    if (!["public", "private"].includes(input.profile_type)) {
      throw new Error("Некорректный тип профиля");
    }

    const sql = `
      UPDATE users
      SET
        profile_type = $1,
        show_email = $2,
        show_memorials = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        profile_type,
        COALESCE(show_email, false) AS show_email,
        COALESCE(show_memorials, true) AS show_memorials
    `;
    const result = await this.db.client.query(sql, [
      input.profile_type,
      input.show_email,
      input.show_memorials,
      userId,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("User not found");
    }
    return row;
  }
}
