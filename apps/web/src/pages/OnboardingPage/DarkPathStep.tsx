import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { HABIT_TEMPLATES } from "@mytodo/shared";
import {
  confirmDarkAbstinence,
  DARK_ENEMIES,
  DARK_PATH_STEP_HERO,
  findDarkHabit,
  getDarkBaselineQuestion,
  getDarkHabitSummary,
  isDarkAbstinence,
  isDarkBaselineValid,
  isDarkSetupComplete,
  keepCompleteDarkHabits,
  shouldAutoCloseDarkBaseline,
  shouldCommitDarkBaselineOnBlur,
  toggleDarkEnemy,
  updateDarkBaseline,
} from "../../features/onboarding/darkPaths";
import type { SelectedHabit, SelectedTemplateHabit } from "../../features/onboarding/types";
import { CollapsibleReveal } from "../../components/CollapsibleReveal";
import { HabitRowHint, HabitRowMeta } from "../../components/HabitRowAnimated/HabitRowAnimated";
import { useDeferredBaselineCommit } from "../../hooks/useDeferredBaselineCommit";
import {
  clearKeyboardScrollPadding,
  focusSetupInputAfterPanelOpen,
  scrollPanelIntoViewAfterKeyboard,
} from "../../utils/scrollPanelIntoView";

type DarkPathStepProps = {
  darkHabits: SelectedHabit[];
  onChange: (habits: SelectedHabit[]) => void;
  isPathTransitioning?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

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

type DarkSetupPanelProps = {
  habit: SelectedTemplateHabit;
  darkHabits: SelectedHabit[];
  onChange: (habits: SelectedHabit[]) => void;
  onPanelScroll?: () => void;
  onInputBlur?: () => void;
};

function DarkSetupPanel({
  habit,
  darkHabits,
  onChange,
  onPanelScroll,
  onInputBlur,
}: DarkSetupPanelProps) {
  const [draft, setDraft] = useState(habit.baseline);
  const inputRef = useRef<HTMLInputElement>(null);
  const templateId = habit.templateId;
  const abstinence = isDarkAbstinence(templateId);
  const showAmountStep = !abstinence && !isDarkBaselineValid(habit.baseline);

  useEffect(() => {
    if (showAmountStep) {
      setDraft(habit.baseline);
    }
  }, [showAmountStep, templateId, habit.baseline]);

  useEffect(() => {
    if (!showAmountStep) return;
    return focusSetupInputAfterPanelOpen(() => inputRef.current, onPanelScroll);
  }, [showAmountStep, templateId, onPanelScroll]);

  const applyBaseline = useCallback(
    (value: string) => {
      onChange(updateDarkBaseline(darkHabits, templateId, value));
      onInputBlur?.();
    },
    [darkHabits, onChange, onInputBlur, templateId],
  );

  const { commit: commitBaseline, isPending } = useDeferredBaselineCommit(applyBaseline);

  if (abstinence && !isDarkSetupComplete(habit)) {
    return (
      <div className="onboarding__setup-block">
        <p className="onboarding__setup-label">Готов включить режим полного отказа?</p>
        <div className="onboarding__option-list">
          <button
            type="button"
            className="onboarding__option-row"
            onClick={() => onChange(confirmDarkAbstinence(darkHabits, templateId))}
          >
            <OptionRadio selected={false} />
            <span>Да, бросаю</span>
          </button>
        </div>
        <p className="onboarding__setup-hint">
          Без послаблений: каждый день держим линию, я буду напоминать и контролировать.
        </p>
      </div>
    );
  }

  if (showAmountStep) {
    return (
      <div className="onboarding__setup-block">
        <label className="onboarding__setup-field">
          <span className="onboarding__setup-label">{getDarkBaselineQuestion(templateId)}</span>
          <input
            ref={inputRef}
            className="onboarding__input onboarding__input--setup"
            type="number"
            min={0}
            inputMode="numeric"
            enterKeyHint="done"
            value={draft}
            onChange={(e) => {
              const value = e.target.value;
              setDraft(value);
              if (shouldAutoCloseDarkBaseline(templateId, value)) {
                commitBaseline(value, isDarkBaselineValid);
              }
            }}
            onBlur={() => {
              if (isPending()) return;
              if (shouldCommitDarkBaselineOnBlur(templateId, draft)) {
                commitBaseline(draft, isDarkBaselineValid);
                return;
              }
              onInputBlur?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isDarkBaselineValid(draft)) {
                e.preventDefault();
                commitBaseline(draft, isDarkBaselineValid);
              }
            }}
          />
        </label>
        <p className="onboarding__setup-hint">
          Будем снижать понемногу — без резких скачков и срывов.
        </p>
      </div>
    );
  }

  return null;
}

export function DarkPathStep({
  darkHabits,
  onChange,
  isPathTransitioning = false,
  scrollContainerRef,
}: DarkPathStepProps) {
  const [setupTemplateId, setSetupTemplateId] = useState<string | null>(null);
  const activeSetupRef = useRef<HTMLDivElement | null>(null);
  const darkHabitsRef = useRef(darkHabits);
  darkHabitsRef.current = darkHabits;

  const scrollActivePanel = useCallback(() => {
    scrollPanelIntoViewAfterKeyboard(activeSetupRef.current, scrollContainerRef?.current);
  }, [scrollContainerRef]);

  const clearScrollPadding = useCallback(() => {
    clearKeyboardScrollPadding(scrollContainerRef?.current);
  }, [scrollContainerRef]);

  useEffect(() => {
    if (setupTemplateId) return;
    clearScrollPadding();
  }, [clearScrollPadding, setupTemplateId]);

  const handleSelectEnemy = (templateId: SelectedTemplateHabit["templateId"]) => {
    const existing = findDarkHabit(darkHabits, templateId);

    if (existing) {
      onChange(toggleDarkEnemy(darkHabits, templateId));
      setSetupTemplateId(null);
      clearScrollPadding();
      return;
    }

    onChange(toggleDarkEnemy(keepCompleteDarkHabits(darkHabits), templateId));
    setSetupTemplateId(templateId);
  };

  const discardIncomplete = (templateId: string) => {
    const habits = darkHabitsRef.current;
    const habit = findDarkHabit(habits, templateId as SelectedTemplateHabit["templateId"]);
    if (!habit || isDarkSetupComplete(habit)) return;
    onChange(habits.filter((item) => !(item.kind === "template" && item.templateId === templateId)));
    clearScrollPadding();
  };

  return (
    <>
      <p className="onboarding__eyebrow">Шаг 2 · Тёмная сторона</p>
      <h1 className="onboarding__title">Что тянет тебя на дно?</h1>
      <p className="onboarding__subtitle">
        Отметь привычки, от которых хочешь избавиться. Снижать будем понемногу — без резких
        скачков.
      </p>

      <div className="onboarding__step-hero" aria-hidden="true">
        <img src={DARK_PATH_STEP_HERO} alt="" decoding="async" />
      </div>

      <p className="onboarding__section-label">Привычки</p>

      <div className="onboarding__option-list onboarding__option-list--habits">
        {DARK_ENEMIES.map((enemy) => {
          const selected = findDarkHabit(darkHabits, enemy.templateId);
          const complete = selected ? isDarkSetupComplete(selected) : false;
          const isSetupTarget = setupTemplateId === enemy.templateId && Boolean(selected);
          const showPanel = isSetupTarget && !complete;
          const setupSettled = setupTemplateId !== enemy.templateId;
          const hintVisible = !isSetupTarget && !(complete && setupSettled);
          const metaVisible = Boolean(complete && setupSettled);
          const metaText = selected && complete ? getDarkHabitSummary(selected) : "";

          return (
            <div
              key={enemy.templateId}
              ref={isSetupTarget ? activeSetupRef : undefined}
              className="onboarding__habit-item"
            >
              <button
                type="button"
                className={[
                  "onboarding__habit-row",
                  complete ? "onboarding__habit-row--selected" : "",
                  isSetupTarget ? "onboarding__habit-row--active" : "",
                  hintVisible ? "onboarding__habit-row--subline-open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleSelectEnemy(enemy.templateId)}
              >
                <OptionRadio selected={complete} />
                <span className="onboarding__habit-row-copy">
                  <span className="onboarding__habit-row-label">
                    {HABIT_TEMPLATES[enemy.templateId].name}
                  </span>
                  <HabitRowHint text={enemy.description} visible={hintVisible} />
                </span>
                {metaText ? <HabitRowMeta text={metaText} visible={metaVisible} /> : null}
              </button>

              <CollapsibleReveal
                open={showPanel}
                immediate={isPathTransitioning}
                scrollAnchorRef={activeSetupRef}
                onCollapsed={() => {
                  setSetupTemplateId((current) =>
                    current === enemy.templateId ? null : current,
                  );
                  discardIncomplete(enemy.templateId);
                }}
                contentClassName="onboarding__setup-panel onboarding__setup-panel--inline"
              >
                {isSetupTarget && selected ? (
                  <DarkSetupPanel
                    habit={selected}
                    darkHabits={darkHabits}
                    onChange={onChange}
                    onPanelScroll={scrollActivePanel}
                    onInputBlur={clearScrollPadding}
                  />
                ) : null}
              </CollapsibleReveal>
            </div>
          );
        })}
      </div>
    </>
  );
}
