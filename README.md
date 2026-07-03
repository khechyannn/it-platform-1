# it-platform-1

Стек: Node.js 22 LTS, PostgreSQL, Redis, Socket.io, Express

## Запуск

### Docker (одной командой)

```bash
cp .env.example .env
docker compose up --build
```

### Локально

```bash
cp .env.example .env
npm install
npm run setup:db   # один раз
npm run migrate
npm start
```

- Login: http://localhost:3000/login
- Chat: http://localhost:3000/chat

## Демо-логины

| Email | Пароль | Роль |
|-------|--------|------|
| alex@platform.local | mentor123 | mentor |
| sam@platform.local | junior123 | junior |
| maria@platform.local | mentor123 | mentor |
| dana@platform.local | junior123 | junior |

## Postman-коллекция

Файлы (оба одинаковые):

- `it-platform.postman_collection.json` — в корне проекта
- `postman/it-platform.postman_collection.json`

**Импорт:** Postman → Import → выбери файл из `~/Desktop/remote/`

**Порядок:**
1. `Auth → Login (Alex Mentor)` или `Login (Sam Junior)` — токен сохранится в `{{token}}`
2. Остальные запросы

## Проверка по ТЗ

### 1. Real-time чат `/chat`

| Требование | Статус |
|------------|--------|
| Socket.io WebSocket | ✅ |
| Комнаты: пара ментор–джун | ✅ |
| `message:send`, `message:read`, `user:typing`, `user:online` | ✅ |
| PostgreSQL: `messages` (id, room_id, sender_id, text, created_at, is_read) | ✅ |
| Redis: онлайн-статусы + pub/sub | ✅ |
| `GET /api/chat/rooms/` | ✅ |
| `GET /api/chat/rooms/{id}/messages/` + пагинация | ✅ |
| `PATCH /api/chat/messages/{id}/read/` | ✅ |
| Frontend: комнаты слева, чат справа | ✅ |
| Счётчик непрочитанных | ✅ |
| Индикатор «печатает...» | ✅ |
| Индикатор онлайн/офлайн | ✅ |

### 2. GitHub интеграция — автосинк PR

| Требование | Статус |
|------------|--------|
| `POST /api/webhooks/github/` | ✅ |
| `pull_request.opened/closed/merged` | ✅ |
| Верификация `X-Hub-Signature-256` | ✅ |
| Статусы: open / closed / merged | ✅ |
| Таблица `pull_requests` | ✅ |
| `GET /api/employees/{id}/pull-requests/` | ✅ |
| `POST /api/employees/{id}/pull-requests/` | ✅ |
| `PATCH /api/pull-requests/{id}/` | ✅ |

### Инфраструктура

| Требование | Статус |
|------------|--------|
| `docker-compose.yml` (Node + PostgreSQL + Redis) | ✅ |
| `.env.example` | ✅ |
| README + ngrok | ✅ |
| Postman-коллекция | ✅ |

### Дополнительно (не в ТЗ, но есть)

- Login (JWT) — нельзя подменить пользователя
- `npm run db:show` — посмотреть данные в PostgreSQL

## ngrok + GitHub Webhook

1. Запусти приложение
2. `ngrok http 3000`
3. GitHub → Settings → Webhooks → Add webhook:
   - URL: `https://<ngrok-url>/api/webhooks/github/`
   - Content type: `application/json`
   - Secret: `GITHUB_WEBHOOK_SECRET` из `.env`
   - Events: Pull requests

### Проверка webhook вручную

```bash
BODY='{"action":"opened","pull_request":{"id":1,"title":"Test","html_url":"https://github.com/o/r/pull/1","merged":false}}'
SECRET='your-github-webhook-secret'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST http://localhost:3000/api/webhooks/github/ \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
```

## PostgreSQL — где данные

- База: `it_platform`
- Таблицы: `users`, `chat_rooms`, `messages`, `pull_requests`
- Посмотреть: `npm run db:show`

## Структура

```
src/           — backend
public/        — login + chat
postman/       — коллекция Postman
it-platform.postman_collection.json  — копия в корне
docker-compose.yml
.env.example
```
