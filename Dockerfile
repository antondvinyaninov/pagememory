# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS builder

# Установка зависимостей для сборки
WORKDIR /app

# Копируем package.json для обоих проектов
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Устанавливаем зависимости (включая dev для сборки)
RUN cd backend && npm ci
RUN cd frontend && npm ci

# Копируем исходный код
COPY backend ./backend
COPY frontend ./frontend

# Собираем backend
RUN cd backend && npm run build

# Собираем frontend с переменными окружения для production
# ВАЖНО: PUBLIC_API_BASE_URL должен быть полным URL для SSR
ENV PUBLIC_API_BASE_URL=http://127.0.0.1:4000/api
ENV PUBLIC_APP_URL=https://pagesofmemory.ru
ENV PUBLIC_S3_BASE_URL=https://s3.firstvds.ru/memory
ENV PUBLIC_SITE_NAME="Страницы памяти"
ENV PUBLIC_PROJECT_ICON_URL=/brand/memory-icon.png
ENV PUBLIC_YANDEX_MAPS_API_KEY=6645de69-1da7-468b-86da-59ced1a03485

RUN cd frontend && npm run build

# Production образ
FROM node:20-alpine

# Устанавливаем nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Копируем собранные файлы и node_modules из builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/

COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/package.json ./frontend/

# Копируем nginx конфиг
COPY nginx.conf /etc/nginx/nginx.conf

# Копируем startup скрипт
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Устанавливаем переменную для SSR запросов к backend
ENV API_BASE_URL=http://127.0.0.1:4000/api

# Открываем только порт 80 для nginx
EXPOSE 80

# Запускаем все сервисы
CMD ["/app/start.sh"]
