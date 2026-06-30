# Настройка проекта на новом компьютере

Инструкция для дома, работы или любой новой машины. Файлы с секретами (`.env`) **не хранятся в git** — их нужно создать вручную на каждом ПК.

---

## 1. Что установить

| Программа | Версия | Зачем |
|-----------|--------|--------|
| **Node.js** | 22+ | API и фронт |
| **pnpm** | 9.x | менеджер пакетов (через Corepack, см. ниже) |
| **Docker Desktop** | актуальная | Postgres + Redis (только для полного режима `pnpm dev`) |
| **Git** | любая | клонирование репозитория |

### pnpm на Windows

Если команда `pnpm` не находится:

```powershell
corepack enable
```

Перезапусти терминал. Либо всегда используй:

```powershell
corepack pnpm install
corepack pnpm dev
```

---

## 2. Клонирование и зависимости

```powershell
cd C:\project
git clone <url-репозитория> todo
cd todo

corepack enable
corepack pnpm install
```

Если репозиторий уже есть — только обновление:

```powershell
cd C:\project\todo
git pull
corepack pnpm install
```

---

## 3. Переменные окружения (главное)

### Где лежит `.env`

| Файл | Нужен? | Описание |
|------|--------|----------|
| **`apps/api/.env`** | **Да** (создать самому) | API, GigaChat, БД, JWT |
| `apps/api/.env.example` | шаблон в git | копируешь в `.env` |
| корневой `.env` | нет | API его **не читает** |
| `apps/web/.env` | обычно нет | локально proxy сам ходит на API |

### Создание файла

```powershell
cd apps\api
copy .env.example .env
notepad .env
```

### Полный пример `apps/api/.env` для локальной разработки

```env
# --- Обязательные для API ---
NODE_ENV=development
PORT=3000

# Postgres (docker compose, порт 5433)
DATABASE_URL=postgresql://mytodo:mytodo@localhost:5433/mytodo

# Redis (docker compose, порт 6380)
REDIS_URL=redis://localhost:6380

# JWT (для dev можно оставить как в примере; на проде — длинные случайные строки)
JWT_ACCESS_SECRET=dev-access-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me

# --- GigaChat (чат «Поговорить» с нейросетью) ---
# Authorization key из кабинета developers.sber.ru (см. раздел 4)
# Без ключа чат работает на шаблонах (source: "template")
GIGACHAT_CREDENTIALS=

# Сертификат Минцифры уже в репо; менять не нужно, если не переносишь файл
# GIGACHAT_CA_CERT=./certs/russian_trusted_root_ca.cer

# --- Опционально (можно оставить пустым в dev) ---
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
SENTRY_DSN=
```

### Таблица всех ключей API

| Переменная | Обязательна | Что это |
|------------|-------------|---------|
| `NODE_ENV` | да | `development` / `test` / `production` |
| `PORT` | да | порт API, по умолчанию `3000` |
| `DATABASE_URL` | да* | строка подключения PostgreSQL |
| `REDIS_URL` | да* | строка подключения Redis |
| `JWT_ACCESS_SECRET` | да* | секрет access-токенов (мин. 16 символов) |
| `JWT_REFRESH_SECRET` | да* | секрет refresh-токенов |
| `GIGACHAT_CREDENTIALS` | нет | Authorization key GigaChat (base64) |
| `GIGACHAT_CA_CERT` | нет | путь к `.cer`; по умолчанию `apps/api/certs/russian_trusted_root_ca.cer` |
| `VAPID_PUBLIC_KEY` | нет | Web Push (публичный) |
| `VAPID_PRIVATE_KEY` | нет | Web Push (приватный) |
| `YUKASSA_SHOP_ID` | нет | оплата ЮKassa |
| `YUKASSA_SECRET_KEY` | нет | оплата ЮKassa |
| `SENTRY_DSN` | нет | мониторинг ошибок |

\* В `development` и `test` подставляются dev-значения по умолчанию, если не заданы.

### Переменные фронта (`apps/web`) — только для деплоя

| Переменная | Когда | Что это |
|------------|-------|---------|
| `VITE_API_URL` | прод / Vercel | URL API без `/api` (например `https://api.example.com`) |
| `VITE_DEMO_MODE` | статический демо-деплой | `true` — всё в браузере, без сервера |
| `VITE_VAPID_PUBLIC_KEY` | push в проде | тот же публичный ключ, что `VAPID_PUBLIC_KEY` на API |

Локально при `pnpm dev` **ничего в `apps/web/.env` не нужно** — Vite проксирует `/api` на `localhost:3000`.

---

## 4. GigaChat — пошагово

Нужен для **живого** диалога в кнопке «Поговорить». Без ключа ответы идут из встроенных шаблонов.

### 4.1. Регистрация

1. Зайди на [developers.sber.ru](https://developers.sber.ru) под **Sber ID**.
2. Создай проект → подключи **GigaChat API**.
3. Scope для физлиц: **`GIGACHAT_API_PERS`** (~1 млн токенов в год).

### 4.2. Получить ключ

В проекте → **Данные для авторизации**:

- **Client ID** — в `.env` не кладётся отдельно.
- Нажми **«Получить ключ»** → скопируй **Authorization key**.

Это строка **base64** вида:

```text
MDE5ZjE3NWQtOTk5Mi03ZGM0LTlkZDgtNzIyNTJmOTEyNzRhOmYwMDFjMGFlLWRlMTUtNDIyMS1iYjkzLWZiZmQxNWM2ZWU0Zg==
```

Внутри — `ClientID:ClientSecret`, уже закодированные. **Не добавляй** префикс `Basic `.

### 4.3. Вставить в `.env`

```env
GIGACHAT_CREDENTIALS=ВСТАВЬ_СЮДА_AUTHORIZATION_KEY
```

### 4.4. Проверка

```powershell
cd C:\project\todo
corepack pnpm --filter @mytodo/api test:gigachat
```

Успех: в консоли `GigaChat reply: ...`

### 4.5. TLS на Windows / macOS

Сбер использует корневой сертификат Минцифры. В репозитории уже есть:

`apps/api/certs/russian_trusted_root_ca.cer`

API подхватывает его автоматически. Если OAuth всё равно падает — скачай сертификат с [gosuslugi.ru/crt](https://www.gosuslugi.ru/crt) и укажи путь в `GIGACHAT_CA_CERT`.

### 4.6. Безопасность

- **Не коммить** `.env` и **не отправляй** ключ в чаты / скриншоты.
- Если ключ засветился — **перевыпусти** в кабинете Sber.
- На работе и дома можно использовать **один** ключ или разные проекты — как удобно.

---

## 5. Режимы запуска

### A. Демо (проще всего, без Docker)

```powershell
cd C:\project\todo
corepack pnpm dev:demo
```

| | |
|---|---|
| URL | http://localhost:5173 |
| API | не нужен |
| Данные | localStorage в браузере |
| Чат | шаблоны (не GigaChat) |
| Вход | демо-аккаунт подставляется автоматически |

### B. Полный режим (API + БД + GigaChat)

```powershell
cd C:\project\todo

# 1. База и Redis
docker compose up -d

# 2. Миграции (первый раз или после обновления схемы)
corepack pnpm db:migrate

# 3. Тестовые пользователи (первый раз)
corepack pnpm seed

# 4. API + web
corepack pnpm dev
```

| Сервис | URL |
|--------|-----|
| Web | http://localhost:5173 |
| API health | http://localhost:3000/api/v1/health |
| Postgres | `localhost:5433` (user/pass/db: `mytodo`) |
| Redis | `localhost:6380` |

**Worker** (закрытие дня, push) — отдельный терминал:

```powershell
corepack pnpm worker
```

### Seed-аккаунты (после `pnpm seed`)

| Email | Пароль |
|-------|--------|
| `demo@novayaglava.local` | `demo1234` |
| `trial@novayaglava.local` | `trial1234` |
| `admin@novayaglava.local` | `admin1234` |

---

## 6. Чат «Поговорить»

| Условие | Поведение |
|---------|-----------|
| `pnpm dev:demo` | шаблоны, лимит 5 сообщений/день |
| `pnpm dev` без `GIGACHAT_CREDENTIALS` | шаблоны через API |
| `pnpm dev` + ключ в `apps/api/.env` | ответы GigaChat (`source: "gigachat"`) |

Кнопка есть у тёмных привычек: **курение, сахар, сладости, грызение ногтей** (не у соцсетей).

---

## 7. Синхронизация работа ↔ дом

1. **На работе** перед уходом: закоммить и запушить изменения (код без `.env`).
2. **Дома**: `git pull` + `corepack pnpm install`.
3. **Дома**: создать `apps/api/.env` (или скопировать содержимое в менеджер паролей / флешку — **не в git**).
4. GigaChat-ключ можно тот же или новый из кабинета Sber.

---

## 8. Частые проблемы

| Проблема | Решение |
|----------|---------|
| `pnpm` не найден | `corepack enable` или `corepack pnpm ...` |
| `ECONNREFUSED :5433` | `docker compose up -d`, Docker Desktop запущен |
| Чат всегда одни шаблоны | проверь `GIGACHAT_CREDENTIALS`, перезапусти API, не используй `dev:demo` |
| `GigaChat OAuth failed` | проверь ключ; на Windows — сертификат в `apps/api/certs/` |
| `loadDemoState is not defined` | обнови код (`git pull`) — исправлено |
| Ошибки `chrome-extension://...` | отключи расширение браузера (Google Input Tools и т.п.) |
| Нижнее меню перекрывает чат | обнови код — чат на весь экран |

---

## 9. Полезные команды

```powershell
corepack pnpm test                              # все тесты
corepack pnpm --filter @mytodo/api test:gigachat # только GigaChat
corepack pnpm --filter @mytodo/web dev:demo     # только фронт-демо
corepack pnpm db:studio                         # просмотр БД в браузере
corepack pnpm lint                              # проверка типов
```

---

## 10. Чеклист «первый запуск дома»

- [ ] Node 22+, `corepack enable`
- [ ] `git pull` + `corepack pnpm install`
- [ ] `apps/api/.env` из `apps/api/.env.example`
- [ ] `GIGACHAT_CREDENTIALS` (если нужна нейросеть)
- [ ] `corepack pnpm --filter @mytodo/api test:gigachat` — OK
- [ ] Либо `corepack pnpm dev:demo`, либо Docker + `corepack pnpm dev`

Справочник эндпоинтов: [API.md](./API.md).
