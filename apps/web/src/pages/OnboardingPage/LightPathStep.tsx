import { useEffect, useState } from "react";
import { HABIT_TEMPLATES } from "@mytodo/shared";
import { unitLabel } from "../../features/onboarding/constants";
import {
  addCreatorCustomHabit,
  findHabitByActivityId,
  getActivitiesForPath,
  getBaselineHint,
  getHabitDisplayName,
  LIGHT_PATHS,
  LIGHT_PATH_TAB_LABELS,
  toggleLightActivity,
  updateLightBaseline,
  type LightActivity,
  type LightPathId,
} from "../../features/onboarding/lightPaths";
import type { SelectedCustomHabit, SelectedHabit } from "../../features/onboarding/types";

function HabitCheck({ selected }: { selected: boolean }) {
  return (
    <span className="onboarding__card-check">
      <span className={["onboarding__check", selected ? "onboarding__check--on" : ""].filter(Boolean).join(" ")}>
        {selected ? "✓" : null}
      </span>
    </span>
  );
}

type LightPathStepProps = {
  lightHabits: SelectedHabit[];
  activePathId: LightPathId;
  onActivePathChange: (pathId: LightPathId) => void;
  onChange: (habits: SelectedHabit[]) => void;
};

function isBaselineValid(value: string): boolean {
  if (value.trim() === "") return false;
  const baseline = Number(value.replace(",", "."));
  return Number.isFinite(baseline) && baseline >= 0;
}

function getHabitUnit(habit: SelectedHabit): string {
  if (habit.kind === "template") {
    return unitLabel(HABIT_TEMPLATES[habit.templateId].unit);
  }
  return unitLabel(habit.unit);
}

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

function shouldAutoCloseBaseline(value: string): boolean {
  return isBaselineValid(value) && countDigits(value) >= 2;
}

type BaselineFieldProps = {
  activityId: string;
  habit: SelectedHabit;
  lightHabits: SelectedHabit[];
  editingActivityId: string | null;
  onChange: (habits: SelectedHabit[]) => void;
  onEditingChange: (activityId: string | null) => void;
};

function BaselineField({
  activityId,
  habit,
  lightHabits,
  editingActivityId,
  onChange,
  onEditingChange,
}: BaselineFieldProps) {
  const isEditing = editingActivityId === activityId;
  const [draft, setDraft] = useState(habit.baseline);

  useEffect(() => {
    if (isEditing) {
      setDraft(habit.baseline);
    }
  }, [isEditing, activityId]);

  const commitBaseline = (value: string) => {
    if (!isBaselineValid(value)) return;
    onChange(updateLightBaseline(lightHabits, activityId, value));
    onEditingChange(null);
  };

  const filled = isBaselineValid(habit.baseline);

  if (filled && !isEditing) {
    return (
      <p className="onboarding__card-baseline">
        Сейчас: {habit.baseline} {getHabitUnit(habit)}/день
        <button
          type="button"
          className="onboarding__card-baseline-edit"
          onClick={() => onEditingChange(activityId)}
        >
          Изменить
        </button>
      </p>
    );
  }

  return (
    <div className="onboarding__baseline-field">
      <input
        className="onboarding__input onboarding__input--compact"
        type="number"
        min={0}
        autoFocus
        placeholder={getBaselineHint(habit)}
        aria-label={getBaselineHint(habit)}
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (shouldAutoCloseBaseline(value)) {
            commitBaseline(value);
          }
        }}
        onBlur={() => {
          if (shouldAutoCloseBaseline(draft)) {
            commitBaseline(draft);
            return;
          }
          if (isBaselineValid(draft) && countDigits(draft) === 1) {
            commitBaseline(draft);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isBaselineValid(draft)) {
            e.preventDefault();
            commitBaseline(draft);
          }
        }}
      />
    </div>
  );
}

export function LightPathStep({
  lightHabits,
  activePathId,
  onActivePathChange,
  onChange,
}: LightPathStepProps) {
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<SelectedCustomHabit["unit"]>("minutes");
  const [customBaseline, setCustomBaseline] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const pathActivities = getActivitiesForPath(activePathId);
  const customCreatorHabits = lightHabits.filter(
    (habit) =>
      habit.pathId === "creator" &&
      habit.activityId?.startsWith("creator-custom"),
  );

  const handleToggle = (activity: LightActivity) => {
    if (activity.kind === "custom_form") {
      setCustomOpen((value) => !value);
      setLocalError(null);
      return;
    }

    setLocalError(null);
    const nextHabits = toggleLightActivity(lightHabits, activity);
    onChange(nextHabits);

    const selected = findHabitByActivityId(nextHabits, activity.id);
    if (selected) {
      setEditingActivityId(
        isBaselineValid(selected.baseline) ? null : activity.id,
      );
    } else if (editingActivityId === activity.id) {
      setEditingActivityId(null);
    }
  };

  const handleRemoveCustom = (activityId: string) => {
    onChange(lightHabits.filter((habit) => habit.activityId !== activityId));
    if (editingActivityId === activityId) {
      setEditingActivityId(null);
    }
  };

  const handleAddCustom = () => {
    const result = addCreatorCustomHabit(lightHabits, {
      name: customName,
      unit: customUnit,
      baseline: customBaseline,
    });

    if (result.error) {
      setLocalError(result.error);
      return;
    }

    onChange(result.habits);
    setCustomOpen(false);
    setCustomName("");
    setCustomBaseline("");
    setLocalError(null);

    const added = result.habits.find(
      (habit) =>
        habit.pathId === "creator" &&
        habit.activityId?.startsWith("creator-custom") &&
        !lightHabits.some((item) => item.activityId === habit.activityId),
    );
    if (added?.activityId) {
      setEditingActivityId(
        isBaselineValid(added.baseline) ? null : added.activityId,
      );
    }
  };

  const renderSelectedCard = (
    activityId: string,
    title: string,
    selected: SelectedHabit,
    onDeselect: () => void,
  ) => (
    <div
      key={activityId}
      className="onboarding__card onboarding__card--habit onboarding__card--selected onboarding__card--charged"
    >
      <button type="button" className="onboarding__card-toggle" onClick={onDeselect}>
        <div className="onboarding__card-head">
          <HabitCheck selected />
          <span className="onboarding__card-title">{title}</span>
        </div>
      </button>
      <BaselineField
        activityId={activityId}
        habit={selected}
        lightHabits={lightHabits}
        editingActivityId={editingActivityId}
        onChange={onChange}
        onEditingChange={setEditingActivityId}
      />
    </div>
  );

  return (
    <>
      <p className="onboarding__eyebrow">Шаг 1 · Светлая сторона ☀️</p>
      <h1 className="onboarding__title">Ты выбираешь свой Путь, Воин</h1>
      <p className="onboarding__subtitle">
        Каждая привычка — это новая суперсила. Какая станет твоей главной в этой главе?
      </p>

      <div className="onboarding__path-tabs" role="tablist" aria-label="Пути развития">
        {LIGHT_PATHS.map((path) => (
          <button
            key={path.id}
            type="button"
            role="tab"
            data-path={path.id}
            aria-selected={path.id === activePathId}
            className={[
              "onboarding__path-tab",
              path.id === activePathId ? "onboarding__path-tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              onActivePathChange(path.id);
              setCustomOpen(false);
              setEditingActivityId(null);
              setLocalError(null);
            }}
          >
            <span className="onboarding__path-tab-emoji">{path.emoji}</span>
            <span className="onboarding__path-tab-label">{LIGHT_PATH_TAB_LABELS[path.id]}</span>
          </button>
        ))}
      </div>

      <p className="onboarding__section-label">Привычки пути</p>

      <div className="onboarding__cards onboarding__cards--paths">
        {pathActivities.map((activity) => {
          if (activity.kind === "custom_form") {
            return (
              <div key={activity.id}>
                <button
                  type="button"
                  className="onboarding__card onboarding__card-add"
                  onClick={() => handleToggle(activity)}
                >
                  {activity.label}
                </button>
                {customOpen ? (
                  <div className="onboarding__custom-box" style={{ marginTop: "0.625rem" }}>
                    <label className="onboarding__label">
                      Название
                      <input
                        className="onboarding__input"
                        placeholder="Blender 3D"
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
                    <button type="button" className="onboarding__btn" onClick={handleAddCustom}>
                      Добавить
                    </button>
                  </div>
                ) : null}
                {activePathId === "creator"
                  ? customCreatorHabits.map((habit) =>
                      renderSelectedCard(
                        habit.activityId!,
                        getHabitDisplayName(habit),
                        habit,
                        () => handleRemoveCustom(habit.activityId!),
                      ),
                    )
                  : null}
              </div>
            );
          }

          const selected = findHabitByActivityId(lightHabits, activity.id);

          if (selected) {
            return renderSelectedCard(
              activity.id,
              activity.label,
              selected,
              () => handleToggle(activity),
            );
          }

          return (
            <button
              key={activity.id}
              type="button"
              className="onboarding__card onboarding__card--habit"
              onClick={() => handleToggle(activity)}
            >
              <div className="onboarding__card-head">
                <HabitCheck selected={false} />
                <span className="onboarding__card-title">{activity.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {localError ? <p className="onboarding__error">{localError}</p> : null}
    </>
  );
}
