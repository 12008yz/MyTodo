import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "../../components/ContentPanels/ContentPanels.css";
import { OnboardingLayout, type OnboardingTheme } from "../../components/OnboardingLayout";
import {
  GENDER_OPTIONS,
  HARSHNESS_OPTIONS,
  ONBOARDING_STEPS,
  SUBSCRIPTION_PLANS,
} from "../../features/onboarding/constants";
import { validateDarkHabits } from "../../features/onboarding/darkPaths";
import {
  LIGHT_PATHS,
  LIGHT_PATH_TAB_LABELS,
  validateLightHabits,
} from "../../features/onboarding/lightPaths";
import type {
  BodyFormData,
  LightPathId,
  OnboardingStepId,
  SelectedHabit,
} from "../../features/onboarding/types";
import { toCreateHabitRequest } from "../../features/onboarding/types";
import { useAuth } from "../../features/auth/AuthProvider";
import { useContentSwitchTransition } from "../../hooks/useContentSwitchTransition";
import {
  ClientApiError,
  createHabit,
  updateEnglishSettings,
  updateMe as apiUpdateMe,
} from "../../lib/api";
import { LightPathStep, type LightPathStepHandle } from "./LightPathStep";
import { DarkPathStep } from "./DarkPathStep";
import { TimeInput24 } from "./TimeInput24";
import "./OnboardingPage.css";

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

const FREE_TIME_SLIDER_MIN = 0;
const FREE_TIME_SLIDER_MAX = 120;
const FREE_TIME_MIN = 15;
const FREE_TIME_STEP = 5;

function validateBodyForm(body: BodyFormData): string | null {
  const weight = parseNumber(body.weightKg);
  const height = parseNumber(body.heightCm);
  const age = parseNumber(body.age);

  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
    return "Укажи вес от 1 до 500 кг";
  }
  if (!Number.isFinite(height) || !Number.isInteger(height) || height <= 0 || height > 300) {
    return "Укажи рост от 1 до 300 см";
  }
  if (!Number.isFinite(age) || !Number.isInteger(age) || age < 10 || age > 120) {
    return "Укажи возраст от 10 до 120 лет";
  }
  if (!body.gender) {
    return "Выбери пол";
  }
  if (body.freeTimeMin < FREE_TIME_MIN) {
    return "Минимум 15 минут свободного времени";
  }

  return null;
}

function validateHabits(habits: SelectedHabit[], side: "light" | "dark"): string | null {
  if (side === "light") {
    return validateLightHabits(habits);
  }

  return validateDarkHabits(habits);
}

const DEFAULT_BODY: BodyFormData = {
  age: "",
  gender: null,
  weightKg: "",
  heightCm: "",
  wakeTime: "07:00",
  sleepTime: "23:00",
  freeTimeMin: 60,
};

export function OnboardingPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lightPathStepRef = useRef<LightPathStepHandle>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [lightHabits, setLightHabits] = useState<SelectedHabit[]>([]);
  const [darkHabits, setDarkHabits] = useState<SelectedHabit[]>([]);
  const [body, setBody] = useState<BodyFormData>(DEFAULT_BODY);
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3>(1);
  const [englishEnabled, setEnglishEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lightPathIndex, setLightPathIndex] = useState(0);
  const [isLightPathTransitioning, setIsLightPathTransitioning] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex] ?? "welcome";
  const activeLightPathId = LIGHT_PATHS[lightPathIndex]?.id ?? "mindfulness";
  const isLastLightPath = lightPathIndex >= LIGHT_PATHS.length - 1;
  const progress = Math.round((stepIndex / (ONBOARDING_STEPS.length - 1)) * 100);

  const handleStepChange = useCallback((nextStep: OnboardingStepId) => {
    const nextIndex = ONBOARDING_STEPS.indexOf(nextStep);
    if (nextIndex >= 0) {
      setStepIndex(nextIndex);
      scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  const handleActivePathChange = useCallback((pathId: LightPathId) => {
    const index = LIGHT_PATHS.findIndex((path) => path.id === pathId);
    if (index >= 0) setLightPathIndex(index);
  }, []);

  const handlePathTransitionChange = useCallback((isTransitioning: boolean) => {
    setIsLightPathTransitioning(isTransitioning);
  }, []);

  const {
    wrapperRef: stepPanelsRef,
    wrapperClassName: stepPanelsClassName,
    switchTo: switchStep,
    getPanelClassName: getStepPanelClassName,
    getTransitionModifiers: getStepActionModifiers,
    getPanelState: getStepPanelState,
    isTransitioning: isStepTransitioning,
  } = useContentSwitchTransition<OnboardingStepId>({
    activeKey: step,
    onActiveKeyChange: handleStepChange,
    disabled: pending,
  });

  const actionTransitionModifiers = getStepActionModifiers("onboarding__actions", {
    includeEnter: false,
  });

  const actionsClassName = [
    "onboarding__actions",
    step === "welcome" ? "onboarding__actions--welcome" : "",
    actionTransitionModifiers,
    isStepTransitioning || isLightPathTransitioning ? "onboarding__actions--locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isInteractionLocked = isStepTransitioning || isLightPathTransitioning;

  useEffect(() => {
    if (step === "light") return;
    setIsLightPathTransitioning(false);
  }, [step]);

  const theme: OnboardingTheme =
    step === "light"
      ? "light"
      : step === "dark"
        ? "dark"
        : step === "finale"
          ? "finale"
          : "default";

  const commitFreeTimeSlider = useCallback(() => {
    setBody((current) =>
      current.freeTimeMin < FREE_TIME_MIN
        ? { ...current, freeTimeMin: FREE_TIME_MIN }
        : current,
    );
  }, []);

  const goToStepIndex = (index: number) => {
    const target = ONBOARDING_STEPS[index];
    if (!target) return;

    if (target === step) {
      setStepIndex(index);
      return;
    }

    switchStep(target);
  };

  const goNext = () => {
    setError(null);
    goToStepIndex(Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1));
  };

  const goBack = () => {
    if (pending || isInteractionLocked) return;
    setError(null);
    if (step === "light" && lightPathIndex > 0) {
      const prevPath = LIGHT_PATHS[lightPathIndex - 1];
      if (prevPath) {
        lightPathStepRef.current?.switchToPath(prevPath.id);
      }
      return;
    }
    goToStepIndex(Math.max(stepIndex - 1, 0));
  };

  const finishOnboarding = async () => {
    const bodyValidation = validateBodyForm(body);
    if (bodyValidation) {
      setError(bodyValidation);
      goToStepIndex(ONBOARDING_STEPS.indexOf("body"));
      return;
    }

    const weight = parseNumber(body.weightKg);
    const height = parseNumber(body.heightCm);
    const age = parseNumber(body.age);

    const lightValidation = validateHabits(lightHabits, "light");
    if (lightValidation) {
      setError(lightValidation);
      goToStepIndex(ONBOARDING_STEPS.indexOf("light"));
      return;
    }

    const darkValidation = validateHabits(darkHabits, "dark");
    if (darkValidation) {
      setError(darkValidation);
      goToStepIndex(ONBOARDING_STEPS.indexOf("dark"));
      return;
    }

    setPending(true);
    setError(null);

    let profileSaved = false;

    try {
      const profile = await apiUpdateMe({
        age,
        gender: body.gender!,
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
    if (pending || isInteractionLocked) return;
    setError(null);

    switch (step) {
      case "welcome":
        setLightPathIndex(0);
        goNext();
        return;

      case "light": {
        if (!isLastLightPath) {
          const nextPath = LIGHT_PATHS[lightPathIndex + 1];
          if (nextPath) {
            lightPathStepRef.current?.switchToPath(nextPath.id);
          }
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
        const validation = validateBodyForm(body);
        if (validation) {
          setError(validation);
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

  const renderStepContent = (stepId: OnboardingStepId) => {
    switch (stepId) {
      case "welcome":
        return (
          <div className="onboarding__welcome">
            <p className="onboarding__eyebrow onboarding__eyebrow--center">Новая глава</p>
            <h1 className="onboarding__title onboarding__title--welcome">Привет, воин!</h1>
            <div className="onboarding__navigator-card">
              <div className="onboarding__navigator-head">
                <div className="onboarding__navigator-avatar" aria-hidden="true">
                  <img
                    src="/iconsApp/clock.png"
                    width={52}
                    height={52}
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
        );

      case "light":
        return (
          <LightPathStep
            ref={lightPathStepRef}
            lightHabits={lightHabits}
            activePathId={activeLightPathId}
            onActivePathChange={handleActivePathChange}
            onChange={setLightHabits}
            onPathTransitionChange={handlePathTransitionChange}
          />
        );

      case "dark":
        return (
          <DarkPathStep
            darkHabits={darkHabits}
            onChange={setDarkHabits}
            isPathTransitioning={isStepTransitioning}
            scrollContainerRef={scrollRef}
          />
        );

      case "body": {
        const isFreeTimeTooLow = body.freeTimeMin < FREE_TIME_MIN;

        return (
          <div className="onboarding__body-step">
            <p className="onboarding__eyebrow">Шаг 3</p>
            <h1 className="onboarding__title">Давай заложим фундамент</h1>
            <p className="onboarding__subtitle">
              Ответь на несколько вопросов, чтобы я подстроил нагрузку под твой реальный день,
              а не под абстрактный идеал.
            </p>
            <div className="onboarding__field-grid onboarding__body-form">
              <div className="onboarding__field-grid onboarding__field-grid--3">
                <label className="onboarding__label">
                  Вес (кг)
                  <input
                    className="onboarding__input"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={body.weightKg}
                    onChange={(e) => setBody((c) => ({ ...c, weightKg: e.target.value }))}
                  />
                </label>
                <label className="onboarding__label">
                  Рост (см)
                  <input
                    className="onboarding__input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={body.heightCm}
                    onChange={(e) => setBody((c) => ({ ...c, heightCm: e.target.value }))}
                  />
                </label>
                <label className="onboarding__label">
                  Возраст
                  <input
                    className="onboarding__input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={body.age}
                    onChange={(e) => setBody((c) => ({ ...c, age: e.target.value }))}
                  />
                </label>
              </div>
              <div>
                <p className="onboarding__label">Пол</p>
                <div className="onboarding__gender-options" role="radiogroup" aria-label="Пол">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={body.gender === option.value}
                      className={[
                        "onboarding__gender-option",
                        body.gender === option.value ? "onboarding__gender-option--selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setBody((c) => ({ ...c, gender: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="onboarding__time-fields">
                <label className="onboarding__label" htmlFor="onboarding-wake-hour">
                  Подъём
                  <TimeInput24
                    id="onboarding-wake"
                    value={body.wakeTime}
                    onChange={(wakeTime) => setBody((c) => ({ ...c, wakeTime }))}
                  />
                </label>
                <label className="onboarding__label" htmlFor="onboarding-sleep-hour">
                  Сон
                  <TimeInput24
                    id="onboarding-sleep"
                    value={body.sleepTime}
                    onChange={(sleepTime) => setBody((c) => ({ ...c, sleepTime }))}
                  />
                </label>
              </div>
              <div className="onboarding__slider-field">
                <p className="onboarding__label">Сколько свободного времени в день?</p>
                <div
                  className={[
                    "onboarding__slider-value",
                    isFreeTimeTooLow ? "onboarding__slider-value--invalid" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {body.freeTimeMin} мин
                </div>
                <div
                  className={[
                    "onboarding__slider-wrap",
                    isFreeTimeTooLow ? "onboarding__slider-wrap--invalid" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    className="onboarding__slider"
                    type="range"
                    min={FREE_TIME_SLIDER_MIN}
                    max={FREE_TIME_SLIDER_MAX}
                    step={FREE_TIME_STEP}
                    value={body.freeTimeMin}
                    aria-invalid={isFreeTimeTooLow}
                    aria-valuemin={FREE_TIME_MIN}
                    aria-valuemax={FREE_TIME_SLIDER_MAX}
                    onChange={(e) =>
                      setBody((c) => ({ ...c, freeTimeMin: Number(e.target.value) }))
                    }
                    onMouseUp={commitFreeTimeSlider}
                    onTouchEnd={commitFreeTimeSlider}
                    onKeyUp={commitFreeTimeSlider}
                  />
                </div>
                {isFreeTimeTooLow ? (
                  <p className="onboarding__slider-warning" role="alert">
                    Минимум 15 минут — меньше выбрать нельзя
                  </p>
                ) : null}
                <div className="onboarding__slider-labels">
                  <span>15 мин</span>
                  <span>2 часа</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "harshness":
        return (
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
        );

      case "finale":
        return (
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
        );
    }
  };

  return (
    <OnboardingLayout progress={progress} theme={theme}>
      <div
        className={[
          "onboarding",
          step === "welcome" ? "onboarding--welcome" : "",
          step === "dark" ? "onboarding--dark-step" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <form
          className={["onboarding__form", step === "welcome" ? "onboarding__form--welcome" : ""]
            .filter(Boolean)
            .join(" ")}
          onSubmit={handleContinue}
          noValidate
        >
          <div ref={scrollRef} className="onboarding__scroll">
            <div
              ref={stepPanelsRef}
              className={["onboarding__step-surface", stepPanelsClassName].filter(Boolean).join(" ")}
            >
              <div className="onboarding__panels">
                {ONBOARDING_STEPS.map((stepId) => {
                  const panelState = getStepPanelState(stepId);
                  const interactive = panelState === "visible";

                  return (
                    <div
                      key={stepId}
                      className={getStepPanelClassName(stepId, "onboarding__panel content-panel")}
                      aria-hidden={!interactive}
                    >
                      {renderStepContent(stepId)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {error ? <p className="onboarding__error">{error}</p> : null}

          <div className={actionsClassName}>
            <button
              type="submit"
              className="onboarding__btn"
              disabled={pending}
              aria-disabled={pending || isInteractionLocked}
            >
              {primaryLabel}
            </button>
            {stepIndex > 0 ? (
              <button
                type="button"
                className="onboarding__back"
                onClick={goBack}
                disabled={pending}
                aria-disabled={pending || isInteractionLocked}
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
