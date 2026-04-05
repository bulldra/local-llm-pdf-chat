#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# 既存プロセスをクリア
echo "Cleaning up existing processes..."
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
lsof -ti :5174 | xargs kill -9 2>/dev/null || true
sleep 1

cleanup() {
  echo "Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Starting backend (port 5174)..."
uv run python "$ROOT/backend/src/render_server.py" &
BACKEND_PID=$!

# バックエンドのポート起動待ち
for i in $(seq 1 20); do
  if nc -z localhost 5174 2>/dev/null; then
    break
  fi
  sleep 0.5
done

echo "Starting frontend (port 5173)..."
cd "$ROOT/frontend" && bun dev --port 5173 &
FRONTEND_PID=$!

echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop."
wait
