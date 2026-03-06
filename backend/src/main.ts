import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";
import * as cookieParser from "cookie-parser";
import * as compression from "compression";
import helmet from "helmet";
import { validateEnv } from "./common/env.validation";

dotenv.config();

// Валидация переменных окружения при старте
try {
  validateEnv();
} catch (error) {
  console.error("❌ Ошибка валидации переменных окружения:", error);
  process.exit(1);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "error", "warn"] });

  app.setGlobalPrefix("api");

  // Helmet - HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Отключаем для совместимости
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Для S3 изображений
    }),
  );

  // Разрешаем запросы с фронтенда (настраивается через CORS_ORIGINS)
  // По умолчанию для разработки разрешены localhost
  const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:4321,http://127.0.0.1:4321")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Глобальная валидация входных данных
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Удаляет свойства, которых нет в DTO
      forbidNonWhitelisted: true, // Выбрасывает ошибку, если есть лишние свойства
      transform: true, // Автоматически преобразует типы
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Нужно для req.cookies в /api/auth/me
  app.use(cookieParser());
  app.use(compression());

  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || "0.0.0.0";
  await app.listen(port, host);
  const protocol = process.env.PROTOCOL || "http";
  const domain = process.env.DOMAIN || `localhost:${port}`;
  console.log(`Nest backend is running on ${protocol}://${domain}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap Nest application", err);
});

