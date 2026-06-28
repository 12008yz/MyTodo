# MyTodo — «Новая глава»

PWA-приложение для контроля привычек: светлая сторона (рост) и тёмная сторона (отказ от вредного).

## Документация

- [Техническое задание](docs/TZ.md) — полное ТЗ
- [План backend](docs/BACKEND-PLAN.md) — ✅ v1.0 (блоки 1–14)
- [План frontend](docs/FRONTEND-PLAN.md) — 🚧 в работе
- [Справочник API](docs/API.md)

## Статус

| Слой | Статус |
| ---- | ------ |
| Backend API + worker | ✅ v1.0 |
| Frontend PWA (`apps/web`) | 🚧 блок 0 ✅, auth 🚧 |
| Admin UI (`apps/admin`) | ⏳ после MVP web |

Monorepo: `apps/api`, `apps/web`, `packages/shared`, `packages/domain`.

### Быстрый старт

**Нужно:** Node.js 22, Docker Desktop (запущен).

```bash
# 1. Postgres (порт 5433) + Redis (порт 6380)
docker compose up -d

# 2. Зависимости (первый раз)
npx pnpm install

# 3. Переменные окружения (первый раз)
copy .env.example .env

# 4. Seed (тестовые пользователи и уроки)
npx pnpm seed

# 5. Dev: API + web
npx pnpm dev

# 6. Worker (отдельный терминал — автозакрытие дня 23:59)
npx pnpm worker

# 7. Тесты
npx pnpm test
```

- API: `http://localhost:3000/api/v1/health`
- Web: `http://localhost:5173` (proxy `/api` → API)

**Без API (только браузер):** `npx pnpm dev:demo` — демо-режим, данные в localStorage.

**С API и Docker:** `npx pnpm dev` — демо-баннер и кнопка «Открыть демо» не показываются.

**Seed-аккаунты:** `demo@novayaglava.local` / `demo1234`, `trial@novayaglava.local` / `trial1234`, `admin@novayaglava.local` / `admin1234`

> Порты **5433** и **6380** — чтобы не конфликтовать с локальным PostgreSQL/Redis на Windows (стандартные 5432/6379).

### Деплой frontend на Vercel

1. **Root Directory** в Vercel: корень репо (`.`) или `apps/web` — оба варианта поддержаны через `vercel.json`.
2. **Environment Variable:** `VITE_API_URL` = URL вашего API (например `https://api.example.com`). Без неё auth не заработает — proxy есть только в dev.
3. Build: `pnpm turbo build --filter=@mytodo/web` (только web + shared, **не** api).
4. Push в `main` → redeploy.

