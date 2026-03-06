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

# Собираем frontend
RUN cd frontend && npm run build

# Production образ
FROM node:20-alpine

WORKDIR /app

# Устанавливаем только production зависимости для runtime
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm ci --omit=dev
RUN cd frontend && npm ci --omit=dev

# Копируем собранные файлы
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/

COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/package.json ./frontend/

# Устанавливаем PM2 для управления процессами
RUN npm install -g pm2

# Создаем конфиг PM2 для запуска обоих приложений
RUN echo '{ \
  "apps": [ \
    { \
      "name": "backend", \
      "cwd": "/app/backend", \
      "script": "dist/main.js", \
      "instances": 1, \
      "exec_mode": "cluster", \
      "env": { \
        "NODE_ENV": "production" \
      } \
    }, \
    { \
      "name": "frontend", \
      "cwd": "/app/frontend", \
      "script": "dist/server/entry.mjs", \
      "instances": 1, \
      "exec_mode": "cluster", \
      "env": { \
        "NODE_ENV": "production", \
        "HOST": "0.0.0.0", \
        "PORT": "4321" \
      } \
    } \
  ] \
}' > /app/ecosystem.config.json

# Открываем порты
EXPOSE 4000 4321

# Запускаем оба приложения через PM2
CMD ["pm2-runtime", "start", "/app/ecosystem.config.json"]
