# План реализации Backend

**Проект:** PWA «Новая глава»  
**Подход:** сначала весь backend, потом frontend  
**Связанный документ:** [TZ.md](./TZ.md)  
**Дата:** 19.06.2026 (ревизия 4)

---

## Как пользоваться этим планом

1. Блоки идут **строго по порядку** — каждый следующий опирается на предыдущие.
2. Внутри блока: **БД → shared (Zod) → domain (чистая логика) → сервисы → API → тесты**.
3. Блок **готов**, когда выполнены все «Критерии готовности».
4. Проверка: **Vitest + supertest** + ручные запросы (curl / Bruno / Postman).
5. Frontend **не начинаем** до закрытия блоков 1–14.

### Структура кода (ТЗ §16.4 + domain)

```
apps/api/              # Fastify, роуты, worker (BullMQ) — только I/O и оркестрация
packages/shared/       # Zod-схемы, типы, константы, ApiError
packages/domain/       # Чистая бизнес-логика (без БД, Redis, HTTP)
docker-compose.yml     # Postgres 16 + Redis
```

**Зависимости пакетов:** `apps/api` → `domain` + `shared`; `domain` → `shared` (только типы/константы, без Fastify/Drizzle).

### Сквозные правила

| Правило | ТЗ |
| ------- | -- |
| Префикс `/api/v1` | §18 |
| Zod из `packages/shared` | §15.1, §16 |
| Бизнес-логика в `packages/domain` | этот план |
| JWT access 15 мин + refresh 30 дней | §15.1 |
| «День» пользователя — в его `timezone`; в БД — UTC | §24.7 |
| Офлайн-конфликт → `409 Conflict` | §13, §24.3 |
| Worker/cron — **каждую минуту** (не раз в час) | §9.7 |
| `current_goal` — цель **на сегодня**; меняется только при закрытии дня | §3.1, §8.3 |
| `preview_next_goal` = `computeNextGoal(...)` из domain | §3.4, §8.3 |

### Ключевое правило прогрессии (не путать!)

| Действие | Когда | Что происходит |
| -------- | ----- | -------------- |
| `POST /checkins` | Сразу | Фиксируется `status` (`success` / `fail` / `skipped`) и `value` за **текущий** день |
| Прогрессия `current_goal` | **Только** при закрытии дня (worker, 23:59) | По итоговому статусу дня: success → ±step; fail/skipped → goal не меняется (кроме skipped светлой — goal не меняется) |
| Превью «цель завтра» | В API-ответах | `domain.computeNextGoal(habit, dayStatus)` — **та же функция**, что worker применит в 23:59; в БД **не** пишется до закрытия дня |

Чекин в блоке 4 **не** обновляет `current_goal`. Это делает worker в блоке 9.

### `packages/domain` — единый источник правды

Вся **чистая** бизнес-логика (без Drizzle, Redis, BullMQ, Fastify) живёт в `packages/domain`. Сервисы и worker **только** читают/пишут БД и вызывают функции domain.

| Модуль domain | Функции (примеры) | Кто вызывает |
| ------------- | ----------------- | ------------ |
| `habits/calibration` | `calibrateHabit(input)` | API блок 3 |
| `habits/checkin` | `resolveCheckinStatus(habit, value)`, `canSkipThisWeek(...)` | API блок 4 |
| `habits/progression` | **`computeNextGoal(habit, dayStatus)`** | API (`preview_next_goal`), worker (реальная смена `current_goal`) |
| `habits/day-close` | `closeDayForHabit(habit, checkin?, options)` | worker блок 9 |
| `english/progression` | **`computeNextEnglishDay(currentDay, dayStatus)`** | API (`preview_next_day`), worker (реальный `current_day + 1`) |
| `english/day-close` | `closeEnglishDay(progressToday?)` | worker блок 9 |
| `time/user-day` | `getUserLocalDate(utc, timezone)`, `isDayCloseMinute(...)` | worker, API |

**Правила domain-пакета:**

1. **Никаких** импортов из `apps/api`, Drizzle, `ioredis`, BullMQ.
2. Юнит-тесты domain — **без** Postgres/Redis (`pnpm --filter @mytodo/domain test`).
3. **`preview_next_goal`** в ответах API = результат `computeNextGoal` с **текущим** `habit.current_goal` и **финальным** (или предполагаемым) статусом дня. Worker при закрытии вызывает **ту же** `computeNextGoal` и записывает результат в `habits.current_goal`.
4. Интеграционный тест (блок 4 / 9): success-чекин → `preview_next_goal` в API === `current_goal` в БД после worker.

### Английский — зафиксированное поведение (§7.3)

По ТЗ: «Урок пройден → день засчитан, **переход к следующему видео завтра**». Значит `current_day` **не** меняется при `complete` — только при **закрытии дня** (worker, 23:59 local), по аналогии с `current_goal` у привычек.

| Действие | Когда | Что в БД | `current_day` |
| -------- | ----- | -------- | ------------- |
| `POST /english/complete` | Сразу | `english_progress` за сегодня = `success` | **без изменений** |
| `POST /english/skip` | Сразу | `english_progress` за сегодня = `skipped` | **без изменений** |
| Worker, 23:59 | Закрытие дня | нет записи за день → `fail`; есть `success`/`skip`/`fail` — статус уже финальный | **`success` → `current_day + 1`**; `fail` / `skipped` → без изменений |
| `GET /english/today` | В любой момент | урок = `english_lessons` по `current_day`; статус дня из `english_progress` | — |
| Превью в API | Ответ `today` / `complete` | `preview_next_day` = `computeNextEnglishDay(current_day, dayStatus)` | вычисляемое, не в БД |

**Пример:** пользователь прошёл урок 5 в 10:00 → до 23:59 `current_day = 5`, в UI «урок 5 пройден»; после закрытия дня → `current_day = 6`, завтра в `GET /english/today` — урок 6.

---

## Сводная таблица блоков

| Блок | Название | Срок | ТЗ |
| ---- | -------- | ---- | -- |
| 1 | Фундамент | 3–4 дня | §16, §17 |
| 2 | Auth и пользователь | 3–4 дня | §2, §4, §15.1, §18 |
| 3 | Привычки и калибровка | 4–5 дней | §3, §18 |
| 4 | Чекины и статусы дня | 5–6 дней | §3.4, §3.6, §8, §18 |
| 5 | Дашборды «Сегодня» | 4–5 дней | §6.1, §6.3, §18 |
| 6 | Помодоро и «тупые дела» | 3–4 дня | §6.2, §6.3, §8.1, §18 |
| 7 | Статистика и календарь | 4–5 дней | §6.5, §10, §27, §18 |
| 8 | Модуль «Английский» | 4 дня | §7, §18 |
| 9 | Worker (фоновые задачи) | 4–5 дней | §8.3, §8.4, §9.7 |
| 10 | Подписка и ЮKassa | 7–10 дней | §14, §18, §24.2 |
| 11 | Залоги | 4–5 дней | §6.4, §8.4, §18, §24.2 |
| 12 | Экспорт, удаление, режим тишины | 2–3 дня | §11, §15.3, §24.4, §24.7 |
| 13 | Push (API + отправка) | 5–7 дней | §9, §18, §16.6 |
| 14 | Admin API + seed + финализация | 5–6 дней | §16.5, §19, §25 |
| 15 | Backend v1.1 (опционально) | 5–7 дней | §23, §27.6 |

**Итого backend v1.0 (блоки 1–14): ~8–9 недель.**

> **Почему такой порядок:** английский (8) до worker (9) — чтобы закрытие дня сразу учитывало уроки; биллинг (10) до залогов (11) — залог использует тот же платёжный слой; тишина (12) до push (13) — worker не шлёт уведомления в режиме тишины.

---

## Блок 1. Фундамент

**Цель:** monorepo, API, БД, Redis, миграции — без бизнес-логики.

### Зависимости

Нет.

### Задачи

- [ ] Turborepo: `apps/api`, `packages/shared`, **`packages/domain`**, `docker-compose.yml`
- [ ] Postgres 16 + Redis
- [ ] Fastify 5 + TypeScript: CORS, helmet, rate-limit
- [ ] Drizzle: миграции, `db:migrate`, `db:studio`
- [ ] Pino, глобальный error handler, Sentry (заглушка в dev)
- [ ] `GET /api/v1/health` → `{ status, db, redis }`
- [ ] `packages/shared`: `ApiError`, коды HTTP
- [ ] **`packages/domain`:** scaffold пакета, Vitest (тесты без БД/Redis), экспорт пустого `index`
- [ ] Vitest + supertest: smoke-тест health; **`pnpm --filter @mytodo/domain test`** — green (пустой suite ок)

### Критерии готовности

- `pnpm dev` поднимает API
- `docker compose up` — Postgres + Redis
- `pnpm test` — health green; domain-пакет подключён в workspace

---

## Блок 2. Auth и пользователь

**Цель:** регистрация, JWT, профиль, trial 3 дня, заготовка под онбординг.

### Зависимости

Блок 1.

### Задачи

- [ ] Миграция `users`, `refresh_tokens`
- [ ] **Отличие от SQL в ТЗ §17:** поля онбординга (`weight_kg`, `height_cm`, `wake_time`, `sleep_time`, `free_time_min`) — **nullable** до завершения онбординга; флаг `onboarding_completed BOOLEAN DEFAULT false`
- [ ] Поля сразу в `users`: `silence_mode_until`, `silence_mode_used_at` (логика в блоке 12)
- [ ] `POST /auth/register` — email, пароль, имя, возраст, пол; `trial_ends_at = now + 3 дня`
- [ ] `POST /auth/login`, `/auth/refresh`, `/auth/logout`
- [ ] Middleware `authenticate`
- [ ] `GET /me`, `PATCH /me`
- [ ] `PATCH /me` (онбординг): вес, рост, режим сна, `free_time_min`, `timezone`, помодоро, `harshness_level` → `onboarding_completed = true`
- [ ] `daily_budget_min = min(free_time_min, 60)` при сохранении профиля (§2.3)
- [ ] Timezone: авто из клиента или `Europe/Moscow` (§2.2)
- [ ] Shared: `TRIAL_DAYS = 3`, `SUBSCRIPTION_PLANS`, `PLEDGE_AMOUNT = 5000`

### API

`POST /auth/register|login|refresh|logout` · `GET /me` · `PATCH /me`

### Критерии готовности

- Register → login → `GET /me` с `trial_ends_at`
- Refresh ротируется; logout инвалидирует refresh
- `POST /habits` без онбординга → `400` (проверка добавится в блоке 3)
- Тесты: auth, profile, `daily_budget_min`

### ТЗ

§2.1–2.3, §4 шаг 1 и 4, §14, §18

---

## Блок 3. Привычки и калибровка

**Цель:** CRUD привычек, расчёт стартовых целей.

### Зависимости

Блок 2 (`onboarding_completed = true`).

### Задачи

- [ ] Миграция `habits`
- [ ] `GET/POST/PATCH/DELETE /habits` (delete = `is_active false`)
- [ ] Лимит **6 активных** привычек суммарно (светлая + тёмная)
- [ ] Сервис калибровки (§3) — вызов **`domain.calibrateHabit`**:
  - светлая `target` / `increase`: `current_goal = max(baseline, recommended)`
  - тёмная `limit` / `decrease`: `current_goal = baseline`; шаги: курение/сахар/сладости −1, соцсети −5 мин (мин. 15)
  - `abstinence` (ногти): `baseline_value = 0`, `phase = abstinence`, `last_relapse_at = now` при создании
  - курение: `phase = reduction`, при `current_goal = 0` после закрытия дня → `abstinence` (блок 9)
- [ ] `allows_weekly_skip = true` только для `side = light`
- [ ] `PATCH /habits/:id` — ручное изменение цели (§3.4)
- [ ] `harshness_level` при создании привычки берётся из профиля; смена только для новых (§11)

### Критерии готовности

- Шаблон + custom-привычка с корректным `current_goal`
- 7-я привычка → `400`
- Ногти: сразу `abstinence`, таймер доступен
- Unit-тесты калибровки **в `packages/domain`**

### ТЗ

§3, §4 шаги 2–3, §18

---

## Блок 4. Чекины и статусы дня

**Цель:** фиксация результата дня **без** смены `current_goal`.

### Зависимости

Блок 3.

### Задачи

- [ ] Миграция `checkins`
- [ ] `GET /checkins?date=YYYY-MM-DD`
- [ ] `POST /checkins` — `{ habit_id, date?, value?, status? }`; статус через **`domain.resolveCheckinStatus`**
  - **светлая:** value ≥ `current_goal` → `success`; иначе `fail`
  - **тёмная limit:** value ≤ `current_goal` → `success`; иначе `fail`
  - **abstinence:** `status: 'fail'` + «Сорвался» → `last_relapse_at = now`
  - **пропуск:** `status: 'skipped'` — только светлая; ≤2 раз пн–вс — **`domain.canSkipThisWeek`**
  - при активном залоге на привычку: `skipped` → `400` (§3.6)
- [ ] В ответе: `preview_next_goal` = **`domain.computeNextGoal(habit, dayStatus)`** (не дублировать формулу в сервисе)
- [ ] **Не менять** `habits.current_goal` в этом блоке
- [ ] `POST /checkins/batch` — офлайн; конфликт `updated_at` → `409` + id конфликтов
- [ ] Уникальность `(habit_id, date)`
- [ ] Middleware `requireAccess` — заглушка (всегда ok) до блока 10

### Логика чекина по типам

| Тип | Запись в БД | Статус |
| --- | ----------- | ------ |
| target | При сохранении ползунка | success / fail |
| limit | При сохранении ползунка | success / fail |
| abstinence | Только при «Сорвался» = fail; иначе запись создаёт worker в 23:59 | success / fail |
| english | Отдельная таблица (блок 8) | — |

### Критерии готовности

- Светлая: value ≥ goal → success; `current_goal` **не изменился** до worker
- 3-й skip в неделю → `400`
- Срыв abstinence → fail + обновлён `last_relapse_at`
- Batch + конфликт 409
- Тест: после success чекина `current_goal` тот же; `preview_next_goal` === значение после worker (блок 9)
- Unit-тесты `computeNextGoal`, `resolveCheckinStatus` **в domain** (Moscow / Vladivostok — в блоке 9)

### ТЗ

§3.4, §3.6, §8.1, §8.2, §13, §18, §24.3

---

## Блок 5. Дашборды «Сегодня»

**Цель:** агрегаты для главных экранов.

### Зависимости

Блок 4.

### Задачи

- [ ] `GET /today/light` — привычки, `current_goal`, чекины сегодня, бюджет минут, `preview_next_goal`, серия
- [ ] `GET /today/dark` — лимиты, таймеры, doom-scroll active, статусы
- [ ] `GET /habits/:id/timer` — от `last_relapse_at`, timezone-aware
- [ ] Данные для 4 карточек статистики (§6.1): выполнено сегодня, срывы за неделю, минуты/🍅, серия

### Критерии готовности

- Один запрос на сторону — достаточно для UI §6.1 / §6.3
- `preview_next_goal` = `domain.computeNextGoal` — совпадает с тем, что запишет worker

### ТЗ

§6.1, §6.3, §18

---

## Блок 6. Помодоро и «тупые дела»

**Цель:** сессии фокуса и doom-scroll.

### Зависимости

Блок 4, 5.

### Задачи

- [ ] Миграции: `pomodoro_sessions`, `doom_scroll_sessions`
- [ ] Помодоро: `start` / `complete` / `stop` / `active` — одна активная сессия на привычку
- [ ] `complete` → добавляет минуты в чекин дня (пересчёт value + status)
- [ ] Doom-scroll:
  - `POST .../doom-scroll/start` — `ends_at = now + 15 min`
  - `GET .../doom-scroll/active`
  - `POST .../doom-scroll/stop` — досрочно; учесть **фактические** минуты (§8.1)
  - минуты суммируются в value чекина соцсетей
  - value > `current_goal` → чекин `fail`
- [ ] Истечение 15 мин без stop — завершение сессии в worker (блок 9), минуты засчитываются

### Критерии готовности

- Помодоро complete → value в чекине вырос
- Doom: start → stop раньше → фактическое время
- 31 мин за день → fail
- Тест истечения сессии (с worker из блока 9)

### ТЗ

§6.2, §6.3, §8.1, §18

---

## Блок 7. Статистика и календарь

**Цель:** полоска недели, месяц, графики v1.0.

### Зависимости

Блок 4, 5.

### Задачи

- [ ] Миграции (**обязательно**):
  - `goal_snapshots` — `(habit_id, date, goal_value)` UNIQUE `(habit_id, date)`; цель, действовавшая **в этот день**
  - `daily_stats` — `(habit_id, date, status, value, minutes_total)` UNIQUE `(habit_id, date)`; итог дня по привычке (пишет worker, блок 9)
- [ ] `GET /stats/week` — читать из `daily_stats` (агрегат по дням); не считать тяжёлые join на лету
- [ ] `GET /stats/calendar?month=YYYY-MM` — цвет дня из `daily_stats` + детали
- [ ] `GET /stats/month` — % успеха, срывы из `daily_stats`
- [ ] `GET /stats/habits/:id/progress?period=week|month|quarter` — `goal_snapshots` (линия цели) + `checkins` / `daily_stats` (столбцы value)
- [ ] `GET /stats/summary` — **v1.0:** тепловая карта из `daily_stats`; **v1.1:** + круговая диаграмма (§27.6)

> **Важно:** таблицы создаём здесь, **заполняет worker** (блок 9). Тесты блока 7 — через fixture-данные в `goal_snapshots` / `daily_stats`.

### Схема `goal_snapshots`

```sql
CREATE TABLE goal_snapshots (
    habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    goal_value DECIMAL NOT NULL,
    PRIMARY KEY (habit_id, date)
);
```

### Схема `daily_stats`

```sql
CREATE TABLE daily_stats (
    habit_id      UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    status        VARCHAR NOT NULL CHECK (status IN ('success', 'fail', 'skipped')),
    value         DECIMAL,
    minutes_total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (habit_id, date)
);
```

### Правила чтения графиков (§27)

| График | Источник |
| ------ | -------- |
| Линия «Прогресс цели» | `goal_snapshots.goal_value` по датам |
| Столбцы «Выполнено» | `checkins.value` или `daily_stats.value` |
| Тепловая карта / неделя | агрегат `daily_stats` по `user_id` (через join `habits`) |

### Правила цвета дня (§10.2)

| Цвет | Условие |
| ---- | ------- |
| 🟢 | Все привычки стороны success (english не ломает цвет светлой/тёмной) |
| 🟡 | Есть привычки без финального статуса до конца дня |
| 🔴 | Есть fail |
| ⚪ | Только skipped, без fail |

### Критерии готовности

- Неделя и месяц согласованы с fixture в `daily_stats`
- Progress: 30 точек; линия цели из `goal_snapshots`, не из `habits.current_goal`
- Тест: после смены цели вручную исторический график не «ломается»
- Тесты: пустая неделя, пропуски, смешанный день

### ТЗ

§6.5, §10, §27 (v1.0 часть), §18

---

## Блок 8. Модуль «Английский»

**Цель:** уроки, прогресс, пропуски — **до** worker, чтобы тот закрывал день и продвигал `current_day` в 23:59.

### Зависимости

Блок 2, 4 (переиспользовать счётчик пропусков пн–вс). Логика — **`packages/domain/english`** (см. раздел «Английский — зафиксированное поведение»).

### Задачи

- [ ] Миграции: `english_lessons`, `english_settings`, `english_progress`
- [ ] Минимальный fixture: 3–5 уроков в тестах (полный seed — блок 14)
- [ ] `GET /english/today`, `POST /english/complete`, `POST /english/skip`, `GET /english/history`, `PATCH /english/settings`
- [ ] `complete`: `watched_sec` ≥ 80% `duration_sec` → `english_progress` за сегодня = `success`; **`current_day` не менять**
- [ ] В ответе `complete` / `today`: `preview_next_day` = **`domain.computeNextEnglishDay(current_day, dayStatus)`**
- [ ] `skip` — ≤2/нед (`domain.canSkipThisWeek`); `english_progress` = `skipped`; **`current_day` не менять**
- [ ] Не влияет на `daily_budget_min` (§2.3)
- [ ] Если `is_enabled = false` — роуты возвращают `404` или `{ enabled: false }`
- [ ] Unit-тесты `computeNextEnglishDay`, `closeEnglishDay` в domain

### Критерии готовности

- `complete` урока 1 → `current_day` остаётся 1 до worker; после закрытия дня с `success` → `current_day = 2`
- `preview_next_day` после `complete` = 2; до worker в БД всё ещё 1
- 3-й skip → `400`
- Skip не продвигает урок (ни сразу, ни после worker)
- Disabled — модуль недоступен

### ТЗ

§7, §18

---

## Блок 9. Worker (фоновые задачи)

**Цель:** единый worker по §9.7 — **каждую минуту**.

### Зависимости

Блок 4, 6, 8. (Блоки 11, 12, 13 расширяют worker — см. ниже.)

### Задачи — ядро (блок 9)

- [ ] BullMQ + Redis, команда `pnpm worker`
- [ ] **Автозакрытие дня** (23:59 local) — оркестрация в worker, правила в **`domain.closeDayForHabit`** / **`domain.closeEnglishDay`**:
  - `target` без чекина → `fail`; со чекином — статус уже есть
  - `limit` без чекина → `fail`
  - `abstinence` без срыва за день → создать чекин `success`
  - соцсети: учесть doom-scroll минуты и лимит
  - **Режим тишины** (§15.3): если `silence_mode_until > now` — привычки с активным залогом → `skipped` (не fail); остальные — по обычным правилам
- [ ] **`goal_snapshots`:** для каждой привычки за день `D` → сохранить `goal_value = current_goal` (цель, по которой оценивался день)
- [ ] **`daily_stats`:** итог дня → `status`, `value`, `minutes_total`
- [ ] **Прогрессия `current_goal`** — **`domain.computeNextGoal`** (та же функция, что `preview_next_goal` в API):
  - светлая success → `goal += step`; fail/skipped → без изменений
  - тёмная limit success → `goal -= step` (мин. 0); fail → без изменений
  - курение: при `goal = 0` после success → `phase = abstinence`, `last_relapse_at = now`
- [ ] **Английский:** `domain.closeEnglishDay` — нет записи за день → `fail`; при `success` за день → **`current_day + 1`** через `domain.computeNextEnglishDay`; `fail` / `skipped` → `current_day` без изменений
- [ ] **Doom-scroll:** истёкшие сессии → `completed`, минуты в чекин
- [ ] Идемпотентность: повторный прогон не дублирует закрытие, снимки и `daily_stats` (UPSERT / проверка существования)
- [ ] Лог `day_closed`

### Расширения worker (добавляются в следующих блоках)

| Блок | Задача worker |
| ---- | ------------- |
| 11 | Истечение 30-дневного залога → success/failed + refund (см. **правила ниже**) |
| 13 | Расписание push; cheer; doom-scroll push; мгновенные — в API |
| 10 | Ретраи `past_due` подписки (§24.2) |

### Завершение залога (worker, реализуется в блоке 11)

По истечении 30 дней (`started_at + 30`) для `pledges.status = active`:

| Условие | Результат |
| ------- | --------- |
| Хотя бы один чекин привычки залога со статусом `fail` за период | `failed` (обычно уже сработало при чекине — перепроверка) |
| Хотя бы один `skipped`, **кроме** дней с активным режимом тишины (§15.3) | `failed` — пропуски при залоге запрещены |
| Все 30 дней — только `success` **или** `skipped` в режиме тишины | `success` → refund 5000 ₽ + бейдж `steel_character` |
| Меньше 30 закрытых дней в периоде | `failed` (пропущенный день = не success) |

> **Сразу при чекине:** `fail` по привычке с активным залогом → `pledges.status = failed` без ожидания 30 дней (блок 11).

### Критерии готовности

- 23:59: pending abstinence → success; пустой limit → fail
- После закрытия success светлой — `current_goal` = то же, что было в `preview_next_goal` до закрытия; в `goal_snapshots` за этот день — **старая** цель
- Запись в `daily_stats` за каждую привычку
- English: `complete` днём → `current_day` не меняется; после worker с `success` → +1; fail при неотметке
- Повторный cron — без дублей в `goal_snapshots` / `daily_stats`
- Unit-тесты `closeDayForHabit`, `computeNextGoal`, timezone — **в domain** (Europe/Moscow, Asia/Vladivostok); интеграция worker — в `apps/api`

### ТЗ

§8.3, §8.4, §9.7, §15.3

---

## Блок 10. Подписка и ЮKassa

**Цель:** trial, тарифы, доступ к API.

### Зависимости

Блок 2.

### Задачи

- [ ] Миграция `subscriptions`
- [ ] `POST /billing/subscribe` — `{ plan: 'monthly' | '2months' | '3months' }`
- [ ] Цены: 1990 / 3790 / 5490 ₽; периоды: 30 / 60 / 90 дней
- [ ] `monthly` — рекуррент; `2months` / `3months` — разовая оплата, без renewal
- [ ] `POST /billing/cancel` — только `monthly`; доступ до `current_period_end`
- [ ] `POST /billing/webhook` — подпись ЮKassa, идемпотентность
- [ ] `past_due`: retry через 3 дня, макс. 3 попытки → `expired` (§24.2)
- [ ] Middleware `requireAccess` (заменить заглушку блока 4):

```
доступ = now < trial_ends_at
      OR subscription.status = 'active'
      OR (status = 'canceled' AND now < current_period_end)
```

- [ ] Исключения из middleware: `/auth/*`, `/health`, `/billing/webhook`

### Критерии готовности

- Trial истёк → `402` на защищённых роутах
- Webhook → `active` + корректный `current_period_end`
- Cancel monthly → доступ до конца периода
- Mock-тесты ЮKassa

### ТЗ

§14, §18, §24.2

---

## Блок 11. Залоги

**Цель:** депозит 5000 ₽, 30 дней без провала.

### Зависимости

Блок 4, 9, **10** (реальная оплата ЮKassa).

### Задачи

- [ ] Миграции: `pledges`, `user_badges`
- [ ] `GET /pledges`, `POST /pledges` — `{ habit_id, charity_fund }`
- [ ] `charity_fund`: `oncology` | `children` | `animals` (§8.4)
- [ ] Проверки: 1 активный залог / месяц; привычка принадлежит user
- [ ] Оплата 5000 ₽ через ЮKassa при активации
- [ ] Чекин `fail` по привычке с активным залогом → **сразу** `pledges.status = failed` (не ждать 30 дней)
- [ ] Worker (дополнение блока 9) при `started_at + 30 дней`:
  - выбрать все чекины привычки залога за период `[started_at … started_at + 29]`
  - **failed**, если есть хотя бы один `fail`
  - **failed**, если есть `skipped` не в день режима тишины (§15.3)
  - **failed**, если не все 30 дней закрыты как `success` (или допустимый `skipped` в тишине)
  - **success** только если каждый день — `success` (или `skipped` в тишине) → refund + badge `steel_character`
- [ ] `refund_error` → Sentry (§24.2)
- [ ] Admin manual close — блок 14

### Критерии готовности

- Активация после оплаты → `active`
- Fail чекина → pledge `failed` немедленно
- 30 дней только success → `success` + refund
- Один `skipped` без тишины за период → `failed` при истечении
- День в режиме тишины (`skipped`) → залог **не** проваливается (§15.3)
- 2-й залог в месяц → `400`

### ТЗ

§6.4, §8.4, §18, §24.2

---

## Блок 12. Экспорт, удаление, режим тишины

**Цель:** GDPR и «красная кнопка» — **до** push.

### Зависимости

Блок 2, 10, 11.

### Задачи

- [ ] `GET /me/export` — ZIP: `profile.json`, `habits.csv`, `checkins.csv`, `english_progress.csv` (§11.1)
- [ ] `DELETE /me` — при активном залоге: pledge → `failed`, затем каскадное удаление (§24.4)
- [ ] `PATCH /me` — `{ enable_silence_mode: true }`:
  - `silence_mode_until = now + 24h`
  - не чаще 1 раза в 30 дней (`silence_mode_used_at`)
  - жёсткость → мягкая на 24ч (в API ответа)
- [ ] Смена `timezone` — push-расписание с **следующего** дня; чекины не пересчитываются (§24.7)

### Критерии готовности

- Export без паролей и токенов
- Delete + активный залог → failed → user удалён
- 2-й silence за 30 дней → `400`
- Worker (блок 9) при тишине не ставит fail залоговой привычке

### ТЗ

§11.1, §15.3, §24.4, §24.7

---

## Блок 13. Push (API + worker)

**Цель:** Web Push по §9.

### Зависимости

Блок 2, 6, 9, 10, **12** (режим тишины).

### Задачи

- [ ] Миграции: `push_subscriptions`, `notification_templates`, **`push_delivery_log`**
- [ ] Минимальный seed шаблонов в тестах (полный — блок 14)
- [ ] `POST /push/subscribe`, `DELETE /push/subscribe`, `POST /push/test`
- [ ] VAPID в env
- [ ] **Мгновенные** (в API, не cron): `relapse`, `success` при чекине (§9.5)
- [ ] **При doom-scroll start:** push `doom_scroll_start` (§9.3)
- [ ] **Дедупликация расписания (обязательно):**
  - таблица `push_delivery_log`: `(user_id, event_type, local_date, slot)` UNIQUE; `slot = 0` для утро/день/вечер; `slot = 1..5` для cheer
  - перед отправкой: проверка log **или** Redis `SET NX push:{event}:{userId}:{local_date}:{slot}` TTL 48h
  - утро / день / вечер — **не более 1 раза** за локальный день пользователя
  - cheer — не более 5 раз за день, слоты планируются равномерно (§9.2)
- [ ] Worker (дополнение блока 9):
  - утро / день / вечер (§9.1); если сон−подъём < 6ч — только утро и вечер
  - cheer для курения `abstinence` без срыва сегодня
  - doom-scroll: **одна** отложенная BullMQ-job на сессию (+15 мин) → `doom_scroll_end` (не минутный cron)
  - лимит 30 мин → `doom_scroll_limit` (один раз за день, через log)
- [ ] Не слать, если `silence_mode_until > now`
- [ ] Не слать cheer после срыва сегодня
- [ ] Логи `push_sent` / `push_failed` (Pino); запись в `push_delivery_log` **до** отправки (at-least-once safe)

### Схема `push_delivery_log`

```sql
CREATE TABLE push_delivery_log (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    local_date DATE NOT NULL,
    slot       INTEGER NOT NULL DEFAULT 0,
    sent_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_type, local_date, slot)
);
```

### Критерии готовности

- Subscribe + test push (manual QA)
- Relapse → мгновенный push
- Cheer не после срыва
- Тишина блокирует все push
- Повторный запуск worker в ту же минуту — **нет** второго утреннего push
- Два cheer-слота за день — ровно 2 записи в log, не 4

### ТЗ

§9, §18, §16.6

---

## Блок 14. Admin API + seed + финализация

**Цель:** backend готов к frontend.

### Зависимости

Блоки 1–13.

### Задачи

- [ ] `requireAdmin` middleware
- [ ] Admin API `/api/v1/admin/*` (§25.3)
- [ ] `pnpm seed` (идемпотентный): 30 уроков, все шаблоны push, users (user, trial, admin)
- [ ] `docs/API.md` или OpenAPI
- [ ] `.env.example`
- [ ] Интеграционные тесты: auth, checkins, day-close, progression, **`preview_next_goal` = post-worker goal**, `goal_snapshots` + `daily_stats`, billing webhook, pledge, push dedup, **english day advance only after worker**
- [ ] Чеклист backend-части §19

### Критерии готовности

- Admin: users, close pledge, CRUD lessons, broadcast push
- `pnpm seed` ×2 — без дублей
- `pnpm test` — all green

### ТЗ

§16.5, §19, §25

---

## Блок 15. Backend v1.1

После frontend MVP. Не блокирует старт UI.

- [ ] Ранги, Красный Босс, `doom_boss_daily` (§23)
- [ ] `GET /habits/:id/rank`, `/boss`
- [ ] Push `rank_up`
- [ ] `referrals` API-заглушки
- [ ] Admin-аналитика (§25.2)
- [ ] `GET /stats/summary` — круговая диаграмма (§27.6)

---

## Порядок миграций БД

| # | Таблицы | Блок |
| - | ------- | ---- |
| 1 | `users`, `refresh_tokens` | 2 |
| 2 | `habits` | 3 |
| 3 | `checkins` | 4 |
| 4 | `goal_snapshots`, `daily_stats` | 7 |
| 5 | `pomodoro_sessions`, `doom_scroll_sessions` | 6 |
| 6 | `english_lessons`, `english_settings`, `english_progress` | 8 |
| 7 | `subscriptions` | 10 |
| 8 | `pledges`, `user_badges` | 11 |
| 9 | `push_subscriptions`, `notification_templates`, `push_delivery_log` | 13 |

v1.1: `referrals`, `referral_rewards`, `doom_boss_daily`, колонки рангов в `habits`.

---

## Чеклист «Backend v1.0 готов к frontend»

- [ ] Все эндпоинты §18 + `POST .../doom-scroll/stop`
- [ ] Worker: закрытие дня через **`packages/domain`**; прогрессия, `goal_snapshots`, `daily_stats`, doom-expiry, pledge expiry, push с дедупом
- [ ] Trial 3 дня; тарифы 1990 / 3790 / 5490
- [ ] Залог 5000 ₽ + refund
- [ ] ЮKassa staging
- [ ] Seed + admin API
- [ ] Критичные тесты green
- [ ] `.env.example`

---

## Переменные окружения

```env
DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
SENTRY_DSN=
NODE_ENV=development
PORT=3000
```

---

## Согласование с ТЗ (известные уточнения)

| Тема | ТЗ | Backend (этот план) |
| ---- | -- | ------------------- |
| Частота worker §8.3 vs §9.7 | «каждый час» / «каждую минуту» | **Каждую минуту** (§9.7 приоритетнее) |
| SQL `users` NOT NULL | §17 | Nullable до онбординга + `onboarding_completed` |
| `doom-scroll/stop` | UI §6.3 | Эндпоинт добавлен в §18 ТЗ |
| Прогрессия goal | Размыто | Только при закрытии дня (worker); **`domain.computeNextGoal`** — и для preview, и для записи |
| Английский `current_day` | §7.3 «завтра» | **`complete` не двигает**; +1 только при закрытии дня с `success`; **`domain.computeNextEnglishDay`** |
| История целей для графиков | §27 | **`goal_snapshots`** — обязательно, пишет worker |
| Слой бизнес-логики | §16.4 (только shared) | **`packages/domain`** — чистые функции, unit-тесты без БД |
| Агрегаты статистики | §10, §27 | **`daily_stats`** — пишет worker; API читает готовое |
| Дубли push | §9.7 | **`push_delivery_log`** + Redis NX или UNIQUE в БД |
| Успех залога за 30 дней | §8.4, §15.3 | Только `success` каждый день; `skipped` допустим **только** в режиме тишины |
