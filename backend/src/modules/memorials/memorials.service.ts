import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { DbService } from "../../common/db.service";
import { StorageService } from "../../common/storage.service";
import type { Express } from "express";

export interface MemoryDto {
  id: number;
  content: string;
  likes: number;
  views: number;
  created_at: string;
  author_id: number | null;
  author_name: string | null;
  author_avatar: string | null;
  author_relationship?: string | null;
  user_liked?: boolean;
  photos?: string[] | null;
  videos?: string[] | null;
  comments: MemoryCommentDto[];
}

export interface MemoryCommentDto {
  id: number;
  memory_id: number;
  content: string;
  likes: number;
  created_at: string;
  author_id: number | null;
  author_name: string | null;
  author_avatar: string | null;
  user_liked?: boolean;
}

export interface MemorialDto {
  id: number;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  biography: string | null;
  photo: string | null;
  views: number | null;
   religion: string | null;
   full_biography: string | null;
   education_details: string | null;
   career_details: string | null;
   hobbies: string | null;
   character_traits: string | null;
   achievements: string | null;
   military_service: string | null;
   military_rank: string | null;
   military_years: string | null;
   military_details: string | null;
   military_conflicts: string[] | null;
   military_files: unknown[] | null;
   achievement_files: unknown[] | null;
   media_photos: string[] | null;
   media_videos: string[] | null;
   burial_city: string | null;
   burial_place: string | null;
   burial_address: string | null;
   burial_location: string | null;
   burial_latitude: number | null;
   burial_longitude: number | null;
   burial_photos: string[] | null;
  memories: MemoryDto[];
}

export interface HomeStatsDto {
  photos: number;
  memories: number;
  users: number;
  memorials: number;
}

export interface HomeMemorialSummaryDto {
  id: number;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  views: number | null;
  photo: string | null;
  updated_at: string;
  memories_count: number;
}

export interface HomeDataDto {
  stats: HomeStatsDto;
  recentMemorials: HomeMemorialSummaryDto[];
}

export interface CreatedMemoryDto {
  id: number;
  memorial_id: number;
  user_id: number;
  content: string;
  likes: number;
  views: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

export interface CreatedCommentDto {
  id: number;
  memory_id: number;
  user_id: number;
  content: string;
  likes: number;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

export interface UpsertMemorialInput {
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  birth_date: string;
  death_date: string;
  birth_place?: string | null;
  biography?: string | null;
  photo?: string | null;
  religion?: string | null;
  full_biography?: string | null;
  education_details?: string | null;
  career_details?: string | null;
  hobbies?: string | null;
  character_traits?: string | null;
  achievements?: string | null;
  military_service?: string | null;
  military_rank?: string | null;
  military_years?: string | null;
  military_details?: string | null;
  military_conflicts?: string[] | null;
  military_files?: unknown[] | null;
  achievement_files?: unknown[] | null;
  media_photos?: string[] | null;
  media_videos?: string[] | null;
  burial_city?: string | null;
  burial_place?: string | null;
  burial_address?: string | null;
  burial_location?: string | null;
  burial_latitude?: number | null;
  burial_longitude?: number | null;
  burial_photos?: string[] | null;
  privacy?: "public" | "family" | "private";
  moderate_memories?: boolean;
  allow_comments?: boolean;
  action?: "draft" | "publish";
}

@Injectable()
export class MemorialsService {
  constructor(
    private readonly db: DbService,
    private readonly storageService: StorageService,
  ) {}
  private idempotencyTableInit: Promise<void> | null = null;
  private readonly memorialCreateEndpointKey = "POST /memorials";

  private async ensureIdempotencyTable(): Promise<void> {
    if (this.idempotencyTableInit) {
      return this.idempotencyTableInit;
    }

    this.idempotencyTableInit = (async () => {
      await this.db.client.query(`
        CREATE TABLE IF NOT EXISTS api_idempotency_keys (
          user_id bigint NOT NULL,
          endpoint text NOT NULL,
          idempotency_key text NOT NULL,
          request_hash text NOT NULL,
          response jsonb,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, endpoint, idempotency_key)
        )
      `);
      await this.db.client.query(`
        CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_created_at
          ON api_idempotency_keys (created_at)
      `);
    })();

    return this.idempotencyTableInit;
  }

  async claimMemorialCreateIdempotency(
    userId: number,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ state: "acquired" | "in_progress" | "replay"; response?: { success: true; memorial: MemorialDto } }> {
    await this.ensureIdempotencyTable();

    const insertSql = `
      INSERT INTO api_idempotency_keys (user_id, endpoint, idempotency_key, request_hash, response)
      VALUES ($1, $2, $3, $4, NULL)
      ON CONFLICT (user_id, endpoint, idempotency_key) DO NOTHING
      RETURNING user_id
    `;
    const inserted = await this.db.client.query(insertSql, [
      userId,
      this.memorialCreateEndpointKey,
      idempotencyKey,
      requestHash,
    ]);
    if (inserted.rows.length > 0) {
      return { state: "acquired" };
    }

    const selectSql = `
      SELECT request_hash, response
      FROM api_idempotency_keys
      WHERE user_id = $1
        AND endpoint = $2
        AND idempotency_key = $3
      LIMIT 1
    `;
    const existingResult = await this.db.client.query(selectSql, [
      userId,
      this.memorialCreateEndpointKey,
      idempotencyKey,
    ]);
    const existing = existingResult.rows[0] as
      | {
          request_hash?: string | null;
          response?: { success: true; memorial: MemorialDto } | null;
        }
      | undefined;
    if (!existing) {
      return { state: "in_progress" };
    }

    if ((existing.request_hash ?? "") !== requestHash) {
      throw new Error("Idempotency-Key уже использован с другими данными запроса.");
    }

    if (existing.response) {
      return { state: "replay", response: existing.response };
    }

    return { state: "in_progress" };
  }

  async saveMemorialCreateIdempotencyResponse(
    userId: number,
    idempotencyKey: string,
    requestHash: string,
    response: { success: true; memorial: MemorialDto },
  ): Promise<void> {
    await this.ensureIdempotencyTable();
    const updateSql = `
      UPDATE api_idempotency_keys
      SET response = $5::jsonb,
          updated_at = NOW()
      WHERE user_id = $1
        AND endpoint = $2
        AND idempotency_key = $3
        AND request_hash = $4
    `;
    await this.db.client.query(updateSql, [
      userId,
      this.memorialCreateEndpointKey,
      idempotencyKey,
      requestHash,
      JSON.stringify(response),
    ]);

    // Периодическая очистка старых ключей.
    await this.db.client.query(`
      DELETE FROM api_idempotency_keys
      WHERE created_at < NOW() - INTERVAL '7 days'
    `);
  }

  async clearMemorialCreateIdempotency(
    userId: number,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<void> {
    await this.ensureIdempotencyTable();
    const deleteSql = `
      DELETE FROM api_idempotency_keys
      WHERE user_id = $1
        AND endpoint = $2
        AND idempotency_key = $3
        AND request_hash = $4
        AND response IS NULL
    `;
    await this.db.client.query(deleteSql, [
      userId,
      this.memorialCreateEndpointKey,
      idempotencyKey,
      requestHash,
    ]);
  }

  private normalizeAction(value: unknown): "draft" | "publish" {
    if (value === undefined || value === null || value === "") {
      return "draft";
    }
    if (value === "draft" || value === "publish") {
      return value;
    }
    throw new Error("Не выбрано действие сохранения. Нажмите «Сохранить» или «Опубликовать».");
  }

  private normalizePrivacy(value: unknown): "public" | "family" | "private" {
    if (value === undefined || value === null || value === "") {
      return "public";
    }
    if (value === "public" || value === "family" || value === "private") {
      return value;
    }
    throw new Error("Выберите приватность мемориала.");
  }

  private normalizeDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Некорректная дата");
    }
    return date.toISOString().slice(0, 10);
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    const normalized = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return normalized.length > 0 ? normalized : null;
  }

  private async isMemoriesEnabled(): Promise<boolean> {
    const sql = `SELECT data FROM app_settings WHERE id = 1 LIMIT 1`;
    const result = await this.db.client.query(sql);
    const row = result.rows[0] as { data?: unknown } | undefined;
    const data = row?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return true;
    }

    const access = (data as { access?: unknown }).access;
    if (!access || typeof access !== "object" || Array.isArray(access)) {
      return true;
    }

    const enabled = (access as { enable_memories?: unknown }).enable_memories;
    if (typeof enabled === "boolean") {
      return enabled;
    }
    return true;
  }

  private async isCommentsEnabled(): Promise<boolean> {
    const sql = `SELECT data FROM app_settings WHERE id = 1 LIMIT 1`;
    const result = await this.db.client.query(sql);
    const row = result.rows[0] as { data?: unknown } | undefined;
    const data = row?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return true;
    }

    const access = (data as { access?: unknown }).access;
    if (!access || typeof access !== "object" || Array.isArray(access)) {
      return true;
    }

    const enabled = (access as { enable_comments?: unknown }).enable_comments;
    if (typeof enabled === "boolean") {
      return enabled;
    }
    return true;
  }

  private async canUserViewMemorial(memorialId: number, userId: number): Promise<{
    id: number;
    user_id: number;
    status: string | null;
    privacy: string | null;
    moderate_memories: boolean;
  }> {
    const memorialSql = `
      SELECT id, user_id, status, privacy, COALESCE(moderate_memories, false) AS moderate_memories
      FROM memorials
      WHERE id = $1
      LIMIT 1
    `;
    const memorialResult = await this.db.client.query(memorialSql, [memorialId]);
    const memorial = memorialResult.rows[0] as
      | {
          id: number;
          user_id: number;
          status: string | null;
          privacy: string | null;
          moderate_memories: boolean;
        }
      | undefined;

    if (!memorial) {
      throw new NotFoundException("Мемориал не найден");
    }

    if (memorial.user_id === userId) {
      return memorial;
    }

    if (memorial.status !== "published") {
      throw new Error("У вас нет доступа к этому мемориалу");
    }

    const privacy = memorial.privacy && ["public", "family", "private"].includes(memorial.privacy)
      ? memorial.privacy
      : "public";

    if (privacy === "public") {
      return memorial;
    }

    if (privacy === "private") {
      throw new Error("У вас нет доступа к этому мемориалу");
    }

    const relationshipSql = `
      SELECT 1
      FROM relationships
      WHERE memorial_id = $1
        AND user_id = $2
        AND confirmed = true
      LIMIT 1
    `;
    const relationship = await this.db.client.query(relationshipSql, [memorialId, userId]);
    if (relationship.rows.length === 0) {
      throw new Error("У вас нет доступа к этому мемориалу");
    }

    return memorial;
  }

  async getHomeData(): Promise<HomeDataDto> {
    const statsSql = `
      SELECT
        (
          SELECT COALESCE(SUM(jsonb_array_length(media_photos::jsonb)), 0)::bigint
          FROM memorials
          WHERE media_photos IS NOT NULL
            AND media_photos::text <> '[]'
            AND media_photos::text <> 'null'
        ) AS photos,
        (SELECT COUNT(*)::bigint FROM memories) AS memories,
        (SELECT COUNT(*)::bigint FROM users) AS users,
        (SELECT COUNT(*)::bigint FROM memorials WHERE status = 'published') AS memorials
    `;

    const statsResult = await this.db.client.query(statsSql);
    const statsRow = statsResult.rows[0] ?? {
      photos: 0,
      memories: 0,
      users: 0,
      memorials: 0,
    };

    const recentSql = `
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.middle_name,
        m.birth_date::text AS birth_date,
        m.death_date::text AS death_date,
        m.birth_place,
        m.views,
        m.photo,
        m.updated_at::text AS updated_at,
        COUNT(mem.id)::bigint AS memories_count
      FROM memorials m
      LEFT JOIN memories mem ON mem.memorial_id = m.id
      WHERE m.status = 'published'
        AND (m.privacy = 'public' OR m.privacy IS NULL)
      GROUP BY
        m.id,
        m.first_name,
        m.last_name,
        m.middle_name,
        m.birth_date,
        m.death_date,
        m.birth_place,
        m.views,
        m.photo,
        m.updated_at
      ORDER BY m.updated_at DESC, m.id DESC
      LIMIT 6
    `;

    const recentResult = await this.db.client.query(recentSql);

    return {
      stats: {
        photos: Number(statsRow.photos ?? 0),
        memories: Number(statsRow.memories ?? 0),
        users: Number(statsRow.users ?? 0),
        memorials: Number(statsRow.memorials ?? 0),
      },
      recentMemorials: recentResult.rows as HomeMemorialSummaryDto[],
    };
  }

  /**
   * Получить данные для sitemap - все опубликованные мемориалы
   */
  async getSitemapData(): Promise<Array<{ id: number; updated_at: string | null }>> {
    const sql = `
      SELECT id, updated_at
      FROM memorials
      WHERE status = 'published'
        AND (privacy = 'public' OR privacy IS NULL)
      ORDER BY updated_at DESC, id DESC
    `;

    const result = await this.db.client.query(sql);
    return result.rows.map((row: { id: number; updated_at: string | null }) => ({
      id: Number(row.id),
      updated_at: row.updated_at ? String(row.updated_at) : null,
    }));
  }

  async searchMemorials(query: string, limit: number = 10): Promise<Array<{
    id: number;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    birth_date: string | null;
    death_date: string | null;
    photo: string | null;
  }>> {
    const searchLimit = Math.min(Math.max(limit, 1), 20); // Ограничиваем от 1 до 20
    const searchQuery = query.trim();
    
    if (searchQuery.length < 2) {
      return [];
    }

    // Ищем по ФИО, датам жизни и городу рождения
    const searchSql = `
      SELECT
        id,
        first_name,
        last_name,
        middle_name,
        birth_date::text AS birth_date,
        death_date::text AS death_date,
        photo
      FROM memorials
      WHERE status = 'published'
        AND (
          privacy = 'public' OR privacy IS NULL
        )
        AND (
          LOWER(CONCAT(COALESCE(last_name, ''), ' ', COALESCE(first_name, ''), ' ', COALESCE(middle_name, ''))) LIKE LOWER($1)
          OR LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''), ' ', COALESCE(middle_name, ''))) LIKE LOWER($1)
          OR LOWER(COALESCE(last_name, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(first_name, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(middle_name, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(birth_place, '')) LIKE LOWER($1)
          OR TO_CHAR(birth_date, 'DD.MM.YYYY') LIKE $1
          OR TO_CHAR(death_date, 'DD.MM.YYYY') LIKE $1
          OR EXTRACT(YEAR FROM birth_date)::text LIKE $1
          OR EXTRACT(YEAR FROM death_date)::text LIKE $1
        )
      ORDER BY
        CASE
          WHEN LOWER(CONCAT(COALESCE(last_name, ''), ' ', COALESCE(first_name, ''), ' ', COALESCE(middle_name, ''))) LIKE LOWER($1) THEN 1
          WHEN LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''), ' ', COALESCE(middle_name, ''))) LIKE LOWER($1) THEN 2
          WHEN LOWER(COALESCE(last_name, '')) LIKE LOWER($1) THEN 3
          WHEN LOWER(COALESCE(first_name, '')) LIKE LOWER($1) THEN 4
          ELSE 5
        END,
        updated_at DESC
      LIMIT $2
    `;

    const searchPattern = `%${searchQuery}%`;
    const result = await this.db.client.query(searchSql, [searchPattern, searchLimit]);
    
    return result.rows.map((row) => ({
      id: Number(row.id),
      first_name: String(row.first_name || ""),
      last_name: String(row.last_name || ""),
      middle_name: row.middle_name ? String(row.middle_name) : null,
      birth_date: row.birth_date ? String(row.birth_date) : null,
      death_date: row.death_date ? String(row.death_date) : null,
      photo: row.photo ? String(row.photo) : null,
    }));
  }

  async findOne(id: number, userId: number | null = null): Promise<MemorialDto> {
    const memorialSql = `
      SELECT
        id,
        user_id,
        first_name,
        last_name,
        middle_name,
        birth_date::text,
        death_date::text,
        birth_place,
        biography,
        photo,
        views,
        religion,
        full_biography,
        education_details,
        career_details,
        hobbies,
        character_traits,
        achievements,
        military_service,
        military_rank,
        military_years,
        military_details,
        military_conflicts::jsonb AS military_conflicts,
        military_files::jsonb AS military_files,
        achievement_files::jsonb AS achievement_files,
        media_photos::jsonb AS media_photos,
        media_videos::jsonb AS media_videos,
        burial_city,
        burial_place,
        burial_address,
        burial_location,
        burial_latitude,
        burial_longitude,
        burial_photos::jsonb AS burial_photos
      FROM memorials
      WHERE id = $1
      LIMIT 1
    `;

    const memorialResult = await this.db.client.query(memorialSql, [id]);
    const memorialRow = memorialResult.rows[0];
    if (!memorialRow) {
      throw new NotFoundException("Memorial not found");
    }

    // Увеличиваем счетчик просмотров мемориала только для авторизованных пользователей (не для автора)
    if (userId !== null) {
      const memorialUserId = typeof memorialRow.user_id === 'string' ? Number(memorialRow.user_id) : Number(memorialRow.user_id);
      const isOwner = Number.isFinite(memorialUserId) && memorialUserId === userId;
      
      if (!isOwner) {
        // Увеличиваем счетчик просмотров только для авторизованных пользователей
        await this.db.client.query(
          `UPDATE memorials SET views = COALESCE(views, 0) + 1 WHERE id = $1`,
          [id]
        );
        // Обновляем значение в memorialRow для возврата
        const currentViews = typeof memorialRow.views === 'string' ? Number(memorialRow.views) : Number(memorialRow.views);
        memorialRow.views = (currentViews || 0) + 1;
      }
    }

    const memoriesSql = `
      SELECT
        mem.id,
        mem.content,
        mem.likes,
        mem.views,
        mem.created_at::text,
        mem.media::jsonb AS media,
        mem.user_id AS author_id,
        CASE 
          WHEN u.name IS NULL THEN NULL
          WHEN array_length(string_to_array(trim(u.name), ' '), 1) = 3 THEN 
            (string_to_array(trim(u.name), ' '))[2] || ' ' || (string_to_array(trim(u.name), ' '))[1] || ' ' || (string_to_array(trim(u.name), ' '))[3]
          WHEN array_length(string_to_array(trim(u.name), ' '), 1) = 2 THEN 
            (string_to_array(trim(u.name), ' '))[2] || ' ' || (string_to_array(trim(u.name), ' '))[1]
          ELSE u.name
        END AS author_name,
        u.avatar AS author_avatar
      FROM memories mem
      LEFT JOIN users u ON u.id = mem.user_id
      WHERE mem.memorial_id = $1
      ORDER BY mem.created_at DESC, mem.id DESC
    `;

    const memoriesResult = await this.db.client.query(memoriesSql, [id]);
    const memoryRows = memoriesResult.rows.map((row) => ({
      id: Number(row.id),
      content: String(row.content ?? ""),
      likes: Number(row.likes ?? 0),
      views: Number(row.views ?? 0),
      created_at: String(row.created_at ?? ""),
      media: row.media,
      author_id: row.author_id !== null && row.author_id !== undefined ? Number(row.author_id) : null,
      author_name: row.author_name ? String(row.author_name) : null,
      author_avatar: row.author_avatar ? String(row.author_avatar) : null,
    }));

    // Получаем все связи для авторов воспоминаний
    const authorIds = memoryRows
      .map((row) => {
        const authorId = row.author_id;
        if (authorId === null || authorId === undefined) return null;
        const numId = typeof authorId === 'string' ? Number(authorId) : authorId;
        return Number.isFinite(numId) ? numId : null;
      })
      .filter((id): id is number => id !== null);
    const relationshipsMap = new Map<number, { relationship_type: string | null; custom_relationship: string | null; visible: boolean | null }>();
    
    if (authorIds.length > 0) {
      const relationshipsSql = `
        SELECT user_id, relationship_type, custom_relationship, visible
        FROM relationships
        WHERE memorial_id = $1 AND user_id = ANY($2::int[]) AND visible = true
      `;
      const relationshipsResult = await this.db.client.query(relationshipsSql, [id, authorIds]);
      for (const row of relationshipsResult.rows) {
        const userId = typeof row.user_id === 'string' ? Number(row.user_id) : Number(row.user_id);
        if (!Number.isFinite(userId)) continue;
        const relationship = {
          relationship_type: row.relationship_type || null,
          custom_relationship: row.custom_relationship || null,
          visible: row.visible ?? true,
        };
        relationshipsMap.set(userId, relationship);
      }
    }

    const memoryIds = memoryRows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value));
    
    // Получаем лайки пользователя для воспоминаний
    const userMemoryLikes = new Set<number>();
    if (userId && memoryIds.length > 0) {
      const likesSql = `
        SELECT memory_id
        FROM memory_likes
        WHERE user_id = $1 AND memory_id = ANY($2::int[])
      `;
      const likesResult = await this.db.client.query(likesSql, [userId, memoryIds]);
      for (const row of likesResult.rows) {
        userMemoryLikes.add(Number(row.memory_id));
      }
    }
    
    let commentsByMemoryId = new Map<number, MemoryCommentDto[]>();

    if (memoryIds.length > 0) {
      const commentsSql = `
        SELECT
          c.id,
          c.memory_id,
          c.content,
          c.likes,
          c.created_at::text,
          u.id AS author_id,
          CASE 
            WHEN u.name IS NULL THEN NULL
            WHEN array_length(string_to_array(trim(u.name), ' '), 1) = 3 THEN 
              (string_to_array(trim(u.name), ' '))[2] || ' ' || (string_to_array(trim(u.name), ' '))[1] || ' ' || (string_to_array(trim(u.name), ' '))[3]
            WHEN array_length(string_to_array(trim(u.name), ' '), 1) = 2 THEN 
              (string_to_array(trim(u.name), ' '))[2] || ' ' || (string_to_array(trim(u.name), ' '))[1]
            ELSE u.name
          END AS author_name,
          u.avatar AS author_avatar
        FROM comments c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.memory_id = ANY($1::int[])
        ORDER BY c.created_at ASC, c.id ASC
      `;
      const commentsResult = await this.db.client.query(commentsSql, [memoryIds]);
      
      // Получаем лайки пользователя для комментариев
      const commentIds = commentsResult.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value));
      const userCommentLikes = new Set<number>();
      if (userId && commentIds.length > 0) {
        const commentLikesSql = `
          SELECT comment_id
          FROM comment_likes
          WHERE user_id = $1 AND comment_id = ANY($2::int[])
        `;
        const commentLikesResult = await this.db.client.query(commentLikesSql, [userId, commentIds]);
        for (const row of commentLikesResult.rows) {
          userCommentLikes.add(Number(row.comment_id));
        }
      }
      
      commentsByMemoryId = commentsResult.rows.reduce((acc, row) => {
        const memoryId = Number(row.memory_id);
        const commentId = Number(row.id);
        const item: MemoryCommentDto = {
          id: commentId,
          memory_id: memoryId,
          content: String(row.content ?? ""),
          likes: Number(row.likes ?? 0),
          created_at: String(row.created_at ?? ""),
          author_id: row.author_id === null ? null : Number(row.author_id),
          author_name: row.author_name === null ? null : String(row.author_name),
          author_avatar: row.author_avatar === null ? null : String(row.author_avatar),
          user_liked: userId ? userCommentLikes.has(commentId) : false,
        };
        const list = acc.get(memoryId) ?? [];
        list.push(item);
        acc.set(memoryId, list);
        return acc;
      }, new Map<number, MemoryCommentDto[]>());
    }

    return {
      ...(memorialRow as Omit<MemorialDto, "memories">),
      memories: memoryRows.map((memory) => {
        const { photos, videos } = this.extractMemoryMedia(memory.media);
        let relationship = null;
        if (memory.author_id) {
          const authorId = typeof memory.author_id === 'string' ? Number(memory.author_id) : Number(memory.author_id);
          relationship = Number.isFinite(authorId) ? (relationshipsMap.get(authorId) ?? null) : null;
        }
        const authorRelationship = this.getRelationshipLabel(relationship);
        const memoryIdNum = Number(memory.id);
        return {
          id: memory.id,
          content: memory.content,
          likes: memory.likes,
          views: memory.views,
          created_at: memory.created_at,
          author_id: memory.author_id,
          author_name: memory.author_name,
          author_avatar: memory.author_avatar,
          author_relationship: authorRelationship,
          user_liked: userId ? userMemoryLikes.has(memoryIdNum) : false,
          photos,
          videos,
          comments: commentsByMemoryId.get(memoryIdNum) ?? [],
        } as MemoryDto;
      }),
    };
  }

  async create(userId: number, input: UpsertMemorialInput): Promise<MemorialDto> {
    const firstName = this.normalizeString(input.first_name);
    const lastName = this.normalizeString(input.last_name);
    const missingFields: string[] = [];
    if (!lastName) missingFields.push("Фамилия");
    if (!firstName) missingFields.push("Имя");
    if (!input.birth_date) missingFields.push("Дата рождения");
    if (!input.death_date) missingFields.push("Дата смерти");
    if (missingFields.length > 0) {
      throw new Error(`Не заполнены обязательные поля: ${missingFields.join(", ")}.`);
    }

    let birthDate: string;
    try {
      birthDate = this.normalizeDate(input.birth_date);
    } catch {
      throw new Error("Некорректная дата рождения.");
    }

    let deathDate: string;
    try {
      deathDate = this.normalizeDate(input.death_date);
    } catch {
      throw new Error("Некорректная дата смерти.");
    }

    if (deathDate < birthDate) {
      throw new Error("Дата смерти не может быть раньше даты рождения");
    }

    const status = this.normalizeAction(input.action) === "publish" ? "published" : "draft";
    const privacy = this.normalizePrivacy(input.privacy);

    const sql = `
      INSERT INTO memorials (
        user_id,
        status,
        last_name,
        first_name,
        middle_name,
        birth_date,
        death_date,
        birth_place,
        photo,
        biography,
        religion,
        full_biography,
        education_details,
        career_details,
        hobbies,
        character_traits,
        achievements,
        military_service,
        military_rank,
        military_years,
        military_details,
        military_conflicts,
        military_files,
        achievement_files,
        media_photos,
        media_videos,
        burial_city,
        burial_place,
        burial_address,
        burial_location,
        burial_latitude,
        burial_longitude,
        burial_photos,
        privacy,
        moderate_memories,
        allow_comments,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb, $24::jsonb,
        $25::jsonb, $26::jsonb, $27, $28, $29, $30, $31, $32, $33::jsonb, $34, $35, $36, NOW(), NOW()
      )
      RETURNING id
    `;

    const insert = await this.db.client.query(sql, [
      userId,
      status,
      lastName,
      firstName,
      this.normalizeString(input.middle_name),
      birthDate,
      deathDate,
      this.normalizeString(input.birth_place),
      this.normalizeString(input.photo),
      this.normalizeString(input.biography),
      this.normalizeString(input.religion) ?? "none",
      this.normalizeString(input.full_biography),
      this.normalizeString(input.education_details),
      this.normalizeString(input.career_details),
      this.normalizeString(input.hobbies),
      this.normalizeString(input.character_traits),
      this.normalizeString(input.achievements),
      this.normalizeString(input.military_service),
      this.normalizeString(input.military_rank),
      this.normalizeString(input.military_years),
      this.normalizeString(input.military_details),
      JSON.stringify(this.normalizeStringArray(input.military_conflicts) ?? []),
      JSON.stringify(Array.isArray(input.military_files) ? input.military_files : []),
      JSON.stringify(Array.isArray(input.achievement_files) ? input.achievement_files : []),
      JSON.stringify(this.normalizeStringArray(input.media_photos) ?? []),
      JSON.stringify(this.normalizeStringArray(input.media_videos) ?? []),
      this.normalizeString(input.burial_city),
      this.normalizeString(input.burial_place),
      this.normalizeString(input.burial_address),
      this.normalizeString(input.burial_location),
      input.burial_latitude ?? null,
      input.burial_longitude ?? null,
      JSON.stringify(this.normalizeStringArray(input.burial_photos) ?? []),
      privacy,
      input.moderate_memories === true,
      input.allow_comments !== false,
    ]);

    const id = Number(insert.rows[0]?.id ?? 0);
    if (!id) {
      throw new Error("Не удалось создать мемориал");
    }
    return this.findOne(id);
  }

  private extractMemoryMedia(raw: unknown): { photos: string[]; videos: string[] } {
    if (!Array.isArray(raw)) {
      return { photos: [], videos: [] };
    }

    const photos: string[] = [];
    const videos: string[] = [];

    for (const item of raw) {
      if (!item) continue;

      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) {
          photos.push(this.toPublicMediaUrl(trimmed));
        }
        continue;
      }

      if (typeof item === "object") {
        const obj = item as { type?: unknown; url?: unknown; path?: unknown };
        const urlRaw = (obj.url ?? obj.path) as unknown;
        if (typeof urlRaw !== "string") continue;
        const url = urlRaw.trim();
        if (!url) continue;

        const publicUrl = this.toPublicMediaUrl(url);
        const type = typeof obj.type === "string" ? obj.type : "";
        if (type === "video") {
          videos.push(publicUrl);
        } else if (type === "image" || !type) {
          photos.push(publicUrl);
        }
      }
    }

    return {
      photos: Array.from(new Set(photos)),
      videos: Array.from(new Set(videos)),
    };
  }

  async update(userId: number, id: number, input: UpsertMemorialInput): Promise<MemorialDto> {
    const existingSql = `
      SELECT
        id,
        user_id,
        photo,
        military_conflicts,
        military_files,
        achievement_files,
        media_photos,
        media_videos,
        burial_latitude,
        burial_longitude,
        burial_photos
      FROM memorials
      WHERE id = $1
      LIMIT 1
    `;
    const existingResult = await this.db.client.query(existingSql, [id]);
    const existing = existingResult.rows[0] as
      | {
          id: number;
          user_id: number;
          photo: string | null;
          military_conflicts: string[] | null;
          military_files: unknown[] | null;
          achievement_files: unknown[] | null;
          media_photos: string[] | null;
          media_videos: string[] | null;
          burial_latitude: number | null;
          burial_longitude: number | null;
          burial_photos: string[] | null;
        }
      | undefined;
    if (!existing) {
      throw new NotFoundException("Memorial not found");
    }
    if (existing.user_id !== userId) {
      throw new Error("Недостаточно прав для редактирования мемориала");
    }

    const firstName = this.normalizeString(input.first_name);
    const lastName = this.normalizeString(input.last_name);
    const missingFields: string[] = [];
    if (!lastName) missingFields.push("Фамилия");
    if (!firstName) missingFields.push("Имя");
    if (!input.birth_date) missingFields.push("Дата рождения");
    if (!input.death_date) missingFields.push("Дата смерти");
    if (missingFields.length > 0) {
      throw new Error(`Не заполнены обязательные поля: ${missingFields.join(", ")}.`);
    }

    let birthDate: string;
    try {
      birthDate = this.normalizeDate(input.birth_date);
    } catch {
      throw new Error("Некорректная дата рождения.");
    }

    let deathDate: string;
    try {
      deathDate = this.normalizeDate(input.death_date);
    } catch {
      throw new Error("Некорректная дата смерти.");
    }

    if (deathDate < birthDate) {
      throw new Error("Дата смерти не может быть раньше даты рождения");
    }

    const status = this.normalizeAction(input.action) === "publish" ? "published" : "draft";
    const privacy = this.normalizePrivacy(input.privacy);
    const finalPhoto =
      input.photo === undefined ? (existing.photo ?? null) : this.normalizeString(input.photo);
    const finalMilitaryConflicts =
      input.military_conflicts === undefined
        ? (existing.military_conflicts ?? [])
        : (this.normalizeStringArray(input.military_conflicts) ?? []);
    const finalMilitaryFiles =
      input.military_files === undefined
        ? (Array.isArray(existing.military_files) ? existing.military_files : [])
        : (Array.isArray(input.military_files) ? input.military_files : []);
    const finalAchievementFiles =
      input.achievement_files === undefined
        ? (Array.isArray(existing.achievement_files) ? existing.achievement_files : [])
        : (Array.isArray(input.achievement_files) ? input.achievement_files : []);
    const finalMediaPhotos =
      input.media_photos === undefined
        ? (existing.media_photos ?? [])
        : (this.normalizeStringArray(input.media_photos) ?? []);
    const finalMediaVideos =
      input.media_videos === undefined
        ? (existing.media_videos ?? [])
        : (this.normalizeStringArray(input.media_videos) ?? []);
    const finalBurialPhotos =
      input.burial_photos === undefined
        ? (existing.burial_photos ?? [])
        : (this.normalizeStringArray(input.burial_photos) ?? []);
    const finalBurialLatitude =
      input.burial_latitude === undefined
        ? (existing.burial_latitude ?? null)
        : input.burial_latitude;
    const finalBurialLongitude =
      input.burial_longitude === undefined
        ? (existing.burial_longitude ?? null)
        : input.burial_longitude;

    const updateSql = `
      UPDATE memorials
      SET
        status = $1,
        last_name = $2,
        first_name = $3,
        middle_name = $4,
        birth_date = $5::date,
        death_date = $6::date,
        birth_place = $7,
        photo = $8,
        biography = $9,
        religion = $10,
        full_biography = $11,
        education_details = $12,
        career_details = $13,
        hobbies = $14,
        character_traits = $15,
        achievements = $16,
        military_service = $17,
        military_rank = $18,
        military_years = $19,
        military_details = $20,
        military_conflicts = $21::jsonb,
        military_files = $22::jsonb,
        achievement_files = $23::jsonb,
        media_photos = $24::jsonb,
        media_videos = $25::jsonb,
        burial_city = $26,
        burial_place = $27,
        burial_address = $28,
        burial_location = $29,
        burial_latitude = $30,
        burial_longitude = $31,
        burial_photos = $32::jsonb,
        privacy = $33,
        moderate_memories = $34,
        allow_comments = $35,
        updated_at = NOW()
      WHERE id = $36
    `;
    await this.db.client.query(updateSql, [
      status,
      lastName,
      firstName,
      this.normalizeString(input.middle_name),
      birthDate,
      deathDate,
      this.normalizeString(input.birth_place),
      finalPhoto,
      this.normalizeString(input.biography),
      this.normalizeString(input.religion) ?? "none",
      this.normalizeString(input.full_biography),
      this.normalizeString(input.education_details),
      this.normalizeString(input.career_details),
      this.normalizeString(input.hobbies),
      this.normalizeString(input.character_traits),
      this.normalizeString(input.achievements),
      this.normalizeString(input.military_service),
      this.normalizeString(input.military_rank),
      this.normalizeString(input.military_years),
      this.normalizeString(input.military_details),
      JSON.stringify(finalMilitaryConflicts),
      JSON.stringify(finalMilitaryFiles),
      JSON.stringify(finalAchievementFiles),
      JSON.stringify(finalMediaPhotos),
      JSON.stringify(finalMediaVideos),
      this.normalizeString(input.burial_city),
      this.normalizeString(input.burial_place),
      this.normalizeString(input.burial_address),
      this.normalizeString(input.burial_location),
      finalBurialLatitude,
      finalBurialLongitude,
      JSON.stringify(finalBurialPhotos),
      privacy,
      input.moderate_memories === true,
      input.allow_comments !== false,
      id,
    ]);
    return this.findOne(id);
  }

  private getRelationshipLabel(relationship: {
    relationship_type: string | null;
    custom_relationship: string | null;
    visible: boolean | null;
  } | null): string | null {
    if (!relationship) return null;
    if (relationship.relationship_type === "not_specified" || relationship.visible === false) {
      return null;
    }
    if (relationship.relationship_type === "other") {
      return relationship.custom_relationship || null;
    }
    const labels: Record<string, string> = {
      husband: "Муж",
      wife: "Жена",
      father: "Отец",
      mother: "Мать",
      son: "Сын",
      daughter: "Дочь",
      brother: "Брат",
      sister: "Сестра",
      grandfather: "Дедушка",
      grandmother: "Бабушка",
      grandson: "Внук",
      granddaughter: "Внучка",
      uncle: "Дядя",
      aunt: "Тетя",
      nephew: "Племянник",
      niece: "Племянница",
      relative: "Родственник",
      friend_male: "Друг",
      friend_female: "Подруга",
      colleague: "Коллега",
      neighbor: "Сосед",
      classmate: "Одноклассник",
      coursemate: "Однокурсник",
    };
    return labels[relationship.relationship_type || ""] || relationship.relationship_type || null;
  }

  async getUserRelationship(memorialId: number, userId: number): Promise<{
    relationship_type: string | null;
    custom_relationship: string | null;
    visible: boolean | null;
  } | null> {
    const sql = `
      SELECT relationship_type, custom_relationship, visible
      FROM relationships
      WHERE memorial_id = $1 AND user_id = $2
      LIMIT 1
    `;
    const result = await this.db.client.query(sql, [memorialId, userId]);
    if (result.rows.length === 0) return null;
    return {
      relationship_type: result.rows[0].relationship_type || null,
      custom_relationship: result.rows[0].custom_relationship || null,
      visible: result.rows[0].visible ?? true,
    };
  }

  async updateRelationship(
    memorialId: number,
    userId: number,
    relationshipType: string | null,
    customRelationship: string | null = null,
  ): Promise<void> {
    if (!relationshipType) {
      throw new Error("Тип связи не указан");
    }
    await this.createRelationship(memorialId, userId, relationshipType, customRelationship);
  }

  async getPeople(memorialId: number, currentUserId: number | null): Promise<Array<{
    user_id: number;
    user_name: string;
    user_avatar: string | null;
    relationship_type: string | null;
    custom_relationship: string | null;
    confirmed: boolean;
    is_current_user?: boolean;
  }>> {
    // Получаем всех людей, включая текущего пользователя (если авторизован)
    // Используем явное приведение типа для $2, чтобы PostgreSQL мог определить тип
    const sql = `
      SELECT 
        r.user_id,
        CASE 
          WHEN u.name IS NULL OR trim(COALESCE(u.name, '')) = '' THEN 'Пользователь'
          WHEN COALESCE(array_length(string_to_array(trim(u.name), ' '), 1), 0) = 3 THEN 
            COALESCE((string_to_array(trim(u.name), ' '))[2], '') || ' ' || 
            COALESCE((string_to_array(trim(u.name), ' '))[1], '') || ' ' || 
            COALESCE((string_to_array(trim(u.name), ' '))[3], '')
          WHEN COALESCE(array_length(string_to_array(trim(u.name), ' '), 1), 0) = 2 THEN 
            COALESCE((string_to_array(trim(u.name), ' '))[2], '') || ' ' || 
            COALESCE((string_to_array(trim(u.name), ' '))[1], '')
          ELSE COALESCE(u.name, 'Пользователь')
        END AS user_name,
        u.avatar AS user_avatar,
        r.relationship_type,
        r.custom_relationship,
        r.confirmed
      FROM relationships r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.memorial_id = $1
        AND r.visible = true
      ORDER BY 
        CASE WHEN $2::integer IS NOT NULL AND r.user_id = $2::integer THEN 0 ELSE 1 END,
        r.created_at DESC
    `;
    const result = await this.db.client.query(sql, [memorialId, currentUserId ?? null]);
    return result.rows.map((row) => ({
      user_id: Number(row.user_id),
      user_name: String(row.user_name || "Пользователь"),
      user_avatar: row.user_avatar ? String(row.user_avatar) : null,
      relationship_type: row.relationship_type ? String(row.relationship_type) : null,
      custom_relationship: row.custom_relationship ? String(row.custom_relationship) : null,
      confirmed: Boolean(row.confirmed),
      is_current_user: currentUserId !== null && Number(row.user_id) === currentUserId,
    }));
  }

  private async createRelationship(
    memorialId: number,
    userId: number,
    relationshipType: string,
    customRelationship: string | null = null,
  ): Promise<void> {
    // Проверяем, есть ли уже связь
    const existing = await this.getUserRelationship(memorialId, userId);
    const visible = relationshipType !== "not_specified";
    
    if (existing) {
      // Обновляем существующую связь
      const updateSql = `
        UPDATE relationships
        SET relationship_type = $1,
            custom_relationship = $2,
            visible = $3,
            updated_at = NOW()
        WHERE memorial_id = $4 AND user_id = $5
      `;
      await this.db.client.query(updateSql, [relationshipType, customRelationship, visible, memorialId, userId]);
    } else {
      // Создаем новую связь
      const insertSql = `
        INSERT INTO relationships (memorial_id, user_id, relationship_type, custom_relationship, confirmed, visible, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
      `;
      await this.db.client.query(insertSql, [memorialId, userId, relationshipType, customRelationship, visible]);
    }
  }

  async createMemory(
    userId: number,
    memorialId: number,
    content: string,
    mediaFiles: Express.Multer.File[] = [],
    relationshipType?: string | null,
    customRelationship?: string | null,
  ): Promise<CreatedMemoryDto> {
    if (!(await this.isMemoriesEnabled())) {
      throw new Error("Добавление воспоминаний временно отключено");
    }

    const normalizedContent = this.normalizeString(content);
    // Если есть медиа файлы, текст может быть короче или отсутствовать
    if ((!normalizedContent || normalizedContent.length < 10) && mediaFiles.length === 0) {
      throw new Error("Воспоминание не может быть пустым. Добавьте текст (минимум 10 символов) или медиа файлы.");
    }

    const memorial = await this.canUserViewMemorial(memorialId, userId);
    if (memorial.moderate_memories && memorial.user_id !== userId) {
      throw new Error("Владелец мемориала включил модерацию. Новые воспоминания временно недоступны.");
    }

    // Проверяем, есть ли у пользователя связь с мемориалом
    const existingRelationship = await this.getUserRelationship(memorialId, userId);
    
    // Если связи нет и она указана в запросе - создаем
    if (!existingRelationship && relationshipType && relationshipType.trim()) {
      await this.createRelationship(memorialId, userId, relationshipType.trim(), customRelationship || null);
    }

    const insertSql = `
      INSERT INTO memories (memorial_id, user_id, content, media, likes, views, created_at, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, 0, 0, NOW(), NOW())
      RETURNING id, memorial_id, user_id, content, likes, views, created_at::text
    `;

    // Сначала создаём воспоминание с пустым media, потом загружаем файлы и обновляем
    const inserted = await this.db.client.query(insertSql, [
      memorialId,
      userId,
      normalizedContent,
      JSON.stringify([]),
    ]);
    const memory = inserted.rows[0] as
      | {
          id: number;
          memorial_id: number;
          user_id: number;
          content: string;
          likes: number;
          views: number;
          created_at: string;
        }
      | undefined;

    if (!memory) {
      throw new Error("Не удалось создать воспоминание");
    }

    // Загружаем медиа файлы в S3 и формируем массив для БД.
    // В БД сохраняем только относительные пути (как в Laravel),
    // а публичный URL собирается уже на фронтенде через PUBLIC_S3_BASE_URL.
    const mediaItems: Array<{ type: "image" | "video"; url: string }> = [];

    for (const file of mediaFiles) {
      const isImage = file.mimetype?.startsWith("image/") ?? false;
      const isVideo = file.mimetype?.startsWith("video/") ?? false;

      if (!isImage && !isVideo) {
        console.warn(`[MemorialsService] Skipping unsupported file type: ${file.mimetype}`);
        continue;
      }

      try {
        const path = isImage
          ? await this.storageService.uploadMemoryPhoto(memory.id, file)
          : await this.storageService.uploadMemoryVideo(memory.id, file);

        mediaItems.push({
          type: isImage ? "image" : "video",
          url: path,
        });
      } catch (error) {
        console.error(`[MemorialsService] Failed to upload ${isImage ? "photo" : "video"}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
        throw new Error(`Не удалось загрузить ${isImage ? "фото" : "видео"}: ${errorMessage}`);
      }
    }

    // Обновляем воспоминание с медиа
    if (mediaItems.length > 0) {
      const updateSql = `
        UPDATE memories
        SET media = $1::jsonb, updated_at = NOW()
        WHERE id = $2
      `;
      await this.db.client.query(updateSql, [JSON.stringify(mediaItems), memory.id]);
    }

    const authorSql = `
      SELECT 
        CASE 
          WHEN name IS NULL THEN NULL
          WHEN array_length(string_to_array(trim(name), ' '), 1) = 3 THEN 
            (string_to_array(trim(name), ' '))[2] || ' ' || (string_to_array(trim(name), ' '))[1] || ' ' || (string_to_array(trim(name), ' '))[3]
          WHEN array_length(string_to_array(trim(name), ' '), 1) = 2 THEN 
            (string_to_array(trim(name), ' '))[2] || ' ' || (string_to_array(trim(name), ' '))[1]
          ELSE name
        END AS name,
        avatar
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const authorResult = await this.db.client.query(authorSql, [userId]);
    const author = authorResult.rows[0] as { name?: string | null; avatar?: string | null } | undefined;

    return {
      ...memory,
      author_name: author?.name ?? null,
      author_avatar: author?.avatar ?? null,
    };
  }

  async likeComment(userId: number, commentId: number): Promise<{ success: true; likes: number; liked: boolean }> {
    const commentSql = `
      SELECT
        c.id,
        c.memory_id,
        c.likes,
        mem.memorial_id
      FROM comments c
      JOIN memories mem ON mem.id = c.memory_id
      JOIN memorials m ON m.id = mem.memorial_id
      WHERE c.id = $1
      LIMIT 1
    `;
    const commentResult = await this.db.client.query(commentSql, [commentId]);
    const comment = commentResult.rows[0] as
      | {
          id: number;
          memory_id: number;
          likes: number;
          memorial_id: number;
        }
      | undefined;

    if (!comment) {
      throw new NotFoundException("Комментарий не найден");
    }

    await this.canUserViewMemorial(comment.memorial_id, userId);

    // Проверяем, есть ли уже лайк от этого пользователя
    const existingLikeSql = `
      SELECT 1
      FROM comment_likes
      WHERE comment_id = $1 AND user_id = $2
      LIMIT 1
    `;
    const existingLikeResult = await this.db.client.query(existingLikeSql, [commentId, userId]);
    const hasLike = existingLikeResult.rows.length > 0;

    if (hasLike) {
      // Удаляем лайк
      await this.db.client.query(
        `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
        [commentId, userId]
      );
      const newLikes = Math.max(0, comment.likes - 1);
      await this.db.client.query(
        `UPDATE comments SET likes = $1 WHERE id = $2`,
        [newLikes, commentId]
      );
      return { success: true, likes: newLikes, liked: false };
    } else {
      // Добавляем лайк
      await this.db.client.query(
        `INSERT INTO comment_likes (comment_id, user_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
        [commentId, userId]
      );
      const newLikes = comment.likes + 1;
      await this.db.client.query(
        `UPDATE comments SET likes = $1 WHERE id = $2`,
        [newLikes, commentId]
      );
      return { success: true, likes: newLikes, liked: true };
    }
  }

  async likeMemory(userId: number, memoryId: number): Promise<{ success: true; likes: number; liked: boolean }> {
    const memorySql = `
      SELECT
        mem.id,
        mem.memorial_id,
        mem.likes
      FROM memories mem
      WHERE mem.id = $1
      LIMIT 1
    `;
    const memoryResult = await this.db.client.query(memorySql, [memoryId]);
    const memory = memoryResult.rows[0] as
      | {
          id: number;
          memorial_id: number;
          likes: number;
        }
      | undefined;

    if (!memory) {
      throw new NotFoundException("Воспоминание не найдено");
    }

    await this.canUserViewMemorial(memory.memorial_id, userId);

    // Проверяем, есть ли уже лайк от этого пользователя
    const existingLikeSql = `
      SELECT 1
      FROM memory_likes
      WHERE memory_id = $1 AND user_id = $2
      LIMIT 1
    `;
    const existingLikeResult = await this.db.client.query(existingLikeSql, [memoryId, userId]);
    const hasLike = existingLikeResult.rows.length > 0;

    if (hasLike) {
      // Удаляем лайк
      await this.db.client.query(
        `DELETE FROM memory_likes WHERE memory_id = $1 AND user_id = $2`,
        [memoryId, userId]
      );
      const newLikes = Math.max(0, memory.likes - 1);
      await this.db.client.query(
        `UPDATE memories SET likes = $1 WHERE id = $2`,
        [newLikes, memoryId]
      );
      return { success: true, likes: newLikes, liked: false };
    } else {
      // Добавляем лайк
      await this.db.client.query(
        `INSERT INTO memory_likes (memory_id, user_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
        [memoryId, userId]
      );
      const newLikes = memory.likes + 1;
      await this.db.client.query(
        `UPDATE memories SET likes = $1 WHERE id = $2`,
        [newLikes, memoryId]
      );
      return { success: true, likes: newLikes, liked: true };
    }
  }

  async createComment(userId: number, memoryId: number, content: string): Promise<CreatedCommentDto> {
    if (!(await this.isCommentsEnabled())) {
      throw new Error("Комментарии временно отключены");
    }

    const normalizedContent = this.normalizeString(content);
    if (!normalizedContent || normalizedContent.length > 500) {
      throw new Error("Комментарий должен содержать от 1 до 500 символов");
    }

    const memorySql = `
      SELECT
        mem.id,
        mem.memorial_id,
        m.user_id AS memorial_owner_id,
        COALESCE(m.allow_comments, true) AS allow_comments
      FROM memories mem
      JOIN memorials m ON m.id = mem.memorial_id
      WHERE mem.id = $1
      LIMIT 1
    `;
    const memoryResult = await this.db.client.query(memorySql, [memoryId]);
    const memory = memoryResult.rows[0] as
      | {
          id: number;
          memorial_id: number;
          memorial_owner_id: number;
          allow_comments: boolean;
        }
      | undefined;

    if (!memory) {
      throw new NotFoundException("Воспоминание не найдено");
    }

    await this.canUserViewMemorial(memory.memorial_id, userId);

    if (!memory.allow_comments) {
      throw new Error("Комментарии отключены владельцем мемориала");
    }

    const insertSql = `
      INSERT INTO comments (memory_id, user_id, content, likes, created_at, updated_at)
      VALUES ($1, $2, $3, 0, NOW(), NOW())
      RETURNING id, memory_id, user_id, content, likes, created_at::text
    `;
    const inserted = await this.db.client.query(insertSql, [memoryId, userId, normalizedContent]);
    const comment = inserted.rows[0] as
      | {
          id: number;
          memory_id: number;
          user_id: number;
          content: string;
          likes: number;
          created_at: string;
        }
      | undefined;

    if (!comment) {
      throw new Error("Не удалось добавить комментарий");
    }

    const authorSql = `
      SELECT 
        CASE 
          WHEN name IS NULL THEN NULL
          WHEN array_length(string_to_array(trim(name), ' '), 1) = 3 THEN 
            (string_to_array(trim(name), ' '))[2] || ' ' || (string_to_array(trim(name), ' '))[1] || ' ' || (string_to_array(trim(name), ' '))[3]
          WHEN array_length(string_to_array(trim(name), ' '), 1) = 2 THEN 
            (string_to_array(trim(name), ' '))[2] || ' ' || (string_to_array(trim(name), ' '))[1]
          ELSE name
        END AS name,
        avatar
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const authorResult = await this.db.client.query(authorSql, [userId]);
    const author = authorResult.rows[0] as { name?: string | null; avatar?: string | null } | undefined;

    return {
      ...comment,
      author_name: author?.name ?? null,
      author_avatar: author?.avatar ?? null,
    };
  }

  async getMemoryViews(memoryId: number): Promise<{ views: number }> {
    const memorySql = `
      SELECT views
      FROM memories
      WHERE id = $1
      LIMIT 1
    `;
    const result = await this.db.client.query(memorySql, [memoryId]);
    const views = result.rows[0]?.views ?? 0;
    return { views: typeof views === 'string' ? Number(views) : Number(views) };
  }

  async incrementMemoryView(memoryId: number, userId: number): Promise<{ success: true; views: number }> {
    // Получаем информацию о воспоминании
    const memorySql = `
      SELECT
        mem.id,
        mem.memorial_id,
        mem.user_id,
        mem.views
      FROM memories mem
      WHERE mem.id = $1
      LIMIT 1
    `;
    const memoryResult = await this.db.client.query(memorySql, [memoryId]);
    const memory = memoryResult.rows[0] as
      | {
          id: number;
          memorial_id: number;
          user_id: number | string;
          views: number | string;
        }
      | undefined;

    if (!memory) {
      throw new NotFoundException("Воспоминание не найдено");
    }

    // Получаем информацию о мемориале для проверки доступа и автора
    const memorialSql = `
      SELECT id, status, privacy, user_id
      FROM memorials
      WHERE id = $1
      LIMIT 1
    `;
    const memorialResult = await this.db.client.query(memorialSql, [memory.memorial_id]);
    const memorial = memorialResult.rows[0] as
      | {
          id: number;
          status: string;
          privacy: string;
          user_id: number | string;
        }
      | undefined;

    if (!memorial) {
      throw new NotFoundException("Мемориал не найден");
    }

    // Проверяем доступ к мемориалу (пользователь должен быть авторизован)
    await this.canUserViewMemorial(memory.memorial_id, userId);

    // Не считаем просмотры от автора воспоминания или автора мемориала
    const memoryUserId = typeof memory.user_id === 'string' ? Number(memory.user_id) : Number(memory.user_id);
    const normalizedUserId = typeof userId === 'string' ? Number(userId) : Number(userId);
    
    // Проверяем автора воспоминания
    if (Number.isFinite(memoryUserId) && Number.isFinite(normalizedUserId) && memoryUserId === normalizedUserId) {
      const currentViews = typeof memory.views === 'string' ? Number(memory.views) : Number(memory.views);
      return { success: true, views: currentViews };
    }
    
    // Проверяем автора мемориала
    const memorialUserId = typeof memorial.user_id === 'string' ? Number(memorial.user_id) : Number(memorial.user_id);
    if (Number.isFinite(memorialUserId) && Number.isFinite(normalizedUserId) && memorialUserId === normalizedUserId) {
      const currentViews = typeof memory.views === 'string' ? Number(memory.views) : Number(memory.views);
      return { success: true, views: currentViews };
    }

    // Увеличиваем счетчик просмотров
    const updateSql = `
      UPDATE memories
      SET views = COALESCE(views, 0) + 1
      WHERE id = $1
      RETURNING views
    `;
    const updateResult = await this.db.client.query(updateSql, [memoryId]);
    const newViews = typeof updateResult.rows[0].views === 'string' 
      ? Number(updateResult.rows[0].views) 
      : Number(updateResult.rows[0].views);

    return { success: true, views: newViews };
  }

  async deleteMemory(userId: number, memoryId: number): Promise<void> {
    const memorySql = `
      SELECT
        mem.id,
        mem.user_id,
        mem.memorial_id,
        mem.media::jsonb AS media
      FROM memories mem
      WHERE mem.id = $1
      LIMIT 1
    `;
    const memoryResult = await this.db.client.query(memorySql, [memoryId]);
    const memory = memoryResult.rows[0] as
      | {
          id: number;
          user_id: number | string;
          memorial_id: number;
          media: unknown;
        }
      | undefined;

    if (!memory) {
      throw new NotFoundException("Воспоминание не найдено");
    }

    // Проверяем, что пользователь является автором воспоминания
    const memoryUserId = typeof memory.user_id === 'string' ? Number(memory.user_id) : Number(memory.user_id);
    const currentUserId = Number(userId);
    
    if (!Number.isFinite(memoryUserId) || !Number.isFinite(currentUserId) || memoryUserId !== currentUserId) {
      throw new UnauthorizedException("Вы не можете удалить это воспоминание");
    }

    // Удаляем медиа файлы из S3
    if (memory.media && Array.isArray(memory.media)) {
      for (const item of memory.media) {
        if (typeof item === "object" && item !== null && "url" in item) {
          const url = String(item.url || "");
          if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
            try {
              // Удаляем файл из S3 (опционально, можно оставить для экономии места)
              // await this.storageService.deleteFile(url);
            } catch (error) {
              console.error(`[MemorialsService] Failed to delete media file ${url}:`, error);
              // Не блокируем удаление воспоминания, если не удалось удалить файл
            }
          }
        }
      }
    }

    // Удаляем лайки воспоминания
    await this.db.client.query(`DELETE FROM memory_likes WHERE memory_id = $1`, [memoryId]);

    // Удаляем комментарии и их лайки
    const commentsResult = await this.db.client.query(
      `SELECT id FROM comments WHERE memory_id = $1`,
      [memoryId]
    );
    const commentIds = commentsResult.rows.map((row) => Number(row.id));
    if (commentIds.length > 0) {
      await this.db.client.query(
        `DELETE FROM comment_likes WHERE comment_id = ANY($1::int[])`,
        [commentIds]
      );
    }
    await this.db.client.query(`DELETE FROM comments WHERE memory_id = $1`, [memoryId]);

    // Удаляем само воспоминание
    await this.db.client.query(`DELETE FROM memories WHERE id = $1`, [memoryId]);
  }

  private toPublicMediaUrl(path: string): string {
    const trimmedPath = path.trim();
    if (trimmedPath === "") {
      return "";
    }

    // Если уже полный URL - возвращаем как есть
    if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
      return trimmedPath;
    }

    // Преобразуем относительный путь в полный URL через S3
    const S3_BASE_URL = process.env.S3_PUBLIC_URL || "https://s3.firstvds.ru/memory";
    return `${S3_BASE_URL.replace(/\/$/, "")}/${trimmedPath.replace(/^\//, "")}`;
  }
}
