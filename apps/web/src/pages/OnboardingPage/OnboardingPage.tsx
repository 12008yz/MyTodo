import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  computeDailyBudgetMin,
  GENDERS,
  HABIT_TEMPLATES,
  MAX_ACTIVE_HABITS,
  type Gender,
  type HabitTemplateId,
} from "@mytodo/shared";
import { OnboardingLayout, type OnboardingTheme } from "../../components/OnboardingLayout";
import {
  DARK_TEMPLATE_IDS,
  getBaselineLabel,
  getDarkSpeech,
  getLightSpeech,
  HARSHNESS_OPTIONS,
  LIGHT_TEMPLATE_IDS,
  ONBOARDING_STEPS,
  SUBSCRIPTION_PLANS,
  unitLabel,
} from "../../features/onboarding/constants";
import type {
  BodyFormData,
  RegisterFormData,
  SelectedCustomHabit,
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
import "./OnboardingPage.css";

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function resolveStepIndex(index: number, authenticated: boolean, direction: 1 | -1): number {
  let next = index + direction;
  while (next >= 0 && next < ONBOARDING_STEPS.length) {
    if (ONBOARDING_STEPS[next] === "register" && authenticated) {
      next += direction;
      continue;
    }
    return next;
  }
  return Math.min(Math.max(next, 0), ONBOARDING_STEPS.length - 1);
}

function isTemplateSelected(habits: SelectedHabit[], templateId: HabitTemplateId): boolean {
  return habits.some((h) => h.kind === "template" && h.templateId === templateId);
}

function getTemplateHabit(habits: SelectedHabit[], templateId: HabitTemplateId) {
  return habits.find(
    (h): h is SelectedTemplateHabit => h.kind === "template" && h.templateId === templateId,
  );
}

function toggleTemplate(
  habits: SelectedHabit[],
  templateId: HabitTemplateId,
  totalCount: number,
): SelectedHabit[] {
  if (isTemplateSelected(habits, templateId)) {
    return habits.filter((h) => !(h.kind === "template" && h.templateId === templateId));
  }
  if (totalCount >= MAX_ACTIVE_HABITS) return habits;
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
  if (habits.length === 0) {
    return side === "light"
      ? "Выбери хотя бы одну привычку для роста"
      : "Выбери хотя бы одну привычку для контроля";
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

function buildSpeech(habits: SelectedHabit[], side: "light" | "dark"): string | null {
  const first = habits[0];
  if (!first) return null;

  if (first.kind === "template") {
    const template = HABIT_TEMPLATES[first.templateId];
    if (first.templateId === "nail_biting") {
      return getDarkSpeech(template.name, 0, "отказ");
    }
    const baseline = parseNumber(first.baseline);
    if (side === "light") {
      return getLightSpeech(template.name, baseline, unitLabel(template.unit));
    }
    return getDarkSpeech(template.name, baseline, unitLabel(template.unit));
  }

  const baseline = parseNumber(first.baseline);
  return getLightSpeech(first.name, baseline, unitLabel(first.unit));
}

const DEFAULT_BODY: BodyFormData = {
  weightKg: "",
  heightCm: "",
  wakeTime: "07:00",
  sleepTime: "23:00",
  freeTimeMin: 60,
};

const DEFAULT_REGISTER: RegisterFormData = {
  name: "",
  email: "",
  password: "",
  age: "",
  gender: "other",
};

export function OnboardingPage() {
  const { user, isAuthenticated, register, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [registerForm, setRegisterForm] = useState(DEFAULT_REGISTER);
  const [lightHabits, setLightHabits] = useState<SelectedHabit[]>([]);
  const [darkHabits, setDarkHabits] = useState<SelectedHabit[]>([]);
  const [body, setBody] = useState<BodyFormData>(DEFAULT_BODY);
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3>(1);
  const [englishEnabled, setEnglishEnabled] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<SelectedCustomHabit["unit"]>("minutes");
  const [customBaseline, setCustomBaseline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex] ?? "welcome";
  const totalHabits = lightHabits.length + darkHabits.length;
  const progress = Math.round((stepIndex / (ONBOARDING_STEPS.length - 1)) * 100);
  const dailyBudget = useMemo(() => computeDailyBudgetMin(body.freeTimeMin), [body.freeTimeMin]);
  const lightSpeech = useMemo(() => {
    if (step !== "light" || validateHabits(lightHabits, "light")) return null;
    return buildSpeech(lightHabits, "light");
  }, [step, lightHabits]);
  const darkSpeech = useMemo(() => {
    if (step !== "dark" || validateHabits(darkHabits, "dark")) return null;
    return buildSpeech(darkHabits, "dark");
  }, [step, darkHabits]);

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
    setStepIndex((current) => resolveStepIndex(current, isAuthenticated, 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((current) => resolveStepIndex(current, isAuthenticated, -1));
  };

  const handleRegister = async () => {
    const age = Number(registerForm.age);
    if (!registerForm.name.trim()) {
      setError("Укажи имя");
      return;
    }
    if (!registerForm.email.trim()) {
      setError("Укажи email");
      return;
    }
    if (registerForm.password.length < 8) {
      setError("Пароль — минимум 8 символов");
      return;
    }
    if (!Number.isInteger(age) || age < 10 || age > 120) {
      setError("Укажи возраст от 10 до 120");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await register({
        email: registerForm.email.trim(),
        password: registerForm.password,
        name: registerForm.name.trim(),
        age,
        gender: registerForm.gender,
      });
      goNext();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setPending(false);
    }
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

    if (totalHabits > MAX_ACTIVE_HABITS) {
      setError(`Максимум ${MAX_ACTIVE_HABITS} привычек`);
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
        goNext();
        return;

      case "register":
        if (isAuthenticated) {
          goNext();
          return;
        }
        await handleRegister();
        return;

      case "light": {
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
        if (!isAuthenticated) {
          setError("Сначала пройди регистрацию");
          setStepIndex(ONBOARDING_STEPS.indexOf("register"));
          return;
        }
        await finishOnboarding();
        return;
    }
  };

  const addCustomHabit = () => {
    if (!customName.trim()) {
      setError("Укажи название занятия");
      return;
    }
    const baseline = parseNumber(customBaseline);
    if (!Number.isFinite(baseline) || baseline < 0) {
      setError("Укажи текущий уровень");
      return;
    }
    if (totalHabits >= MAX_ACTIVE_HABITS) {
      setError(`Максимум ${MAX_ACTIVE_HABITS} привычек`);
      return;
    }

    setLightHabits((current) => [
      ...current,
      {
        kind: "custom",
        name: customName.trim(),
        unit: customUnit,
        baseline: customBaseline,
      },
    ]);
    setCustomOpen(false);
    setCustomName("");
    setCustomBaseline("");
    setError(null);
  };

  const primaryLabel = (() => {
    if (pending) return "Сохранение…";
    if (step === "welcome") return "Да, погнали!";
    if (step === "register") return isAuthenticated ? "Далее" : "Создать аккаунт";
    if (step === "finale") return "Начать новую главу";
    return "Далее";
  })();

  const renderHabitCards = (
    templateIds: HabitTemplateId[],
    habits: SelectedHabit[],
    onChange: (next: SelectedHabit[]) => void,
  ) => (
    <div className="onboarding__cards">
      {templateIds.map((templateId) => {
        const template = HABIT_TEMPLATES[templateId];
        const selected = getTemplateHabit(habits, templateId);
        return (
          <div key={templateId}>
            <button
              type="button"
              className={[
                "onboarding__card",
                selected ? "onboarding__card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                onChange(toggleTemplate(habits, templateId, totalHabits))
              }
            >
              <div className="onboarding__card-head">
                <span className="onboarding__card-icon">{template.icon.startsWith("/") ? "✨" : template.icon}</span>
                <span className="onboarding__card-title">{template.name}</span>
              </div>
            </button>
            {selected && templateId !== "nail_biting" ? (
              <div style={{ marginTop: "0.5rem" }}>
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
      <div className="onboarding">
        <form className="onboarding__form" onSubmit={handleContinue} noValidate>
          <div className="onboarding__scroll">
            {step === "welcome" ? (
              <>
                <p className="onboarding__eyebrow">Новая глава</p>
                <h1 className="onboarding__title">Привет, воин!</h1>
                <p className="onboarding__subtitle">
                  Я — твой навигатор. Давай выясним, кто ты сейчас и куда хочешь прийти.
                  Это займёт всего 3 минуты, но изменит твою жизнь на годы вперёд. Готов?
                </p>
              </>
            ) : null}

            {step === "register" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 1</p>
                <h1 className="onboarding__title">Кто ты?</h1>
                <p className="onboarding__subtitle">
                  Чтобы я подобрал тебе идеальный план, давай познакомимся поближе.
                  Твои ответы останутся строго между нами.
                </p>
                {isAuthenticated ? (
                  <p className="onboarding__subtitle">
                    Ты уже в системе{user?.name ? `, ${user.name}` : ""}. Можем двигаться дальше.
                  </p>
                ) : (
                  <div className="onboarding__field-grid">
                    <label className="onboarding__label">
                      Имя
                      <input
                        className="onboarding__input"
                        value={registerForm.name}
                        onChange={(e) =>
                          setRegisterForm((c) => ({ ...c, name: e.target.value }))
                        }
                      />
                    </label>
                    <label className="onboarding__label">
                      Email
                      <input
                        className="onboarding__input"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) =>
                          setRegisterForm((c) => ({ ...c, email: e.target.value }))
                        }
                      />
                    </label>
                    <label className="onboarding__label">
                      Пароль
                      <input
                        className="onboarding__input"
                        type="password"
                        minLength={8}
                        value={registerForm.password}
                        onChange={(e) =>
                          setRegisterForm((c) => ({ ...c, password: e.target.value }))
                        }
                      />
                    </label>
                    <div className="onboarding__field-grid onboarding__field-grid--2">
                      <label className="onboarding__label">
                        Возраст
                        <input
                          className="onboarding__input"
                          type="number"
                          min={10}
                          max={120}
                          value={registerForm.age}
                          onChange={(e) =>
                            setRegisterForm((c) => ({ ...c, age: e.target.value }))
                          }
                        />
                      </label>
                      <label className="onboarding__label">
                        Пол
                        <select
                          className="onboarding__select"
                          value={registerForm.gender}
                          onChange={(e) =>
                            setRegisterForm((c) => ({
                              ...c,
                              gender: e.target.value as Gender,
                            }))
                          }
                        >
                          {GENDERS.map((gender) => (
                            <option key={gender} value={gender}>
                              {gender === "male"
                                ? "Мужской"
                                : gender === "female"
                                  ? "Женский"
                                  : "Другой"}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {step === "light" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 2 · Светлая сторона ☀️</p>
                <h1 className="onboarding__title">Что ты хочешь прокачать в себе?</h1>
                <p className="onboarding__subtitle">
                  Выбери то, что зажигает тебя. Это будут твои новые суперсилы.
                  Добавь свои, если хочешь.
                </p>
                <p className="onboarding__counter">Выбрано {totalHabits}/{MAX_ACTIVE_HABITS}</p>
                {renderHabitCards(LIGHT_TEMPLATE_IDS, lightHabits, setLightHabits)}
                <button
                  type="button"
                  className="onboarding__card onboarding__card-add"
                  style={{ marginTop: "0.625rem" }}
                  onClick={() => setCustomOpen((v) => !v)}
                >
                  + Своё занятие
                </button>
                {customOpen ? (
                  <div className="onboarding__custom-box" style={{ marginTop: "0.625rem" }}>
                    <label className="onboarding__label">
                      Название
                      <input
                        className="onboarding__input"
                        placeholder="Программирование"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                    </label>
                    <label className="onboarding__label">
                      Единица
                      <select
                        className="onboarding__select"
                        value={customUnit}
                        onChange={(e) =>
                          setCustomUnit(e.target.value as SelectedCustomHabit["unit"])
                        }
                      >
                        <option value="minutes">Минуты</option>
                        <option value="pages">Страницы</option>
                        <option value="reps">Раз</option>
                        <option value="lessons">Уроки</option>
                      </select>
                    </label>
                    <label className="onboarding__label">
                      Сколько сейчас в день?
                      <input
                        className="onboarding__input"
                        type="number"
                        min={0}
                        value={customBaseline}
                        onChange={(e) => setCustomBaseline(e.target.value)}
                      />
                    </label>
                    <button type="button" className="onboarding__btn" onClick={addCustomHabit}>
                      Добавить
                    </button>
                  </div>
                ) : null}
                {lightHabits.map((habit, index) => {
                  if (habit.kind !== "custom") return null;
                  return (
                    <div
                      key={`custom-${index}`}
                      className="onboarding__card onboarding__card--selected"
                      style={{ marginTop: "0.625rem" }}
                    >
                      <div className="onboarding__card-head">
                        <span className="onboarding__card-icon">✨</span>
                        <span className="onboarding__card-title">{habit.name}</span>
                      </div>
                      <label className="onboarding__label">
                        Сколько сейчас в день?
                        <input
                          className="onboarding__input"
                          type="number"
                          min={0}
                          value={habit.baseline}
                          onChange={(e) =>
                            setLightHabits((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, baseline: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  );
                })}
                {lightSpeech ? (
                  <p className="onboarding__speech onboarding__speech--light">{lightSpeech}</p>
                ) : null}
              </>
            ) : null}

            {step === "dark" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 3 · Тёмная сторона 🌑</p>
                <h1 className="onboarding__title">Что тянет тебя на дно?</h1>
                <p className="onboarding__subtitle">
                  Пришло время отрубить хвосты. Выбери то, с чем ты хочешь покончить навсегда.
                  Я буду рядом, но рубить придётся тебе.
                </p>
                <p className="onboarding__counter">Выбрано {totalHabits}/{MAX_ACTIVE_HABITS}</p>
                {renderHabitCards(DARK_TEMPLATE_IDS, darkHabits, setDarkHabits)}
                {darkSpeech ? (
                  <p className="onboarding__speech onboarding__speech--dark">{darkSpeech}</p>
                ) : null}
              </>
            ) : null}

            {step === "body" ? (
              <>
                <p className="onboarding__eyebrow">Шаг 4</p>
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
                <p className="onboarding__eyebrow">Шаг 5</p>
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
                <p className="onboarding__eyebrow">Шаг 6</p>
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

          <div className="onboarding__actions">
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
            {!isAuthenticated && step === "welcome" ? (
              <button
                type="button"
                className="onboarding__link"
                onClick={() => navigate("/login")}
              >
                Уже есть аккаунт? Войти
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </OnboardingLayout>
  );
}
