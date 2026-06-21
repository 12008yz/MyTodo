import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  computeDailyBudgetMin,
  HABIT_TEMPLATES,
  type HabitTemplateId,
} from "@mytodo/shared";
import { OnboardingLayout, type OnboardingTheme } from "../../components/OnboardingLayout";
import {
  DARK_ENEMY_META,
  DARK_TEMPLATE_IDS,
  getBaselineLabel,
  HARSHNESS_OPTIONS,
  ONBOARDING_STEPS,
  SUBSCRIPTION_PLANS,
} from "../../features/onboarding/constants";
import {
  LIGHT_PATHS,
  LIGHT_PATH_TAB_LABELS,
  validateLightHabits,
} from "../../features/onboarding/lightPaths";
import type {
  BodyFormData,
  SelectedHabit,
  SelectedTemplateHabit,
} from "../../features/onboarding/types";
import { toCreateHabitRequest } from "../../features/onboarding/types";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  ClientApiError,
  createHabit,
  updateEnglishSettings,
  updateMe as apiUpdateMe,
} from "../../lib/api";
import { LightPathStep } from "./LightPathStep";
import "./OnboardingPage.css";

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function isTemplateSelected(habits: SelectedHabit[], templateId: HabitTemplateId): boolean {
  return habits.some((h) => h.kind === "template" && h.templateId === templateId);
}

function getTemplateHabit(habits: SelectedHabit[], templateId: HabitTemplateId) {
  return habits.find(
    (h): h is SelectedTemplateHabit => h.kind === "template" && h.templateId === templateId,
  );
}

function toggleDarkTemplate(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
): SelectedHabit[] {
  if (isTemplateSelected(habits, templateId)) {
    return habits.filter((h) => !(h.kind === "template" && h.templateId === templateId));
  }
  return [...habits, { kind: "template", templateId, baseline: "" }];
}

function updateTemplateBaseline(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
  baseline: string,
): SelectedHabit[] {
  return habits.map((h) =>
    h.kind === "template" && h.templateId === templateId ? { ...h, baseline } : h,
  );
}

function validateHabits(habits: SelectedHabit[], side: "light" | "dark"): string | null {
  if (side === "light") {
    return validateLightHabits(habits);
  }

  if (habits.length === 0) {
    return "Выбери хотя бы одну привычку для контроля";
  }

  for (const habit of habits) {
    if (habit.kind === "template" && habit.templateId === "nail_biting") continue;
    const baseline = parseNumber(habit.baseline);
    if (!Number.isFinite(baseline) || baseline < 0) {
      const name =
        habit.kind === "template"
          ? HABIT_TEMPLATES[habit.templateId].name
          : habit.name;
      return `Укажи текущий уровень для «${name}»`;
    }
  }

  return null;
}

function HabitCheck({ selected }: { selected: boolean }) {
  return (
    <span className="onboarding__card-check">
      <span className={["onboarding__check", selected ? "onboarding__check--on" : ""].filter(Boolean).join(" ")}>
        {selected ? "✓" : null}
      </span>
    </span>
  );
}

const DEFAULT_BODY: BodyFormData = {
  weightKg: "",
  heightCm: "",
  wakeTime: "07:00",
  sleepTime: "23:00",
  freeTimeMin: 60,
};

export function OnboardingPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [lightHabits, setLightHabits] = useState<SelectedHabit[]>([]);
  const [darkHabits, setDarkHabits] = useState<SelectedHabit[]>([]);
  const [body, setBody] = useState<BodyFormData>(DEFAULT_BODY);
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3>(1);
  const [englishEnabled, setEnglishEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lightPathIndex, setLightPathIndex] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex] ?? "welcome";
  const activeLightPathId = LIGHT_PATHS[lightPathIndex]?.id ?? "mindfulness";
  const isLastLightPath = lightPathIndex >= LIGHT_PATHS.length - 1;
  const progress = Math.round((stepIndex / (ONBOARDING_STEPS.length - 1)) * 100);
  const dailyBudget = useMemo(() => computeDailyBudgetMin(body.freeTimeMin), [body.freeTimeMin]);

  const theme: OnboardingTheme =
    step === "light"
      ? "light"
      : step === "dark"
        ? "dark"
        : step === "finale"
          ? "finale"
          : "default";

  const goNext = () => {
    setError(null);
    setStepIndex((current) => Math.min(current + 1, ONBOARDING_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === "light" && lightPathIndex > 0) {
      setLightPathIndex((current) => current - 1);
      return;
    }
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const finishOnboarding = async () => {
    const weight = parseNumber(body.weightKg);
    const height = parseNumber(body.heightCm);

    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      setError("Укажи вес от 1 до 500 кг");
      setStepIndex(ONBOARDING_STEPS.indexOf("body"));
      return;
    }
    if (!Number.isFinite(height) || height <= 0 || height > 300) {
      setError("Укажи рост от 1 до 300 см");
      setStepIndex(ONBOARDING_STEPS.indexOf("body"));
      return;
    }

    const lightValidation = validateHabits(lightHabits, "light");
    if (lightValidation) {
      setError(lightValidation);
      setStepIndex(ONBOARDING_STEPS.indexOf("light"));
      return;
    }

    const darkValidation = validateHabits(darkHabits, "dark");
    if (darkValidation) {
      setError(darkValidation);
      setStepIndex(ONBOARDING_STEPS.indexOf("dark"));
      return;
    }

    setPending(true);
    setError(null);

    let profileSaved = false;

    try {
      const profile = await apiUpdateMe({
        weight_kg: weight,
        height_cm: height,
        wake_time: body.wakeTime,
        sleep_time: body.sleepTime,
        free_time_min: body.freeTimeMin,
        harshness_level: harshnessLevel,
      });

      profileSaved = profile.onboarding_completed;

      if (!profile.onboarding_completed) {
        throw new Error("Не удалось завершить настройку профиля");
      }

      await updateEnglishSettings({ is_enabled: englishEnabled });

      for (const habit of [...lightHabits, ...darkHabits]) {
        await createHabit(toCreateHabitRequest(habit));
      }

      await refreshUser();
      navigate("/", { replace: true });
    } catch (err) {
      if (profileSaved) {
        await refreshUser();
      }

      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось завершить настройку",
      );
    } finally {
      setPending(false);
    }
  };

  const handleContinue = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);

    switch (step) {
      case "welcome":
        setLightPathIndex(0);
        goNext();
        return;

      case "light": {
        if (!isLastLightPath) {
          setLightPathIndex((current) => current + 1);
          return;
        }

        const validation = validateHabits(lightHabits, "light");
        if (validation) {
          setError(validation);
          return;
        }
        goNext();
        return;
      }

      case "dark": {
        const validation = validateHabits(darkHabits, "dark");
        if (validation) {
          setError(validation);
          return;
        }
        goNext();
        return;
      }

      case "body": {
        const weight = parseNumber(body.weightKg);
        const height = parseNumber(body.heightCm);
        if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
          setError("Укажи вес от 1 до 500 кг");
          return;
        }
        if (!Number.isFinite(height) || height <= 0 || height > 300) {
          setError("Укажи рост от 1 до 300 см");
          return;
        }
        goNext();
        return;
      }

      case "harshness":
        goNext();
        return;

      case "finale":
        await finishOnboarding();
        return;
    }
  };

  const primaryLabel = (() => {
    if (pending) return "Сохранение…";
    if (step === "welcome") return "Да, погнали!";
    if (step === "light" && !isLastLightPath) {
      const nextPath = LIGHT_PATHS[lightPathIndex + 1];
      return nextPath ? `Далее: ${LIGHT_PATH_TAB_LABELS[nextPath.id]}` : "Далее";
    }
    if (step === "finale") return "Начать новую главу";
    return "Далее";
  })();

  const renderDarkEnemyCards = (
    habits: SelectedHabit[],
    onChange: (next: SelectedHabit[]) => void,
  ) => (
    <div className="onboarding__cards onboarding__cards--enemies">
      {DARK_TEMPLATE_IDS.map((templateId) => {
        const template = HABIT_TEMPLATES[templateId];
        const meta = DARK_ENEMY_META[templateId];
        const selected = getTemplateHabit(habits, templateId);
        const isAbstinence = templateId === "nail_biting";

        return (
          <div key={templateId}>
            <button
              type="button"
              className={[
                "onboarding__card",
                "onboarding__card--enemy",
                selected ? "onboarding__card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(toggleDarkTemplate(habits, templateId))}
            >
              <span className="onboarding__enemy-emoji">{meta.emoji}</span>
              <span className="onboarding__enemy-body">
                <span className="onboarding__enemy-name">{template.name}</span>
                <span className="onboarding__enemy-hint">
                  {isAbstinence ? "Режим полного отказа" : meta.unitHint}
                </span>
              </span>
              {selected && isAbstinence ? (
                <span className="onboarding__enemy-badge">❌</span>
              ) : (
                <HabitCheck selected={Boolean(selected)} />
              )}
            </button>
            {selected && !isAbstinence ? (
              <div className="onboarding__enemy-baseline">
                <label className="onboarding__label">
                  {getBaselineLabel(templateId)}
                  <input
                    className="onboarding__input"
                    type="number"
                    min={0}
                    value={selected.baseline}
                    onChange={(e) =>
                      onChange(updateTemplateBaseline(habits, templateId, e.target.value))
                    }
                  />
                </label>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <OnboardingLayout progress={progress} theme={theme}>
      <div className={["onboarding", step === "welcome" ? "onboarding--welcome" : ""].filter(Boolean).join(" ")}>
        <form
          className={["onboarding__form", step === "welcome" ? "onboarding__form--welcome" : ""]
            .filter(Boolean)
            .join(" ")}
          onSubmit={handleContinue}
          noValidate
        >
          <div className="onboarding__scroll">
            {step === "welcome" ? (
              <div className="onboarding__welcome">
                <p className="onboarding__eyebrow onboarding__eyebrow--center">Новая глава</p>
                <h1 className="onboarding__title onboarding__title--welcome">Привет, воин!</h1>
                <div className="onboarding__navigator-card">
                  <div className="onboarding__navigator-head">
                    <div className="onboarding__navigator-avatar" aria-hidden="true">
                      <img
                        src="/loginAndRegister/blue-stopwatch-pink-arrow.png"
                        width={34}
                        height={42}
                        decoding="async"
                        alt=""
                      />
                    </div>
                    <div className="onboarding__navigator-meta">
                      <p className="onboarding__navigator-name">Твой навигатор</p>
                      <p className="onboarding__navigator-role">Проведёт через все шаги</p>
                    </div>
                  </div>
                  <p className="onboarding__speech onboarding__speech--navigator">
                    Давай выясним, кто ты сейчас и куда хочешь прийти. Это займёт всего 3 минуты,
                    но изменит твою жизнь на годы вперёд. <strong>Готов?</strong>
                  </p>
                </div>
                <ul className="onboarding__welcome-pills" aria-label="Что тебя ждёт">
                  <li className="onboarding__welcome-pill">⏱ 3 мин</li>
                  <li className="onboarding__welcome-pill">🎯 План</li>
                  <li className="onboarding__welcome-pill">💪 Поддержка</li>
                </ul>
              </div>
            ) : null}

            {step === "light" ? (
              <LightPathStep
                lightHabits={lightHabits}
                activePathId={activeLightPathId}
                onActivePathChange={(pathId) => {
                  const index = LIGHT_PATHS.findIndex((path) => path.id === pathId);
                  if (index >= 0) setLightPathIndex(index);
                }}
                onChange={setLightHabits}
              />
            ) : null}

            {step === "dark" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 2 · Тёмная сторона 🌑</p>
                <h1 className="onboarding__title">Что тянет тебя на дно?</h1>
                <p className="onboarding__subtitle">
                  Пришло время отрубить хвосты. Выбери то, с чем ты хочешь покончить навсегда.
                  Я буду рядом, но рубить придётся тебе.
                </p>
                <p className="onboarding__counter">
                  Светлых: {lightHabits.length} · тёмных: {darkHabits.length}
                </p>
                {renderDarkEnemyCards(darkHabits, setDarkHabits)}
              </>
            ) : null}

            {step === "body" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 3</p>
                <h1 className="onboarding__title">Давай заложим фундамент</h1>
                <p className="onboarding__subtitle">
                  Ответь на несколько вопросов, чтобы я подстроил нагрузку под твой реальный день,
                  а не под абстрактный идеал.
                </p>
                <div className="onboarding__field-grid">
                  <div className="onboarding__field-grid onboarding__field-grid--2">
                    <label className="onboarding__label">
                      Вес (кг)
                      <input
                        className="onboarding__input"
                        type="number"
                        value={body.weightKg}
                        onChange={(e) => setBody((c) => ({ ...c, weightKg: e.target.value }))}
                      />
                    </label>
                    <label className="onboarding__label">
                      Рост (см)
                      <input
                        className="onboarding__input"
                        type="number"
                        value={body.heightCm}
                        onChange={(e) => setBody((c) => ({ ...c, heightCm: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="onboarding__field-grid onboarding__field-grid--2">
                    <label className="onboarding__label">
                      Подъём
                      <input
                        className="onboarding__input"
                        type="time"
                        value={body.wakeTime}
                        onChange={(e) => setBody((c) => ({ ...c, wakeTime: e.target.value }))}
                      />
                    </label>
                    <label className="onboarding__label">
                      Сон
                      <input
                        className="onboarding__input"
                        type="time"
                        value={body.sleepTime}
                        onChange={(e) => setBody((c) => ({ ...c, sleepTime: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div>
                    <p className="onboarding__label">Сколько свободного времени в день?</p>
                    <div className="onboarding__slider-value">{body.freeTimeMin} мин</div>
                    <input
                      className="onboarding__slider"
                      type="range"
                      min={15}
                      max={180}
                      step={5}
                      value={body.freeTimeMin}
                      onChange={(e) =>
                        setBody((c) => ({ ...c, freeTimeMin: Number(e.target.value) }))
                      }
                    />
                    <div className="onboarding__slider-labels">
                      <span>15 мин</span>
                      <span>3 часа</span>
                    </div>
                  </div>
                </div>
                <p className="onboarding__preview">
                  Твой план на день займёт около {dailyBudget} минут. Это реально?
                </p>
              </>
            ) : null}

            {step === "harshness" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 4</p>
                <h1 className="onboarding__title">Как ты хочешь, чтобы я с тобой разговаривал?</h1>
                <p className="onboarding__subtitle">
                  Выбери голос, который тебя заведёт. Ты всегда сможешь его сменить.
                </p>
                <div className="onboarding__choices">
                  {HARSHNESS_OPTIONS.map((option) => (
                    <button
                      key={option.level}
                      type="button"
                      className={[
                        "onboarding__choice",
                        harshnessLevel === option.level ? "onboarding__choice--selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setHarshnessLevel(option.level)}
                    >
                      <span className="onboarding__choice-emoji">{option.emoji}</span>
                      <span>
                        <p className="onboarding__choice-title">{option.title}</p>
                        <p className="onboarding__choice-quote">{option.quote}</p>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === "finale" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 5</p>
                <h1 className="onboarding__title">Это твой момент</h1>
                <p className="onboarding__subtitle">
                  Ты только что создал свою «Новую главу». Теперь у тебя есть план, цель и контроль.
                </p>
                <div className="onboarding__toggle-row">
                  <span>Учить английский? Это +5 минут в день</span>
                  <input
                    type="checkbox"
                    checked={englishEnabled}
                    onChange={(e) => setEnglishEnabled(e.target.checked)}
                  />
                </div>
                <div className="onboarding__plans">
                  <p className="onboarding__subtitle" style={{ marginBottom: 0 }}>
                    3 дня бесплатно, затем тариф «Боец»:
                  </p>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div key={plan.id} className="onboarding__plan">
                      {plan.label} — <strong>{plan.price}</strong>
                    </div>
                  ))}
                </div>
                <p className="onboarding__speech onboarding__speech--finale">
                  Ты сделал первый шаг — самый трудный. Теперь приложение будет вести тебя
                  день за днём. Ты не один. Вперёд, к новой главе.
                </p>
              </>
            ) : null}

            {error ? <p className="onboarding__error">{error}</p> : null}
          </div>

          <div
            className={[
              "onboarding__actions",
              step === "welcome" ? "onboarding__actions--welcome" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button type="submit" className="onboarding__btn" disabled={pending}>
              {primaryLabel}
            </button>
            {stepIndex > 0 ? (
              <button
                type="button"
                className="onboarding__back"
                onClick={goBack}
                disabled={pending}
              >
                Назад
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </OnboardingLayout>
  );
}
