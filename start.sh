#!/bin/sh

echo "=== Starting services ==="

# Запускаем backend в фоне
echo "Starting backend on port 4000..."
cd /app/backend && node dist/main.js &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Даем backend время запуститься
sleep 2

# Запускаем frontend в фоне
echo "Starting frontend on port 4321..."
cd /app/frontend && HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Даем frontend время запуститься
sleep 2

# Запускаем nginx
echo "Starting nginx on port 80..."
nginx -g 'daemon off;' &
NGINX_PID=$!
echo "Nginx started with PID: $NGINX_PID"

# Функция для graceful shutdown
cleanup() {
  echo "=== Received shutdown signal ==="
  echo "Stopping nginx (PID: $NGINX_PID)..."
  kill $NGINX_PID 2>/dev/null || true
  echo "Stopping backend (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null || true
  echo "Stopping frontend (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID 2>/dev/null || true
  wait $NGINX_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo "=== Services stopped ==="
  exit 0
}

trap cleanup SIGTERM SIGINT

echo "=== All services running ==="
echo "Nginx: http://0.0.0.0:80"
echo "  - Frontend: /"
echo "  - Backend API: /api"
echo "Waiting for processes..."

# Ждем завершения процессов
wait
