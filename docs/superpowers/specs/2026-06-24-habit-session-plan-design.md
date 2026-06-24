# Дизайн: дневной план сессий и распределение времени

**Дата:** 2026-06-24  
**Статус:** утверждён  
**Контекст:** единый UX для всех привычек (светлая + тёмная): «Начать → таймер → ввод результата», с автоматическим распределением `free_time_min` из онбординга.

---

## 1. Цели

1. Пользователь указывает свободное время (15–120 мин) — приложение **укладывает все светлые привычки** в этот бюджет.
2. На главной показывается **дневной план блоков** (сессий), а не только абстрактная цель «40 страниц».
3. **Один паттерн** для всех привычек: кнопка «Начать» → обратный отсчёт → ввод фактического результата.
4. При малом времени **нельзя выбрать слишком много светлых привычек** (валидация в онбординге).
5. Тёмная сторона использует **тот же UI сессий**, но **не съедает** светлый бюджет.

---

## 2. Изменения к текущей модели

| Сейчас | Станет |
|--------|--------|
| `daily_budget_min = min(free_time_min, 60)` | `daily_budget_min = free_time_min` (полное выбранное время) |
| Равный делёж бюджета между светлыми привычками | **Взвешенный** делёж по «стоимости» цели в минутах |
| Карточка: ползунок + «Сохранить» | Карточка: план блоков + «Начать сессию» + ввод после таймера |
| Помодоро / doom-scroll только в API | Обобщённые **habit sessions** в UI |
| Лимит 6 привычек без учёта времени | Доп. лимит: `floor(free_time_min / MIN_MINUTES_PER_LIGHT_HABIT)` светлых |

### Константы (новые, `packages/shared`)

```ts
MIN_MINUTES_PER_LIGHT_HABIT = 10   // минимум минут на светлую привычку в день
SESSION_MIN_MIN = 10               // минимальная длительность одной сессии
SESSION_MAX_MIN = 15               // максимальная длительность одной сессии
SESSION_TARGET_MIN = 12            // целевая длина при разбиении (между min и max)
AWARENESS_SESSION_MIN = 5          // тёмные limit-привычки (кроме соцсетей)
DOOM_SCROLL_SESSION_MIN = 15       // уже есть в API
```

---

## 3. Оценка «стоимости» привычки в минутах

Переиспользуем формулы из `packages/domain/src/habits/calibration.ts` (инверсия `recommendedLightGoal`):

| Единица | Минут на единицу цели |
|---------|----------------------|
| `pages` | `1 / BOOKS_PAGES_PER_MIN` (0.5 мин/стр) |
| `minutes` | 1 мин / 1 мин |
| `reps` | `PUSHUP_SECONDS_PER_REP / 60` (2 сек/повт) |
| `seconds` | `1 / 60` |
| `lessons` | 15 мин / урок (фиксированная оценка) |

```ts
function goalToMinutes(unit: HabitUnit, goal: number): number
function minutesToExpectedYield(unit: HabitUnit, minutes: number): number  // подсказка в UI
```

---

## 4. Алгоритм дневного плана (светлая сторона)

**Вход:** `daily_budget_min`, список активных светлых привычек с `current_goal`, `unit`, накопленный `checkin.value`.

**Шаги:**

1. Для каждой привычки:  
   `remaining_goal = max(0, current_goal - checkin.value)`  
   `needed_min = goalToMinutes(unit, remaining_goal)`

2. `total_needed = sum(needed_min)`.  
   Если `total_needed === 0` → план пуст (всё выполнено).

3. **Масштабирование**, если не влезает в бюджет:  
   `scale = min(1, daily_budget_min / total_needed)`  
   `habit_budget_min = needed_min * scale` для каждой привычки.

4. **Разбиение на сессии** для каждой привычки:  
   `session_count = max(1, round(habit_budget_min / SESSION_TARGET_MIN))`  
   `session_min = clamp(SESSION_MIN_MIN, round(habit_budget_min / session_count), SESSION_MAX_MIN)`

5. Собрать массив `DailyPlanBlock[]`, отсортировать:  
   - сначала привычки с незавершённой целью;  
   - внутри — round-robin (1-й блок каждой, потом 2-й…) для разнообразия.

6. Каждый блок:

```ts
type DailyPlanBlock = {
  id: string;              // uuid, стабилен в течение дня
  habit_id: string;
  habit_name: string;
  icon: string | null;
  unit: HabitUnit;
  duration_min: number;
  expected_yield: number;  // подсказка: «~6 стр.»
  order: number;
  status: "pending" | "active" | "completed";
  actual_value: number | null;
  actual_minutes: number | null;
};
```

**Пример:** 60 мин, 3 привычки (книги 20 стр, отжимания 30, бег 15 мин).

| Привычка | needed_min | После scale | Сессии |
|----------|-----------|-------------|--------|
| Книги | 10 | 10 | 1 × 10 мин (~20 стр) |
| Отжимания | 1 | 1 | 1 × 10 мин (min clamp) |
| Бег | 15 | 15 | 1 × 15 мин |

Итого ~35 мин плана из 60 — остаток показываем как «запас» или опциональные повторные сессии.

---

## 5. Поток сессии (все привычки)

```
[Начать] → FocusScreen (таймер) → [Завершить / Закончил раньше]
    → ValuePrompt (ввод результата) → накопление в checkin.value
    → блок → completed, пересчёт плана
```

### Правила ввода после таймера

| Тип / единица | Поведение |
|---------------|-----------|
| Светлая `minutes` (бег, custom) | **Авто:** фактические минуты сессии (досрочный стоп = фактическое время) |
| Светлая `pages`, `reps`, `seconds`, `lessons` | **Ручной ввод** числа + подсказка `expected_yield` |
| Тёмная `limit` (сигареты, сахар, сладости) | Сессия 5 мин «осознанность» → ввод «сколько сегодня всего» (накопительно) |
| Тёмная `social_media` | Сессия 15 мин doom-scroll (существующий API), минуты **авто** |
| Тёмная `abstinence` | **Без сессий** — непрерывный таймер + «Сорвался» (как сейчас) |

### Накопление checkin

- `checkin.value` **суммируется** за день по сессиям.
- `minutes_logged_today` += `actual_minutes` (светлая сторона).
- Успех дня (как сейчас, day-close):  
  - `target`: `value >= current_goal`  
  - `limit`: `value <= current_goal`  
  - `abstinence`: нет срыва

### Досрочное завершение

- `actual_minutes = elapsed` (округление вверх до целой минуты).
- Для не-минутных единиц пользователь всё равно вводит результат вручную.

---

## 6. Ограничение привычек при малом времени (онбординг)

```ts
maxLightHabits = floor(free_time_min / MIN_MINUTES_PER_LIGHT_HABIT)
```

| free_time_min | max светлых |
|---------------|-------------|
| 15 | 1 |
| 30 | 3 |
| 60 | 6 |
| 120 | 12 → **cap at MAX_ACTIVE_HABITS (6)** суммарно светлая+тёмная |

**UI онбординга (светлая сторона):**

- При выборе привычки: если `lightHabits.length >= maxLightHabits` → кнопка неактивна.
- Подсказка: «При 15 мин в день — не больше 1 полезной привычки. Увеличь время или убери лишнее.»
- При изменении ползунка времени — пересчёт лимита, предупреждение если текущий выбор превышает новый лимит.
- Тёмные привычки **не входят** в `maxLightHabits`, но учитываются в общем лимите 6.

---

## 7. UI главной страницы

### Верх (без изменений)

Приветствие, неделя, статистика.

### Блок «План на сегодня» (новый)

```
Сегодня: 25 из 60 мин
[████████░░░░░░░░░░]

📖 Читать книги     10 мин  ~5 стр.   [Начать]
💪 Отжимания        10 мин  ~15 повт. [Начать]
🏃 Бег              15 мин            [Начать]
```

- Активная сессия подсвечена, остальные приглушены.
- Завершённые — галочка, зачёркнуты или внизу списка.
- Тап на карточку привычки → тот же FocusScreen.

### FocusScreen (новый компонент, fullscreen overlay)

- Название привычки, обратный отсчёт `MM:SS`.
- Кнопки: «Пауза», «Закончил раньше».
- По окончании → модалка ввода (если нужна).

### Карточка привычки (упрощение)

- Убрать ползунок как основной UX (оставить «Ввести вручную» в меню «⋯» для edge cases).
- Показать: цель дня, прогресс `value / current_goal`, следующий блок из плана.

---

## 8. API

### Расширение ответов today

```ts
// todayLightResponseSchema
daily_plan: {
  blocks: DailyPlanBlock[];
  minutes_planned: number;
  minutes_completed: number;
  minutes_remaining: number;  // daily_budget_min - minutes_completed
}
```

Тёмная сторона: `daily_plan` только для `limit`-привычек с сессиями (соцсети, awareness); abstinence — без плана.

### Новые эндпоинты (обобщение pomodoro)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/habits/:id/sessions/start` | `{ block_id?: string }` — старт сессии |
| POST | `/habits/:id/sessions/complete` | `{ block_id, actual_value?, ended_early?: boolean }` |
| GET | `/habits/:id/sessions/active` | Активная сессия |

**Таблица `habit_sessions`** (замена/расширение pomodoro_sessions):

```sql
habit_sessions (
  id uuid PK,
  user_id uuid,
  habit_id uuid,
  block_id uuid NULL,       -- ссылка на блок плана (клиентский id, валидируется сервером)
  started_at timestamptz,
  ended_at timestamptz NULL,
  planned_min int NOT NULL,
  actual_min int NULL,
  value_added numeric NULL, -- сколько добавили к checkin
  completed boolean DEFAULT false
)
```

Миграция: pomodoro_sessions → habit_sessions или alias в сервисе.

### Валидация онбординга (сервер)

При `POST /habits` для светлой стороны: если `activeLightCount >= floor(user.free_time_min / 10)` → 400 с понятным сообщением.

---

## 9. Доменная логика (новый модуль)

`packages/domain/src/habits/daily-plan.ts`:

- `goalToMinutes`, `minutesToExpectedYield`
- `buildDailyPlan(budget, habits, checkins): DailyPlan`
- `maxLightHabitsForBudget(freeTimeMin): number`
- Unit-тесты с фиксированными сценариями (15 мин / 1 привычка, 60 мин / 3, переполнение).

Калибровка `recalculateLightGoal` **не меняется** на v1 — план масштабируется, цель остаётся. Если цель нереалистична для бюджета, пользователь получает частичный план + статус «в процессе» до конца дня (существующая логика day-close).

---

## 10. Демо-режим

`demo-api.ts`: генерация `daily_plan` локально тем же алгоритмом из `@mytodo/domain` (без сети).

---

## 11. Вне скоупа v1

- Кнопка «Пересчитать цели» при смене `free_time_min` (TZ v1.1).
- Ротация привычек по дням (вариант B из обсуждения).
- Push-уведомления по окончании сессии (можно добавить позже).
- English module в бюджете (остаётся отдельно по TZ).

---

## 12. Порядок реализации (высокий уровень)

1. **Domain:** `daily-plan.ts` + тесты, `maxLightHabitsForBudget`, убрать cap 60 в `computeDailyBudgetMin`.
2. **API:** `habit_sessions`, эндпоинты, `daily_plan` в `/today/light` и `/today/dark`.
3. **Онбординг:** лимит светлых привычек по времени.
4. **Web:** `DailyPlanList`, `FocusScreen`, `ValuePrompt`, обновить `HabitTaskCard`.
5. **Demo:** синхронизация demo-api.

---

## 13. Тест-план

- [ ] 15 мин + 1 светлая привычка → 1–2 блока, онбординг блокирует 2-ю.
- [ ] 60 мин + 3 светлые → план ≤ 60 мин, round-robin порядок.
- [ ] Цели слишком большие → scale < 1, план укладывается в бюджет.
- [ ] Сессия книг: 10 мин таймер → ввод 8 стр → checkin.value += 8.
- [ ] Сессия бега: 15 мин → auto +15 к value.
- [ ] Соцсети: doom-scroll 15 мин → auto минуты к limit checkin.
- [ ] Abstinence: без плана, таймер работает как раньше.
- [ ] Day-close: progression не меняется от scale, только от success/fail.
