import { Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Express } from "express";
import { randomUUID } from "crypto";
import { extname } from "path";

@Injectable()
export class StorageService {
  private readonly bucket = String(process.env.AWS_BUCKET || "").trim();
  private readonly endpoint = String(process.env.AWS_ENDPOINT || "").trim();
  private readonly region = String(process.env.AWS_DEFAULT_REGION || "ru-central1").trim();
  private readonly forcePathStyle = String(process.env.AWS_USE_PATH_STYLE_ENDPOINT || "false").toLowerCase() === "true";
  private readonly client: S3Client | null;

  constructor() {
    if (!this.bucket) {
      this.client = null;
      return;
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  get configured() {
    return this.client !== null && this.bucket.length > 0;
  }

  private safeExt(file: Express.Multer.File): string {
    const fromOriginal = extname(file.originalname || "").toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(fromOriginal)) {
      return fromOriginal;
    }

    const byMime: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/heic": ".heic",
      "image/heif": ".heif",
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "application/pdf": ".pdf",
    };

    return byMime[file.mimetype] ?? ".bin";
  }

  async upload(path: string, file: Express.Multer.File): Promise<string> {
    if (!this.client || !this.bucket) {
      throw new Error("S3 не настроен: отсутствует AWS_BUCKET");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
        // Делаем объект публично доступным, как в Laravel (Storage::put(..., 'public'))
        ACL: "public-read",
      }),
    );

    return path;
  }

  async uploadUserAvatar(userId: number, file: Express.Multer.File): Promise<string> {
    const path = `users/avatars/${userId}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialMainPhoto(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/main${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialGalleryPhoto(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/gallery/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialVideo(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/videos/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialBurialPhoto(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/burial/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialMilitaryFile(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/military/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemorialAchievementFile(memorialId: number, file: Express.Multer.File): Promise<string> {
    const path = `memorials/${memorialId}/achievements/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemoryPhoto(memoryId: number, file: Express.Multer.File): Promise<string> {
    const path = `memories/${memoryId}/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }

  async uploadMemoryVideo(memoryId: number, file: Express.Multer.File): Promise<string> {
    const path = `memories/${memoryId}/${randomUUID()}${this.safeExt(file)}`;
    return this.upload(path, file);
  }
}
