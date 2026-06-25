import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  addCreatorCustomHabit,
  estimateLightHabitsComfortMinutes,
  findHabitByActivityId,
  getActivitiesForPath,
  getActivityComfortLabel,
  getAmountQuestion,
  getHabitComfortLabel,
  getHabitDisplayName,
  getLightHabitSummary,
  isLightBaselineValid,
  isLightSetupComplete,
  LIGHT_PATH_STEP_HERO,
  LIGHT_PATHS,
  LIGHT_PATH_TAB_LABELS,
  setLightPracticesNow,
  toggleLightActivity,
  updateLightBaseline,
  type LightActivity,
  type LightPathId,
} from "../../features/onboarding/lightPaths";
import type { SelectedCustomHabit, SelectedHabit } from "../../features/onboarding/types";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import { HabitRowHint, HabitRowMeta } from "../../components/HabitRowAnimated/HabitRowAnimated";
import { useDeferredBaselineCommit } from "../../hooks/useDeferredBaselineCommit";
import { scrollPanelIntoViewAfterKeyboard } from "../../utils/scrollPanelIntoView";
import { useContentSwitchTransition } from "../../hooks/useContentSwitchTransition";
import "../../components/ContentPanels/ContentPanels.css";

type LightPathStepProps = {
  lightHabits: SelectedHabit[];
  freeTimeMin: number;
  activePathId: LightPathId;
  onActivePathChange: (pathId: LightPathId) => void;
  onChange: (habits: SelectedHabit[]) => void;
  onPathTransitionChange?: (isTransitioning: boolean) => void;
};

export type LightPathStepHandle = {
  switchToPath: (pathId: LightPathId) => void;
};

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

function shouldAutoCloseBaseline(value: string): boolean {
  return isLightBaselineValid(value) && countDigits(value) >= 2;
}

function OptionRadio({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span className="onboarding__option-radio onboarding__option-radio--on" aria-hidden="true">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return <span className="onboarding__option-radio" aria-hidden="true" />;
}

type HabitSetupPanelProps = {
  activityId: string;
  habit: SelectedHabit;
  lightHabits: SelectedHabit[];
  onChange: (habits: SelectedHabit[]) => void;
};

function HabitSetupPanel({
  activityId,
  habit,
  lightHabits,
  onChange,
}: HabitSetupPanelProps) {
  const [draft, setDraft] = useState(habit.baseline);
  const showPracticesStep = habit.practicesNow === undefined;
  const showAmountStep =
    habit.practicesNow === true && !isLightBaselineValid(habit.baseline);

  useEffect(() => {
    if (showAmountStep) {
      setDraft(habit.baseline);
    }
  }, [showAmountStep, activityId, habit.baseline]);

  const applyBaseline = useCallback(
    (value: string) => {
      onChange(updateLightBaseline(lightHabits, activityId, value));
    },
    [activityId, lightHabits, onChange],
  );

  const { commit: commitBaseline, isPending } = useDeferredBaselineCommit(applyBaseline);

  if (showPracticesStep) {
    return (
      <div className="onboarding__setup-block">
        <p className="onboarding__setup-label">Занимаешься этим сейчас?</p>
        <div className="onboarding__option-list">
          <button
            type="button"
            className="onboarding__option-row"
            onClick={() => onChange(setLightPracticesNow(lightHabits, activityId, true))}
          >
            <OptionRadio selected={false} />
            <span>Да</span>
          </button>
          <button
            type="button"
            className="onboarding__option-row"
            onClick={() => {
              onChange(setLightPracticesNow(lightHabits, activityId, false));
            }}
          >
            <OptionRadio selected={false} />
            <span>Нет, хочу начать</span>
          </button>
        </div>
        <p className="onboarding__setup-hint">
          Если только начинаешь — нагрузку подберём и будем повышать постепенно.
        </p>
      </div>
    );
  }

  if (showAmountStep) {
    return (
      <div className="onboarding__setup-block">
        <label className="onboarding__setup-field">
          <span className="onboarding__setup-label">{getAmountQuestion(habit, true)}</span>
          <input
            className="onboarding__input onboarding__input--setup"
            type="number"
            min={0}
            autoFocus
            value={draft}
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              if (shouldAutoCloseBaseline(value)) {
                commitBaseline(value, isLightBaselineValid);
              }
            }}
            onBlur={() => {
              if (isPending()) return;
              if (shouldAutoCloseBaseline(draft)) {
                commitBaseline(draft, isLightBaselineValid);
                return;
              }
              if (isLightBaselineValid(draft) && countDigits(draft) === 1) {
                commitBaseline(draft, isLightBaselineValid);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isLightBaselineValid(draft)) {
                e.preventDefault();
                commitBaseline(draft, isLightBaselineValid);
              }
            }}
          />
        </label>
      </div>
    );
  }

  return null;
}

export const LightPathStep = forwardRef<LightPathStepHandle, LightPathStepProps>(
  function LightPathStep(
    {
      lightHabits,
      freeTimeMin,
      activePathId,
      onActivePathChange,
      onChange,
      onPathTransitionChange,
    },
    ref,
  ) {
    const [setupActivityId, setSetupActivityId] = useState<string | null>(null);
    const [customOpen, setCustomOpen] = useState(false);
    const [customName, setCustomName] = useState("");
    const [customUnit, setCustomUnit] = useState<SelectedCustomHabit["unit"]>("minutes");
    const [customPracticesNow, setCustomPracticesNow] = useState<boolean | null>(null);
    const [customBaseline, setCustomBaseline] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const activeSetupRef = useRef<HTMLDivElement | null>(null);
    const activeSetupHabit = setupActivityId
      ? findHabitByActivityId(lightHabits, setupActivityId)
      : undefined;
    const comfortMinutes = estimateLightHabitsComfortMinutes(lightHabits);

    useEffect(() => {
      if (!setupActivityId || !activeSetupHabit) return;
      if (activeSetupHabit.practicesNow !== true) return;
      if (isLightBaselineValid(activeSetupHabit.baseline)) return;

      const frame = requestAnimationFrame(() => {
        scrollPanelIntoViewAfterKeyboard(activeSetupRef.current);
      });

      return () => cancelAnimationFrame(frame);
    }, [activeSetupHabit?.baseline, activeSetupHabit?.practicesNow, setupActivityId]);

    const handlePathChange = useCallback(
      (pathId: LightPathId) => {
        setCustomOpen(false);
        setSetupActivityId(null);
        setLocalError(null);
        onActivePathChange(pathId);
      },
      [onActivePathChange],
    );

    const {
      wrapperRef: pathPanelsRef,
      wrapperClassName: pathPanelsClassName,
      switchTo: switchPath,
      getPanelClassName: getPathPanelClassName,
      getPanelState: getPathPanelState,
      isTransitioning: isPathTransitioning,
    } = useContentSwitchTransition<LightPathId>({
      activeKey: activePathId,
      onActiveKeyChange: handlePathChange,
    });

    useEffect(() => {
      onPathTransitionChange?.(isPathTransitioning);
    }, [isPathTransitioning, onPathTransitionChange]);

    useImperativeHandle(
      ref,
      () => ({
        switchToPath: (pathId) => switchPath(pathId),
      }),
      [switchPath],
    );

    const handleSelectHabit = (activity: LightActivity) => {
      setLocalError(null);
      const existing = findHabitByActivityId(lightHabits, activity.id);

      if (existing) {
        if (!isLightSetupComplete(existing)) {
          if (setupActivityId === activity.id) {
            onChange(toggleLightActivity(lightHabits, activity));
            setSetupActivityId(null);
          } else {
            setSetupActivityId(activity.id);
          }
          return;
        }

        onChange(toggleLightActivity(lightHabits, activity));
        if (setupActivityId === activity.id) {
          setSetupActivityId(null);
        }
        return;
      }

      onChange(toggleLightActivity(lightHabits, activity));
      setSetupActivityId(activity.id);
    };

    const handleRemoveCustom = (activityId: string) => {
      onChange(lightHabits.filter((habit) => habit.activityId !== activityId));
      if (setupActivityId === activityId) {
        setSetupActivityId(null);
      }
    };

    const handleAddCustom = () => {
      if (customPracticesNow === null) {
        setLocalError("Ответь, занимаешься ли ты этим сейчас");
        return;
      }

      if (customPracticesNow && !isLightBaselineValid(customBaseline)) {
        setLocalError("Укажи, сколько занимаешься сейчас");
        return;
      }

      const result = addCreatorCustomHabit(lightHabits, {
        name: customName,
        unit: customUnit,
      });

      if (result.error) {
        setLocalError(result.error);
        return;
      }

      const activityId = result.habits.find(
        (habit) =>
          habit.pathId === "creator" &&
          habit.activityId?.startsWith("creator-custom") &&
          !lightHabits.some((item) => item.activityId === habit.activityId),
      )?.activityId;

      if (!activityId) return;

      const nextHabits = setLightPracticesNow(result.habits, activityId, customPracticesNow);
      onChange(
        customPracticesNow
          ? updateLightBaseline(nextHabits, activityId, customBaseline)
          : nextHabits,
      );
      setCustomOpen(false);
      setCustomName("");
      setCustomPracticesNow(null);
      setCustomBaseline("");
      setLocalError(null);
      setSetupActivityId(null);
    };

    const renderHabitItem = (activity: LightActivity, onClick: () => void) => {
      const selected = findHabitByActivityId(lightHabits, activity.id);
      const complete = selected ? isLightSetupComplete(selected) : false;
      const isSetupTarget = setupActivityId === activity.id && selected;
      const showPanel = isSetupTarget && !complete;
      const setupSettled = setupActivityId !== activity.id;
      const comfortLabel =
        activity.kind !== "custom_form"
          ? selected
            ? getHabitComfortLabel(selected)
            : getActivityComfortLabel(activity)
          : null;
      const hintVisible =
        activity.kind !== "custom_form" &&
        Boolean(activity.description || comfortLabel) &&
        !isSetupTarget &&
        !(complete && setupSettled);
      const metaVisible = Boolean(complete && selected && setupSettled);
      const metaText = selected && complete ? getLightHabitSummary(selected) : "";

      return (
        <div
          key={activity.id}
          ref={isSetupTarget ? activeSetupRef : undefined}
          className="onboarding__habit-item"
        >
          <button
            type="button"
            className={[
              "onboarding__habit-row",
              selected ? "onboarding__habit-row--selected" : "",
              setupActivityId === activity.id && selected
                ? "onboarding__habit-row--active"
                : "",
              hintVisible ? "onboarding__habit-row--subline-open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={onClick}
          >
            <OptionRadio selected={Boolean(selected)} />
            <span className="onboarding__habit-row-copy">
              <span className="onboarding__habit-row-label">{activity.label}</span>
              {comfortLabel ? (
                <HabitRowHint text={comfortLabel} visible={hintVisible && !activity.description} />
              ) : null}
              {activity.kind !== "custom_form" && activity.description ? (
                <HabitRowHint text={activity.description} visible={hintVisible} />
              ) : null}
            </span>
            {metaText ? <HabitRowMeta text={metaText} visible={metaVisible} /> : null}
          </button>

          <CollapsibleReveal
            open={showPanel}
            immediate={isPathTransitioning}
            scrollAnchorRef={activeSetupRef}
            onCollapsed={() => {
              setSetupActivityId((current) => (current === activity.id ? null : current));
            }}
            contentClassName="onboarding__setup-panel onboarding__setup-panel--inline"
          >
            {isSetupTarget ? (
              <div>
                <HabitSetupPanel
                  activityId={activity.id}
                  habit={selected}
                  lightHabits={lightHabits}
                  onChange={onChange}
                />
              </div>
            ) : null}
          </CollapsibleReveal>
        </div>
      );
    };

    const renderPathHabits = (pathId: LightPathId) => {
      const pathActivities = getActivitiesForPath(pathId).filter((a) => a.kind !== "custom_form");
      const customCreatorHabits = lightHabits.filter(
        (habit) =>
          habit.pathId === "creator" &&
          habit.activityId?.startsWith("creator-custom"),
      );

      return (
        <div className="onboarding__option-list onboarding__option-list--habits">
          {pathActivities.map((activity) =>
            renderHabitItem(activity, () => handleSelectHabit(activity)),
          )}

          {pathId === "creator"
            ? customCreatorHabits.map((habit) => {
                const activity: LightActivity = {
                  id: habit.activityId!,
                  pathId: "creator",
                  kind: "custom",
                  label: getHabitDisplayName(habit),
                  name: habit.kind === "custom" ? habit.name : "",
                  unit: habit.kind === "custom" ? habit.unit : "minutes",
                };
                return renderHabitItem(activity, () => handleRemoveCustom(habit.activityId!));
              })
            : null}

          {pathId === "creator" ? (
            <div
              ref={customOpen ? activeSetupRef : undefined}
              className="onboarding__habit-item"
            >
              <button
                type="button"
                className={[
                  "onboarding__habit-row",
                  "onboarding__habit-row--add",
                  customOpen ? "onboarding__habit-row--active" : "",
                  !customOpen ? "onboarding__habit-row--subline-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setCustomOpen((value) => !value);
                  setLocalError(null);
                }}
              >
                <span className="onboarding__habit-row-copy">
                  <span className="onboarding__habit-row-label">+ Своё занятие</span>
                  <HabitRowHint
                    text="Назови идею — подскажем, с чего начать"
                    visible={!customOpen}
                  />
                </span>
              </button>

              <CollapsibleReveal
                open={customOpen}
                immediate={isPathTransitioning}
                scrollAnchorRef={activeSetupRef}
                contentClassName="onboarding__setup-panel onboarding__setup-panel--inline"
              >
                <div>
                  <div className="onboarding__setup-block">
                    <label className="onboarding__setup-field">
                      <span className="onboarding__setup-label">Название</span>
                      <input
                        className="onboarding__input onboarding__input--setup"
                        placeholder="Blender 3D"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                    </label>
                    <label className="onboarding__setup-field">
                      <span className="onboarding__setup-label">Единица</span>
                      <select
                        className="onboarding__select onboarding__input--setup"
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
                    <p className="onboarding__setup-label">Занимаешься этим сейчас?</p>
                    <div className="onboarding__option-list">
                      <button
                        type="button"
                        className={[
                          "onboarding__option-row",
                          customPracticesNow === true ? "onboarding__option-row--selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setCustomPracticesNow(true)}
                      >
                        <OptionRadio selected={customPracticesNow === true} />
                        <span>Да</span>
                      </button>
                      <button
                        type="button"
                        className={[
                          "onboarding__option-row",
                          customPracticesNow === false ? "onboarding__option-row--selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setCustomPracticesNow(false)}
                      >
                        <OptionRadio selected={customPracticesNow === false} />
                        <span>Нет, хочу начать</span>
                      </button>
                    </div>
                    {customPracticesNow === true ? (
                      <label className="onboarding__setup-field">
                        <span className="onboarding__setup-label">
                          Сколько занимаешься сейчас в день?
                        </span>
                        <input
                          className="onboarding__input onboarding__input--setup"
                          type="number"
                          min={0}
                          value={customBaseline}
                          onChange={(e) => setCustomBaseline(e.target.value)}
                        />
                      </label>
                    ) : customPracticesNow === false ? (
                      <p className="onboarding__setup-hint">
                        Нагрузку подберём и будем повышать постепенно.
                      </p>
                    ) : null}
                    <button type="button" className="onboarding__setup-submit" onClick={handleAddCustom}>
                      Добавить
                    </button>
                  </div>
                </div>
              </CollapsibleReveal>
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <>
        <p className="onboarding__eyebrow">Шаг 1 · Светлая сторона</p>
        <h1 className="onboarding__title">Выбери свой путь</h1>
        <p className="onboarding__subtitle">Отметь привычки, которые возьмёшь в эту главу.</p>

       

        <div className="onboarding__step-hero" aria-hidden="true">
          <img
            src={LIGHT_PATH_STEP_HERO}
            alt=""
            width={140}
            height={120}
            decoding="async"
          />
        </div>

        <div className="onboarding__path-tabs onboarding__path-tabs--minimal" role="tablist" aria-label="Пути">
          {LIGHT_PATHS.map((path) => (
            <button
              key={path.id}
              type="button"
              role="tab"
              aria-selected={path.id === activePathId}
              className={[
                "onboarding__path-tab",
                path.id === activePathId ? "onboarding__path-tab--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={isPathTransitioning}
              onClick={() => {
                if (path.id === activePathId) return;
                setCustomOpen(false);
                setSetupActivityId(null);
                setLocalError(null);
                switchPath(path.id);
              }}
            >
              {LIGHT_PATH_TAB_LABELS[path.id]}
            </button>
          ))}
        </div>

        <p className="onboarding__section-label">Привычки</p>

        <div
          ref={pathPanelsRef}
          className={["onboarding__path-panels", pathPanelsClassName].filter(Boolean).join(" ")}
        >
          {LIGHT_PATHS.map((path) => {
            const panelState = getPathPanelState(path.id);
            const interactive = panelState === "visible";

            return (
              <div
                key={path.id}
                className={getPathPanelClassName(path.id, "onboarding__path-panel content-panel")}
                aria-hidden={!interactive}
              >
                {renderPathHabits(path.id)}
              </div>
            );
          })}
        </div>

        {lightHabits.length > 0 ? (
          <p
            className={[
              "onboarding__setup-hint",
              comfortMinutes > freeTimeMin ? "onboarding__slider-warning" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Примерно {comfortMinutes} мин в день для выбранных привычек
            {comfortMinutes > freeTimeMin
              ? ` — это больше, чем ${freeTimeMin} мин свободного времени. Убери лишнее или увеличь время на шаге «Тело».`
              : ""}
          </p>
        ) : null}

        {localError ? <p className="onboarding__error">{localError}</p> : null}
      </>
    );
  },
);
