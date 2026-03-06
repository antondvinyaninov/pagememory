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

# Копируем собранные файлы и node_modules из builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/

COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder /app/frontend/package.json ./frontend/

# Создаем startup скрипт
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
# Запускаем backend в фоне\n\
cd /app/backend && node dist/main.js &\n\
BACKEND_PID=$!\n\
\n\
# Запускаем frontend в фоне\n\
cd /app/frontend && HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs &\n\
FRONTEND_PID=$!\n\
\n\
# Функция для graceful shutdown\n\
cleanup() {\n\
  echo "Stopping services..."\n\
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true\n\
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true\n\
  exit 0\n\
}\n\
\n\
trap cleanup SIGTERM SIGINT\n\
\n\
# Ждем завершения процессов\n\
wait\n\
' > /app/start.sh && chmod +x /app/start.sh

# Открываем порты
EXPOSE 4000 4321

# Запускаем оба приложения
CMD ["/app/start.sh"]
