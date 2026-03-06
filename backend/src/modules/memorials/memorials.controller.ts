import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { MemorialsService, type UpsertMemorialInput } from "./memorials.service";
import { AuthService } from "../auth/auth.service";
import { getAuthToken } from "../../common/auth-cookie";
import type { Express, Request, Response } from "express";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { StorageService } from "../../common/storage.service";
import { createHash } from "node:crypto";

type UploadedMemorialFiles = {
  photo?: Express.Multer.File[];
  media_photos?: Express.Multer.File[];
  media_videos?: Express.Multer.File[];
  burial_photos?: Express.Multer.File[];
  military_files?: Express.Multer.File[];
  achievement_files?: Express.Multer.File[];
};

type UploadedMemoryFiles = {
  media?: Express.Multer.File[];
};

class CreateMemoryDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  relationship_type?: string;

  @IsOptional()
  @IsString()
  relationship_custom?: string;
}

class CreateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;
}

@Controller("memorials")
export class MemorialsController {
  constructor(
    private readonly memorialsService: MemorialsService,
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  private async requireUser(req: Request) {
    const token = getAuthToken(req);
    if (!token) {
      throw new UnauthorizedException("Не авторизован");
    }
    const user = await this.authService.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }
    return user;
  }

  private toBoolean(value: unknown, defaultValue = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "on", "yes"].includes(normalized)) return true;
      if (["0", "false", "off", "no"].includes(normalized)) return false;
    }
    return defaultValue;
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  }

  private toNumberOrNullable(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const normalized = trimmed.replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private toStringArrayOrUndefined(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // keep as plain string
      }
      return [trimmed];
    }
    return undefined;
  }

  private mapInput(body: Record<string, unknown>): UpsertMemorialInput {
    const input: Record<string, unknown> = {
      first_name: String(body.first_name ?? ""),
      last_name: String(body.last_name ?? ""),
      birth_date: String(body.birth_date ?? ""),
      death_date: String(body.death_date ?? ""),
    };

    const stringFields: Array<keyof UpsertMemorialInput> = [
      "middle_name",
      "birth_place",
      "biography",
      "photo",
      "religion",
      "full_biography",
      "education_details",
      "career_details",
      "hobbies",
      "character_traits",
      "achievements",
      "military_service",
      "military_rank",
      "military_years",
      "military_details",
      "burial_city",
      "burial_place",
      "burial_address",
      "burial_location",
      "privacy",
      "action",
    ];

    for (const field of stringFields) {
      if (field in body) {
        const value = this.toStringOrUndefined(body[field]);
        if (value !== undefined) {
          input[field] = value;
        }
      }
    }

    if ("moderate_memories" in body) {
      input.moderate_memories = this.toBoolean(body.moderate_memories, false);
    }
    if ("allow_comments" in body) {
      input.allow_comments = this.toBoolean(body.allow_comments, true);
    }

    if ("burial_latitude" in body) {
      const value = this.toNumberOrNullable(body.burial_latitude);
      if (value !== undefined) {
        input.burial_latitude = value;
      }
    }

    if ("burial_longitude" in body) {
      const value = this.toNumberOrNullable(body.burial_longitude);
      if (value !== undefined) {
        input.burial_longitude = value;
      }
    }

    const arrayFields: Array<keyof UpsertMemorialInput> = [
      "military_conflicts",
      "media_photos",
      "media_videos",
      "burial_photos",
    ];

    for (const field of arrayFields) {
      if (field in body) {
        const value = this.toStringArrayOrUndefined(body[field]);
        if (value !== undefined) {
          input[field] = value;
        }
      }
    }

    if ("military_files" in body) {
      const raw = body.military_files;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            input.military_files = parsed;
          }
        } catch {
          // ignore parse error
        }
      } else if (Array.isArray(raw)) {
        input.military_files = raw;
      }
    }

    if ("achievement_files" in body) {
      const raw = body.achievement_files;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            input.achievement_files = parsed;
          }
        } catch {
          // ignore parse error
        }
      } else if (Array.isArray(raw)) {
        input.achievement_files = raw;
      }
    }

    return input as unknown as UpsertMemorialInput;
  }

  private extractIdempotencyKey(req: Request, body: Record<string, unknown>): string | null {
    const headerKey = req.header("idempotency-key");
    const bodyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
    const raw = String(headerKey || bodyKey || "").trim();
    if (!raw) return null;
    return raw.slice(0, 255);
  }

  private normalizeForHash(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForHash(item));
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, this.normalizeForHash(val)]);
      return Object.fromEntries(entries);
    }
    return value;
  }

  private buildCreateRequestHash(input: UpsertMemorialInput, files?: UploadedMemorialFiles): string {
    const filesMeta = Object.entries(files ?? {})
      .filter(([, list]) => Array.isArray(list) && list.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, list]) => ({
        field,
        files:
          (list ?? []).map((file) => ({
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          })) ?? [],
      }));

    const normalizedInput = this.normalizeForHash(input);
    const normalizedFiles = this.normalizeForHash(filesMeta);
    return createHash("sha256")
      .update(JSON.stringify({ input: normalizedInput, files: normalizedFiles }))
      .digest("hex");
  }

  private hasUploads(files?: UploadedMemorialFiles): boolean {
    if (!files) return false;
    return Object.values(files).some((list) => Array.isArray(list) && list.length > 0);
  }

  private async uploadForMemorial(
    memorialId: number,
    files: UploadedMemorialFiles | undefined,
    existing: {
      media_photos?: string[] | null;
      media_videos?: string[] | null;
      burial_photos?: string[] | null;
      military_files?: unknown[] | null;
      achievement_files?: unknown[] | null;
    } | null,
  ): Promise<Partial<UpsertMemorialInput>> {
    if (!files || !this.hasUploads(files)) {
      return {};
    }

    const patch: Partial<UpsertMemorialInput> = {};

    if (files.photo?.[0]) {
      patch.photo = await this.storageService.uploadMemorialMainPhoto(memorialId, files.photo[0]);
    }

    if (files.media_photos && files.media_photos.length > 0) {
      const uploaded = await Promise.all(
        files.media_photos.map((file) => this.storageService.uploadMemorialGalleryPhoto(memorialId, file)),
      );
      patch.media_photos = [...(existing?.media_photos ?? []), ...uploaded];
    }

    if (files.media_videos && files.media_videos.length > 0) {
      const uploaded = await Promise.all(
        files.media_videos.map((file) => this.storageService.uploadMemorialVideo(memorialId, file)),
      );
      patch.media_videos = [...(existing?.media_videos ?? []), ...uploaded];
    }

    if (files.burial_photos && files.burial_photos.length > 0) {
      const uploaded = await Promise.all(
        files.burial_photos.map((file) => this.storageService.uploadMemorialBurialPhoto(memorialId, file)),
      );
      patch.burial_photos = [...(existing?.burial_photos ?? []), ...uploaded];
    }

    if (files.military_files && files.military_files.length > 0) {
      const uploaded = await Promise.all(
        files.military_files.map(async (file) => ({
          path: await this.storageService.uploadMemorialMilitaryFile(memorialId, file),
          title: null,
        })),
      );
      patch.military_files = [...(existing?.military_files ?? []), ...uploaded];
    }

    if (files.achievement_files && files.achievement_files.length > 0) {
      const uploaded = await Promise.all(
        files.achievement_files.map(async (file) => ({
          path: await this.storageService.uploadMemorialAchievementFile(memorialId, file),
          title: null,
        })),
      );
      patch.achievement_files = [...(existing?.achievement_files ?? []), ...uploaded];
    }

    return patch;
  }

  @Get(":id/relationship")
  async getUserRelationship(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const relationship = await this.memorialsService.getUserRelationship(id, currentUser.id);
      return { hasRelationship: relationship !== null, relationship };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return { hasRelationship: false, relationship: null };
    }
  }

  @Get(":id/people")
  async getPeople(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    // Не требует авторизации - список близких людей доступен для всех
    const currentUser = await this.requireUser(req).catch(() => null);
    const userId = currentUser?.id ?? null;
    
    try {
      const people = await this.memorialsService.getPeople(id, userId);
      return { success: true, people };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось загрузить список близких людей";
      throw new BadRequestException(message);
    }
  }

  @Put(":id/relationship")
  async updateRelationship(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { relationship_type?: string; relationship_custom?: string },
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const relationshipType = typeof body.relationship_type === "string" && body.relationship_type.trim() ? body.relationship_type.trim() : null;
      const customRelationship = typeof body.relationship_custom === "string" && body.relationship_custom.trim() ? body.relationship_custom.trim() : null;
      await this.memorialsService.updateRelationship(id, currentUser.id, relationshipType, customRelationship);
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось обновить связь";
      throw new BadRequestException(message);
    }
  }

  @Get("sitemap")
  async getSitemapData() {
    return this.memorialsService.getSitemapData();
  }

  @Get("home")
  async getHome(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = await this.memorialsService.getHomeData();
    const rawBody = JSON.stringify(payload);
    const etag = `"${createHash("sha1").update(rawBody).digest("hex")}"`;

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("ETag", etag);

    const ifNoneMatchHeader = req.headers["if-none-match"];
    const ifNoneMatchRaw = Array.isArray(ifNoneMatchHeader)
      ? ifNoneMatchHeader.join(",")
      : String(ifNoneMatchHeader || "");
    const ifNoneMatchTags = ifNoneMatchRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (ifNoneMatchTags.includes("*") || ifNoneMatchTags.includes(etag)) {
      res.status(304);
      return;
    }

    return payload;
  }

  @Get("search")
  async search(
    @Req() req: Request,
    @Query("q") query: string | undefined,
    @Query("limit") limit: string | undefined,
  ) {
    const searchQuery = typeof query === "string" ? query.trim() : "";
    const searchLimit = limit ? Number(limit) : 10;
    
    if (!searchQuery || searchQuery.length < 2) {
      return { results: [] };
    }

    try {
      const results = await this.memorialsService.searchMemorials(searchQuery, searchLimit);
      return { results };
    } catch (error) {
      // Логирование ошибок через структурированный логгер
      if (error instanceof Error) {
        console.error(`[MemorialsController] Search error: ${error.message}`, error);
      } else {
        console.error("[MemorialsController] Search error:", error);
      }
      return { results: [] };
    }
  }

  @Get(":id")
  async findOne(@Req() req: Request, @Param("id", ParseIntPipe) id: number) {
    const currentUser = await this.requireUser(req).catch(() => null);
    const userId = currentUser?.id ?? null;
    return this.memorialsService.findOne(id, userId);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "photo", maxCount: 1 },
      { name: "media_photos", maxCount: 5 },
      { name: "media_videos", maxCount: 2 },
      { name: "burial_photos", maxCount: 10 },
      { name: "military_files", maxCount: 10 },
      { name: "achievement_files", maxCount: 10 },
    ]),
  )
  async create(
    @Req() req: Request,
    @Body() rawBody: Record<string, unknown>,
    @UploadedFiles() files?: UploadedMemorialFiles,
  ) {
    const currentUser = await this.requireUser(req);
    let idempotencyKey: string | null = null;
    let requestHash = "";
    let shouldClearIdempotency = false;
    try {
      const body = this.mapInput(rawBody);
      idempotencyKey = this.extractIdempotencyKey(req, rawBody);

      if (idempotencyKey) {
        requestHash = this.buildCreateRequestHash(body, files);
        const claim = await this.memorialsService.claimMemorialCreateIdempotency(
          currentUser.id,
          idempotencyKey,
          requestHash,
        );

        if (claim.state === "replay" && claim.response) {
          return claim.response;
        }
        if (claim.state === "in_progress") {
          throw new ConflictException(
            "Запрос на создание мемориала уже выполняется. Подождите и повторите попытку.",
          );
        }
        shouldClearIdempotency = true;
      }

      const created = await this.memorialsService.create(currentUser.id, body);
      const patch = await this.uploadForMemorial(created.id, files, null);
      let responsePayload: { success: true; memorial: Awaited<ReturnType<MemorialsService["create"]>> };

      if (Object.keys(patch).length === 0) {
        responsePayload = { success: true, memorial: created };
      } else {
        const memorial = await this.memorialsService.update(currentUser.id, created.id, {
          ...body,
          ...patch,
        });
        responsePayload = { success: true, memorial };
      }

      if (idempotencyKey) {
        await this.memorialsService.saveMemorialCreateIdempotencyResponse(
          currentUser.id,
          idempotencyKey,
          requestHash,
          responsePayload,
        );
        shouldClearIdempotency = false;
      }

      return responsePayload;
    } catch (error) {
      if (idempotencyKey && requestHash && shouldClearIdempotency) {
        await this.memorialsService
          .clearMemorialCreateIdempotency(currentUser.id, idempotencyKey, requestHash)
          .catch(() => undefined);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось создать мемориал";
      throw new BadRequestException(message);
    }
  }

  @Put(":id")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "photo", maxCount: 1 },
      { name: "media_photos", maxCount: 5 },
      { name: "media_videos", maxCount: 2 },
      { name: "burial_photos", maxCount: 10 },
      { name: "military_files", maxCount: 10 },
      { name: "achievement_files", maxCount: 10 },
    ]),
  )
  async update(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() rawBody: Record<string, unknown>,
    @UploadedFiles() files?: UploadedMemorialFiles,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const body = this.mapInput(rawBody);
      let existing;
      try {
        existing = await this.memorialsService.findOne(id);
      } catch (err) {
        // Если это NotFoundException, пробрасываем дальше
        if (err instanceof NotFoundException) {
          throw err;
        }
        // Для других ошибок логируем и пробрасываем как NotFoundException для безопасности
        console.error('[MemorialsController] Error fetching memorial:', err);
        throw new NotFoundException("Memorial not found");
      }
      if (!existing) {
        throw new NotFoundException("Memorial not found");
      }

      const patch = await this.uploadForMemorial(id, files, existing);
      const memorial = await this.memorialsService.update(currentUser.id, id, {
        ...body,
        ...patch,
      });
      return { success: true, memorial };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось обновить мемориал";
      throw new BadRequestException(message);
    }
  }

  @Post(":id/memories")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "media", maxCount: 10 },
    ]),
  )
  async createMemory(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateMemoryDto,
    @UploadedFiles() files?: UploadedMemoryFiles,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const content = typeof body.content === "string" ? body.content : "";
      const mediaFiles = files?.media ?? [];
      const relationshipType = typeof body.relationship_type === "string" && body.relationship_type.trim() ? body.relationship_type.trim() : null;
      const customRelationship = typeof body.relationship_custom === "string" && body.relationship_custom.trim() ? body.relationship_custom.trim() : null;
      const memory = await this.memorialsService.createMemory(
        currentUser.id,
        id,
        content,
        mediaFiles,
        relationshipType,
        customRelationship,
      );
      return { success: true, memory };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось добавить воспоминание";
      throw new BadRequestException(message);
    }
  }

  @Post("memories/:id/like")
  async likeMemory(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const result = await this.memorialsService.likeMemory(currentUser.id, id);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось поставить лайк";
      throw new BadRequestException(message);
    }
  }

  @Post("memories/:id/comments")
  async createComment(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateCommentDto,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const content = typeof body.content === "string" ? body.content : "";
      const comment = await this.memorialsService.createComment(currentUser.id, id, content);
      return { success: true, comment };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось добавить комментарий";
      throw new BadRequestException(message);
    }
  }

  @Post("memories/comments/:id/like")
  async likeComment(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      const result = await this.memorialsService.likeComment(currentUser.id, id);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось поставить лайк";
      throw new BadRequestException(message);
    }
  }

  @Delete("memories/:id")
  async deleteMemory(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    try {
      const currentUser = await this.requireUser(req);
      await this.memorialsService.deleteMemory(currentUser.id, id);
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Не удалось удалить воспоминание";
      throw new BadRequestException(message);
    }
  }

  @Post("memories/:id/view")
  async viewMemory(
    @Req() req: Request,
    @Param("id", ParseIntPipe) id: number,
  ) {
    // Требует авторизации - просмотры считаются только для авторизованных пользователей
    const currentUser = await this.requireUser(req).catch(() => null);
    
    if (!currentUser) {
      // Для неавторизованных пользователей возвращаем текущее значение без изменения
      // Чтобы не было ошибок в консоли, возвращаем 200 OK
      try {
        const memory = await this.memorialsService.getMemoryViews(id);
        return { success: true, views: memory.views };
      } catch {
        return { success: true, views: 0 };
      }
    }
    
    const userId = currentUser.id;
    
    try {
      const result = await this.memorialsService.incrementMemoryView(id, userId);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Не бросаем ошибку, чтобы не ломать UX - просто возвращаем текущее значение
      console.error("Failed to increment memory view:", error);
      return { success: false, views: 0 };
    }
  }
}
