import { useEffect, useState } from "react";
import {
  STRENGTH_WORKOUT_EXERCISES,
  STRENGTH_WORKOUT_TARGET_MINUTES,
} from "@mytodo/shared";

type StrengthWorkoutCircuitProps = {
  habitId: string;
  planDate: string;
  currentValue: number;
  currentGoal: number;
  isPending: boolean;
  onCircuitComplete: (nextValue: number) => Promise<void>;
};

function circuitStorageKey(habitId: string, planDate: string): string {
  return `mytodo_strength_circuit:${habitId}:${planDate}`;
}

function readStoredActiveIndex(habitId: string, planDate: string): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = sessionStorage.getItem(circuitStorageKey(habitId, planDate));
  const parsed = raw == null ? 0 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= STRENGTH_WORKOUT_EXERCISES.length) {
    return 0;
  }

  return parsed;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 9L7.5 12L13.5 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StrengthWorkoutCircuit({
  habitId,
  planDate,
  currentValue,
  currentGoal,
  isPending,
  onCircuitComplete,
}: StrengthWorkoutCircuitProps) {
  const [activeIndex, setActiveIndex] = useState(() => readStoredActiveIndex(habitId, planDate));
  const [circuitMessage, setCircuitMessage] = useState<string | null>(null);
  const [goalJustReached, setGoalJustReached] = useState(false);
  const [demoExerciseId, setDemoExerciseId] = useState<string | null>(null);

  useEffect(() => {
    setActiveIndex(readStoredActiveIndex(habitId, planDate));
    setCircuitMessage(null);
    setGoalJustReached(false);
    setDemoExerciseId(null);
  }, [habitId, planDate, currentValue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    sessionStorage.setItem(circuitStorageKey(habitId, planDate), String(activeIndex));
  }, [activeIndex, habitId, planDate]);

  const handleExerciseDone = async () => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < STRENGTH_WORKOUT_EXERCISES.length) {
      setActiveIndex(nextIndex);
      setCircuitMessage(null);
      setGoalJustReached(false);
      return;
    }

    const nextValue = currentValue + STRENGTH_WORKOUT_TARGET_MINUTES;
    const reachedGoal = nextValue >= currentGoal;

    try {
      await onCircuitComplete(nextValue);
      setActiveIndex(0);
      setGoalJustReached(reachedGoal);
      setCircuitMessage(
        reachedGoal
          ? "Круг завершён — цель на сегодня выполнена."
          : "Круг завершён. Можно сделать ещё один.",
      );
    } catch {
      setCircuitMessage(null);
      setGoalJustReached(false);
    }
  };

  return (
    <div className="home__strength-circuit">
      <p className="home__strength-circuit-intro">
        Выполняйте упражнения по очереди — по 1 разу каждое. Один круг ≈{" "}
        {STRENGTH_WORKOUT_TARGET_MINUTES} мин.
      </p>

      <ol className="home__strength-exercises">
        {STRENGTH_WORKOUT_EXERCISES.map((exercise, index) => {
          const isDone = index < activeIndex;
          const isCurrent = index === activeIndex;
          const isLocked = index > activeIndex;
          const isDemoOpen = demoExerciseId === exercise.id;

          return (
            <li
              key={exercise.id}
              className={[
                "home__strength-exercise",
                isDone ? "home__strength-exercise--done" : "",
                isCurrent ? "home__strength-exercise--current" : "",
                isLocked ? "home__strength-exercise--locked" : "",
                isDemoOpen ? "home__strength-exercise--demo-open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="home__strength-exercise-marker" aria-hidden="true">
                {isDone ? <CheckIcon className="home__strength-exercise-check" /> : index + 1}
              </div>
              <div className="home__strength-exercise-body">
                <button
                  type="button"
                  className="home__strength-exercise-name-btn"
                  aria-expanded={isDemoOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDemoExerciseId((current) =>
                      current === exercise.id ? null : exercise.id,
                    );
                  }}
                >
                  {exercise.name}
                  <span className="home__strength-exercise-name-hint">
                    {isDemoOpen ? "Скрыть" : "Как делать"}
                  </span>
                </button>
                <p className="home__strength-exercise-desc">{exercise.description}</p>
                {isDemoOpen ? (
                  <div className="home__strength-exercise-demo">
                    {exercise.demoGifUrl.endsWith(".mp4") ? (
                      <video
                        className="home__strength-exercise-demo-gif"
                        src={exercise.demoGifUrl}
                        preload="metadata"
                        autoPlay
                        loop
                        muted
                        playsInline
                        aria-label={`Техника: ${exercise.name}`}
                      />
                    ) : (
                      <img
                        className="home__strength-exercise-demo-gif"
                        src={exercise.demoGifUrl}
                        alt={`Техника: ${exercise.name}`}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                ) : null}
                {isCurrent ? (
                  <button
                    type="button"
                    className="home__plan-drawer-btn home__plan-drawer-btn--primary home__strength-exercise-btn"
                    disabled={isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleExerciseDone();
                    }}
                  >
                    Сделал (1 раз)
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {circuitMessage ? (
        <p
          className={[
            "home__strength-circuit-message",
            goalJustReached ? "home__strength-circuit-message--success" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {circuitMessage}
        </p>
      ) : null}
    </div>
  );
}
