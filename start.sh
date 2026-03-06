#!/bin/sh
set -e

echo "Starting backend..."
cd /app/backend && node dist/main.js &
BACKEND_PID=$!

echo "Starting frontend..."
cd /app/frontend && HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs &
FRONTEND_PID=$!

# Функция для graceful shutdown
cleanup() {
  echo "Stopping services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGTERM SIGINT

echo "Both services started. Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID"

# Ждем завершения процессов
wait
