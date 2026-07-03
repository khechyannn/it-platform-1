#!/usr/bin/env bash
# Показать данные в PostgreSQL (читает DATABASE_URL из .env)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

URL="${DATABASE_URL:-postgres://platform:platform@localhost:5432/it_platform}"

echo "=== Подключение: $URL ==="
echo ""
echo "--- users ---"
psql "$URL" -c "SELECT id, name, role, email FROM users ORDER BY id;"
echo ""
echo "--- chat_rooms ---"
psql "$URL" -c "SELECT * FROM chat_rooms ORDER BY id;"
echo ""
echo "--- messages (последние 10) ---"
psql "$URL" -c "SELECT id, room_id, sender_id, left(text, 40) AS text, created_at, is_read FROM messages ORDER BY id DESC LIMIT 10;"
echo ""
echo "--- pull_requests ---"
psql "$URL" -c "SELECT * FROM pull_requests ORDER BY id;"
