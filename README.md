# it-platform-1

Стек: Node.js 22 LTS, PostgreSQL, Redis, Socket.io, Express

## Задача — 2 крупные фичи

### 1. Real-time чат `/chat`

Чат между ментором и джуном внутри платформы.

Backend:
- WebSocket сервер через Socket.io
- Комнаты: каждая пара ментор-джун это отдельная комната
- События: message:send, message:read, user:typing, user:online
- PostgreSQL: хранить историю сообщений (id, room_id, sender_id, 
  text, created_at, is_read)
- Redis: онлайн-статусы пользователей, pub/sub для масштабирования

Эндпоинты REST:
- GET /api/chat/rooms/ — список чатов текущего пользователя
- GET /api/chat/rooms/{id}/messages/ — история сообщений с пагинацией
- PATCH /api/chat/messages/{id}/read/ — отметить прочитанным

Frontend (простой, без дизайна):
- Страница /chat — список комнат слева, переписка справа
- Счётчик непрочитанных на комнате
- Индикатор "печатает..."
- Индикатор онлайн/офлайн

### 2. GitHub интеграция — автосинк PR

Автоматическое обновление статусов PR в платформе 
через GitHub Webhooks.

Backend:
- POST /api/webhooks/github/ — эндпоинт для приёма событий
- Обработка событий: pull_request.opened, 
  pull_request.closed, pull_request.merged
- Верификация подписи webhook (X-Hub-Signature-256)
- Обновление статуса PR в БД: open / closed / merged
- PostgreSQL: таблица pull_requests (id, employee_id, 
  title, url, status, github_pr_id, updated_at)

Эндпоинты REST:
- GET /api/employees/{id}/pull-requests/ — PR конкретного сотрудника
- POST /api/employees/{id}/pull-requests/ — добавить PR вручную
- PATCH /api/pull-requests/{id}/ — обновить статус вручную

Требования:
- docker-compose.yml — Node.js + PostgreSQL + Redis одной командой
- .env.example с нужными переменными
- README с инструкцией как настроить GitHub Webhook локально 
  через ngrok
- Postman-коллекция с примерами запросов
