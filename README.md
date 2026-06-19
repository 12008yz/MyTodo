# MyTodo — «Новая глава»

PWA-приложение для контроля привычек: светлая сторона (рост) и тёмная сторона (отказ от вредного).

## Документация

- [Техническое задание](docs/TZ.md) — полное ТЗ
- [План backend](docs/BACKEND-PLAN.md) — блоки реализации API и worker

## Статус

**Блок 1 (фундамент)** — в работе.

Monorepo: `apps/api`, `packages/shared`, `packages/domain`.

### Быстрый старт

**Нужно:** Node.js 22, Docker Desktop (запущен).

```bash
# 1. Postgres (порт 5433) + Redis (порт 6380)
docker compose up -d

# 2. Зависимости (первый раз)
npx pnpm install

# 3. Переменные окружения (первый раз)
copy .env.example .env

# 4. API
npx pnpm dev

# 5. Тесты
npx pnpm test
```

Health: `GET http://localhost:3000/api/v1/health` → `{ "status": "ok", ... }`

> Порты **5433** и **6380** — чтобы не конфликтовать с локальным PostgreSQL/Redis на Windows (стандартные 5432/6379).
