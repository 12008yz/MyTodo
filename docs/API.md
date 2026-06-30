# API Reference (v1)

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>` unless noted.

## Health

| Method | Path      | Auth | Description             |
| ------ | --------- | ---- | ----------------------- |
| GET    | `/health` | No   | `{ status, db, redis }` |

## Auth

| Method | Path             | Description                  |
| ------ | ---------------- | ---------------------------- |
| POST   | `/auth/register` | Register user (trial 3 days) |
| POST   | `/auth/login`    | Login                        |
| POST   | `/auth/refresh`  | Rotate refresh token         |
| POST   | `/auth/logout`   | Invalidate refresh token     |

## Profile

| Method | Path         | Description                                     |
| ------ | ------------ | ----------------------------------------------- |
| GET    | `/me`        | Current user profile                            |
| PATCH  | `/me`        | Update profile / onboarding / silence mode      |
| GET    | `/me/export` | ZIP export (profile, habits, checkins, english) |
| DELETE | `/me`        | Delete account                                  |

## Habits

| Method | Path                | Description                       |
| ------ | ------------------- | --------------------------------- |
| GET    | `/habits`           | List active habits                |
| POST   | `/habits`           | Create from template or custom    |
| PATCH  | `/habits/:id`       | Update habit (incl. manual goal)  |
| DELETE | `/habits/:id`       | Soft-delete (`is_active = false`) |
| GET    | `/habits/:id/timer` | Abstinence timer                  |

## Book reading (books habit)

| Method | Path                           | Description                                                                                                                                                      |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/habits/:id/reading`          | Current book progress `{ reading }`                                                                                                                              |
| PUT    | `/habits/:id/reading/select`   | Select book `{ book_id, checkin_baseline? }`                                                                                                                     |
| DELETE | `/habits/:id/reading`          | Clear selected book `{ reading: null }`                                                                                                                          |
| PATCH  | `/habits/:id/reading/bookmark` | Save reader state: `{ last_read_page? }`, `{ timer_remaining_seconds?, timer_saved_date? }`, `{ reader_day_start_page?, reader_day_date? }` (at least one field) |

`reading` fields: `book_id`, `pages_read` (habit credit), `pages_credited_today`, `last_read_page` (reader bookmark), `timer_remaining_seconds`, `timer_saved_date` (paused reading timer for today), `reader_day_start_page`, `reader_day_date` (today's reading baseline for page credit), `last_checkin_date`, `completed_at`, `page_count`.

Book texts are served as static files from the web app (`/books/{book_id}/pages/NNN.txt`), not via API.

## Nutrition (companion habit)

| Method | Path                          | Description                                 |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/habits/:id/nutrition/today` | Today's picker state `{ log }` (or `null`)  |
| PUT    | `/habits/:id/nutrition/today` | Save `{ ingredient_ids, recipe_id? }` → log |

`log` fields: `id`, `habit_id`, `date`, `ingredient_ids`, `recipe_id`, `updated_at`.

Only habits with `category_key: healthy_nutrition` (or name «Правильное питание»). No check-in — companion habit without day-close failure.

Recipe catalog is bundled in the web app (`@mytodo/shared` / `@mytodo/domain`), not served via API.

## Coach (dark-side urge support)

| Method | Path          | Description                                   |
| ------ | ------------- | --------------------------------------------- |
| POST   | `/coach/chat` | Chat with habit coach `{ habit_id, message }` |

Response: `{ reply, messages_left, source }` where `source` is `gigachat` or `template`.

- Habits: smoking, sugar, sweets, nail_biting (not social_media).
- Limit: 5 user messages per local day.
- Env: `GIGACHAT_CREDENTIALS` (optional; template fallback if unset).
- Push `goal_reduced` when dark limit decreases after 3 successful days.

### GigaChat setup

1. Register at [developers.sber.ru](https://developers.sber.ru) (Sber ID) → create project → **GigaChat API** (scope `GIGACHAT_API_PERS` for individuals).
2. In project settings, copy **Authorization key** (ключ авторизации).
3. Add to `apps/api/.env` (create from `apps/api/.env.example`). Full guide: [SETUP.md](./SETUP.md#gigachat--пошагово).

```env
GIGACHAT_CREDENTIALS=<Authorization key as-is>
```

The key is sent as `Authorization: Basic <key>` to Sber OAuth — paste the value from the cabinet, do not add `Basic ` prefix.

**TLS (Windows/macOS):** Sber uses the Russian Trusted Root CA. The repo bundles `apps/api/certs/russian_trusted_root_ca.cer`; the API loads it automatically. Override with `GIGACHAT_CA_CERT` if needed.

Test connection: `pnpm --filter @mytodo/api test:gigachat`

**Without the key:** chat still works via built-in templates (`source: "template"`).

**Freemium:** ~1M tokens/year on personal scope — enough for dev and early users with the 5 messages/day limit.

## Checkins

| Method | Path                        | Description                                                                        |
| ------ | --------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/checkins?date=YYYY-MM-DD` | Checkins for date                                                                  |
| POST   | `/checkins`                 | Create/update checkin                                                              |
| DELETE | `/checkins?habit_id=&date=` | Remove today's checkin for a habit (`date` optional, defaults to user local today) |
| POST   | `/checkins/reopen`          | Reopen today's successful checkin as `pending` (keeps `value`)                     |
| POST   | `/checkins/batch`           | Offline batch sync (409 on conflict)                                               |

## Today dashboards

| Method | Path           | Description          |
| ------ | -------------- | -------------------- |
| GET    | `/today/light` | Light side dashboard |
| GET    | `/today/dark`  | Dark side dashboard  |

## Pomodoro & doom-scroll

| Method | Path                             | Description          |
| ------ | -------------------------------- | -------------------- |
| POST   | `/habits/:id/pomodoro/start`     | Start session        |
| POST   | `/habits/:id/pomodoro/complete`  | Complete session     |
| POST   | `/habits/:id/pomodoro/stop`      | Stop session         |
| GET    | `/habits/:id/pomodoro/active`    | Active session       |
| POST   | `/habits/:id/doom-scroll/start`  | Start 15-min session |
| GET    | `/habits/:id/doom-scroll/active` | Active session       |
| POST   | `/habits/:id/doom-scroll/stop`   | Stop early           |

## Stats

| Method | Path                                                     | Description     |
| ------ | -------------------------------------------------------- | --------------- |
| GET    | `/stats/week`                                            | Week strip      |
| GET    | `/stats/calendar?month=YYYY-MM`                          | Month calendar  |
| GET    | `/stats/month?month=YYYY-MM`                             | Month summary   |
| GET    | `/stats/habits/:id/progress?period=week\|month\|quarter` | Progress chart  |
| GET    | `/stats/summary?period=year`                             | Heatmap summary |

## English

| Method | Path                | Description           |
| ------ | ------------------- | --------------------- |
| GET    | `/english/today`    | Today's lesson        |
| POST   | `/english/watch`    | Save watch progress (per lesson, per day) |
| POST   | `/english/select`   | Pin lesson for today on home |
| POST   | `/english/complete` | Mark lesson watched   |
| POST   | `/english/skip`     | Skip today            |
| GET    | `/english/catalog`  | Lesson catalog        |
| GET    | `/english/history`  | Completed lessons     |
| PATCH  | `/english/settings` | Enable/disable module |

## Billing

| Method | Path                 | Description                |
| ------ | -------------------- | -------------------------- |
| POST   | `/billing/subscribe` | Start subscription payment |
| POST   | `/billing/cancel`    | Cancel monthly plan        |
| POST   | `/billing/webhook`   | YuKassa webhook (no JWT)   |

## Pledges

| Method | Path       | Description                   |
| ------ | ---------- | ----------------------------- |
| GET    | `/pledges` | User pledges                  |
| POST   | `/pledges` | Start pledge payment (5000 ₽) |

## Push

| Method | Path              | Description                |
| ------ | ----------------- | -------------------------- |
| POST   | `/push/subscribe` | Save Web Push subscription |
| DELETE | `/push/subscribe` | Remove subscription        |
| POST   | `/push/test`      | Send test notification     |

## Admin (`role: admin`)

| Method | Path                         | Description                                             |
| ------ | ---------------------------- | ------------------------------------------------------- |
| GET    | `/admin/users`               | List users (`subscription`, `pledge`, `search` filters) |
| GET    | `/admin/users/:id`           | User card                                               |
| PATCH  | `/admin/pledges/:id`         | Manual pledge close `{ status, admin_comment }`         |
| GET    | `/admin/english/lessons`     | List lessons                                            |
| POST   | `/admin/english/lessons`     | Create lesson                                           |
| PATCH  | `/admin/english/lessons/:id` | Update lesson                                           |
| DELETE | `/admin/english/lessons/:id` | Delete lesson                                           |
| POST   | `/admin/push/broadcast`      | Mass push `{ text, filter }`                            |

Broadcast filters: `all`, `subscribed`, `trial`, `no_subscription`.

Response fields: `targeted_users` — users matching the filter; `sent` / `failed` — only among users with a saved push subscription.

## Seed

```bash
pnpm seed
```

Creates (idempotently):

- English lessons (full VK playlist catalog)
- Push notification templates
- Users: `demo@novayaglava.local`, `trial@novayaglava.local`, `admin@novayaglava.local`

## Access control

Protected routes require valid JWT + active trial/subscription (`402` when expired).

Exceptions: `/auth/*`, `/health`, `/billing/webhook`.

Admin routes require `role = admin` (`403` otherwise).

Проверь всё за собой ещё раз. Что бы не было ошибок или несостыковок. CURSOR - НЕ УДАЛЯТЬ СТРОКУ
