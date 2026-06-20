# План реализации Frontend (PWA)

**Проект:** PWA «Новая глава»  
**Статус:** 🚧 в работе (старт 20.06.2026)  
**Backend:** ✅ v1.0 — [BACKEND-PLAN.md](./BACKEND-PLAN.md)  
**Связанный документ:** [TZ.md](./TZ.md) §4, §6, §16.1, §19  
**API:** [API.md](./API.md)

**Подход:** vertical slices — каждый блок даёт работающий UI-сценарий поверх готового API.

---

## Обзор этапов

| Блок | Название | Срок | ТЗ | Статус |
| ---- | -------- | ---- | -- | ------ |
| 0 | Scaffold + инфра | 1 день | §16.1, §16.4 | ✅ |
| 1 | Auth + routing guard | 1–2 дня | §2.1, §18 auth | 🚧 |
| 2 | Онбординг | 2–3 дня | §4 | ⏳ |
| 3 | Светлая «Сегодня» + чекины | 3–4 дня | §3, §6.1 | ⏳ |
| 4 | Тёмная «Сегодня» + таймеры | 2–3 дня | §6.1, §8.1 | ⏳ |
| 5 | Помодоро + doom-scroll UI | 2 дня | §6.2, §8.1 | ⏳ |
| 6 | Английский | 2 дня | §7 | ⏳ |
| 7 | Статистика и календарь | 3–4 дня | §6.5, §10, §27 | ⏳ |
| 8 | Push (subscribe UI) | 2 дня | §9 | ⏳ |
| 9 | Подписка + залог (402) | 3–4 дня | §14, §6.4 | ⏳ |
| 10 | PWA + офлайн sync | 3–4 дня | §13, §24.3 | ⏳ |
| 11 | Профиль, экспорт, тишина | 2 дня | §11, §15.3 | ⏳ |

**Не входит v1.0 frontend:** `apps/admin` UI (⏳ после MVP), геймификация v1.1 (§23), полные графики v1.1 (§27.6).

---

## Блок 0. Scaffold + инфра ✅

**Цель:** `apps/web` запускается, проксирует `/api` на `:3000`, подключены shared-типы.

- [x] `apps/web`: Vite 6 + React 19 + TypeScript
- [x] Turborepo: `pnpm dev` поднимает api + web
- [x] Proxy `/api` → `http://localhost:3000`
- [x] `@mytodo/shared` как workspace-зависимость
- [x] TanStack Query + React Router v7
- [x] Tailwind CSS 4 (базовая тема; shadcn/ui — в блоке 1–2)
- [x] Структура: `src/lib/api.ts`, `src/features/`, `src/routes/`
- [x] Env: `VITE_API_URL` (пусто = proxy в dev)

**Критерий готовности:** `pnpm dev` → web на `:5173`, health через proxy ok.

---

## Блок 1. Auth + routing guard 🚧

**Цель:** register / login / logout / refresh; защищённые роуты; `GET /me`.

- [x] Страницы `/login`, `/register`
- [x] Хранение `access_token` + `refresh_token` (localStorage)
- [x] API-клиент: auto `Authorization`, refresh при 401
- [x] `AuthGuard`: неавторизован → login; `onboarding_completed=false` → онбординг
- [x] React context для UI-сессии
- [x] Обработка ошибок API (`ClientApiError` + `apiErrorResponseSchema` из shared)
- [ ] E2E-проверка с seed-аккаунтом на staging

---

## Блок 2. Онбординг ✅

**Цель:** полный flow §4 после регистрации (welcome-flow → `/onboarding`).

- [x] Шаг профиля: вес, рост, сон, `free_time_min`, timezone (auto на бэкенде)
- [x] Светлая сторона: 4 Пути, выбор/создание привычек (до 6 суммарно с тёмной)
- [x] Калибровка baseline для каждой привычки
- [x] Тёмная сторона: выбор вредных привычек + baseline
- [x] `PATCH /me` → `onboarding_completed=true` (+ harshness, english)
- [x] Жёсткость уведомлений (harshness 1–3)
- [x] Demo mode для Vercel без API (`VITE_DEMO_MODE` / auto)

**Критерий:** новый user проходит онбординг → попадает на «Сегодня».

---

## Блок 3. Светлая «Сегодня» + чекины ⏳

- [ ] `GET /today/light` — карточки привычек
- [ ] Ползунок value + статус success/fail/skipped
- [ ] `POST /checkins`, отображение `preview_next_goal`
- [ ] 4 карточки статистики (§6.1)
- [ ] Полоска недели (Пн–Вс)
- [ ] Переключатель светлая / тёмная вкладка

---

## Блок 4. Тёмная «Сегодня» + таймеры ⏳

- [ ] `GET /today/dark`, `GET /habits/:id/timer`
- [ ] Таймер «чистого времени» (live update)
- [ ] Кнопка «Сорвался» → `POST /checkins` fail
- [ ] Тёмная тема экрана

---

## Блок 5. Помодоро + doom-scroll ⏳

- [ ] Pomodoro: start / complete / stop / active
- [ ] Doom-scroll: start / stop, таймер 15 мин
- [ ] Интеграция минут в чекин дня

---

## Блок 6. Английский ⏳

- [ ] `GET /english/today` — видео (iframe/embed)
- [ ] Complete / skip, `preview_next_day`
- [ ] Настройки `PATCH /english/settings`

---

## Блок 7. Статистика и календарь ⏳

- [ ] `/stats/week`, `/stats/calendar`, `/stats/month`
- [ ] Progress chart (Recharts) по привычке
- [ ] Summary heatmap (§27.5)
- [ ] ⏳ v1.1: круговая диаграмма на summary

---

## Блок 8. Push (UI) ⏳

- [ ] Запрос permission + `POST /push/subscribe`
- [ ] VAPID public key из env
- [ ] UI в профиле: статус подписки

---

## Блок 9. Подписка + залог ⏳

- [ ] Экран тарифов (1990 / 3790 / 5490)
- [ ] Redirect на ЮKassa / обработка return URL
- [ ] Залог 5000 ₽, выбор фонда
- [ ] Global handler 402 → paywall modal

---

## Блок 10. PWA + офлайн ⏳

- [ ] `vite-plugin-pwa` (Workbox)
- [ ] Офлайн-чтение today/stats (cache)
- [ ] `POST /checkins/batch` при reconnect, UI конфликта 409
- [ ] Install prompt / manifest

---

## Блок 11. Профиль и аккаунт ⏳

- [ ] Редактирование профиля, смена timezone
- [ ] Режим тишины (раз в 30 дней)
- [ ] `GET /export` → скачать ZIP
- [ ] `DELETE /me` с предупреждением о залоге (§24.4)
- [ ] Logout

---

## Локальная разработка

```bash
docker compose up -d
pnpm seed
pnpm dev          # api :3000 + web :5173
pnpm worker       # отдельный терминал — day-close
```

**Тестовые аккаунты (seed):**

| Email | Пароль | Роль | Примечание |
| ----- | ------ | ---- | ---------- |
| demo@novayaglava.local | demo1234 | user | онбординг пройден → сразу «Сегодня» |
| trial@novayaglava.local | trial1234 | user | онбординг не пройден → `/onboarding` |
| admin@novayaglava.local | admin1234 | admin | онбординг пройден |

---

## Чеклист «Frontend MVP готов к staging»

- [ ] Auth + онбординг + today (light/dark) + checkins
- [ ] Pomodoro + doom-scroll
- [ ] Английский + базовая статистика
- [ ] Push subscribe
- [ ] Paywall 402 + подписка + залог UI
- [ ] PWA install + offline batch sync
- [ ] Профиль: экспорт, удаление, тишина
