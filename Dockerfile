# Multi-stage build
FROM node:20-alpine AS builder

# Устанавливаем шрифты для поддержки кириллицы
RUN apk add --no-cache \
    fontconfig \
    ttf-dejavu \
    font-noto \
    font-noto-cjk

WORKDIR /app

# Копируем все файлы
COPY . .

# Устанавливаем зависимости и собираем backend
RUN cd backend && npm ci && npm run build

# Устанавливаем зависимости и собираем frontend с переменными
RUN cd frontend && npm ci && \
    PUBLIC_API_BASE_URL=/api \
    PUBLIC_APP_URL=https://pagesofmemory.ru \
    PUBLIC_S3_BASE_URL=https://s3.firstvds.ru/memory \
    PUBLIC_SITE_NAME="Страницы памяти" \
    PUBLIC_PROJECT_ICON_URL=/brand/memory-icon.png \
    PUBLIC_YANDEX_MAPS_API_KEY=6645de69-1da7-468b-86da-59ced1a03485 \
    npm run build

# Production образ
FROM node:20-alpine

# Устанавливаем шрифты для поддержки кириллицы в Sharp
RUN apk add --no-cache \
    nginx \
    fontconfig \
    ttf-dejavu \
    font-noto \
    font-noto-cjk

WORKDIR /app

# Копируем собранные файлы
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/

COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/package.json ./frontend/

# Копируем конфиги
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Runtime переменные для SSR
ENV API_BASE_URL=http://127.0.0.1:4000/api
ENV PUBLIC_API_BASE_URL=/api

EXPOSE 80

CMD ["/app/start.sh"]
