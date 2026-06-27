import { useEffect, useRef, useState } from "react";
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

const EXERCISE_IDS = new Set(STRENGTH_WORKOUT_EXERCISES.map((exercise) => exercise.id));

function circuitStorageKey(habitId: string, planDate: string): string {
  return `mytodo_strength_circuit:${habitId}:${planDate}`;
}

function readStoredCompletedIds(habitId: string, planDate: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  const raw = sessionStorage.getItem(circuitStorageKey(habitId, planDate));
  if (raw == null) {
    return new Set();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(
      parsed.filter(
        (id): id is string => typeof id === "string" && EXERCISE_IDS.has(id),
      ),
    );
  } catch {
    const legacyIndex = Number(raw);
    if (
      Number.isInteger(legacyIndex) &&
      legacyIndex > 0 &&
      legacyIndex <= STRENGTH_WORKOUT_EXERCISES.length
    ) {
      return new Set(STRENGTH_WORKOUT_EXERCISES.slice(0, legacyIndex).map((item) => item.id));
    }

    return new Set();
  }
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

const EXERCISE_DEMO_PLAYBACK_RATE = 1.3;

type VideoWithWebkitFullscreen = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

async function openVideoFullscreen(video: HTMLVideoElement): Promise<void> {
  const webkitVideo = video as VideoWithWebkitFullscreen;
  if (typeof webkitVideo.webkitEnterFullscreen === "function") {
    webkitVideo.webkitEnterFullscreen();
    return;
  }

  if (video.requestFullscreen) {
    await video.requestFullscreen();
  }
}

function ExerciseDemoVideo({ src, label }: { src: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.playbackRate = EXERCISE_DEMO_PLAYBACK_RATE;

    const tryPlay = () => {
      void video.play().catch(() => {});
    };

    video.addEventListener("canplay", tryPlay);
    tryPlay();

    return () => {
      video.removeEventListener("canplay", tryPlay);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="home__strength-exercise-demo-gif home__strength-exercise-demo-gif--video"
      src={src}
      preload="auto"
      autoPlay
      loop
      muted
      playsInline
      aria-label={`${label}. Нажмите, чтобы открыть на весь экран`}
      onClick={(event) => {
        event.stopPropagation();
        const video = videoRef.current;
        if (!video) {
          return;
        }
        void openVideoFullscreen(video);
      }}
    />
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
  const [completedInRound, setCompletedInRound] = useState(() =>
    readStoredCompletedIds(habitId, planDate),
  );
  const [circuitMessage, setCircuitMessage] = useState<string | null>(null);
  const [goalJustReached, setGoalJustReached] = useState(false);
  const [demoExerciseId, setDemoExerciseId] = useState<string | null>(null);

  useEffect(() => {
    setCompletedInRound(readStoredCompletedIds(habitId, planDate));
    setCircuitMessage(null);
    setGoalJustReached(false);
    setDemoExerciseId(null);
  }, [habitId, planDate, currentValue]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    sessionStorage.setItem(
      circuitStorageKey(habitId, planDate),
      JSON.stringify([...completedInRound]),
    );
  }, [completedInRound, habitId, planDate]);

  const finalizeRound = async (completedSnapshot: Set<string>) => {
    const nextValue = currentValue + STRENGTH_WORKOUT_TARGET_MINUTES;
    const reachedGoal = nextValue >= currentGoal;

    try {
      await onCircuitComplete(nextValue);
      setCompletedInRound(new Set());
      setGoalJustReached(reachedGoal);
      setCircuitMessage(
        reachedGoal
          ? "Круг завершён — цель на сегодня выполнена."
          : "Круг завершён. Можно сделать ещё один.",
      );
    } catch {
      setCompletedInRound(completedSnapshot);
      setCircuitMessage(null);
      setGoalJustReached(false);
    }
  };

  const handleExerciseDone = (exerciseId: string) => {
    setCircuitMessage(null);
    setGoalJustReached(false);

    setCompletedInRound((prev) => {
      if (prev.has(exerciseId)) {
        return prev;
      }

      const nextCompleted = new Set(prev);
      nextCompleted.add(exerciseId);

      if (nextCompleted.size === STRENGTH_WORKOUT_EXERCISES.length) {
        void finalizeRound(nextCompleted);
      }

      return nextCompleted;
    });
  };

  return (
    <div className="home__strength-circuit">
      <p className="home__strength-circuit-intro">
        Сделайте каждое упражнение по 1 разу — в любом порядке. Один круг ≈{" "}
        {STRENGTH_WORKOUT_TARGET_MINUTES} мин.
      </p>

      <ol className="home__strength-exercises">
        {STRENGTH_WORKOUT_EXERCISES.map((exercise, index) => {
          const isDone = completedInRound.has(exercise.id);
          const isDemoOpen = demoExerciseId === exercise.id;

          return (
            <li
              key={exercise.id}
              className={[
                "home__strength-exercise",
                isDone ? "home__strength-exercise--done" : "",
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
                      <ExerciseDemoVideo
                        src={exercise.demoGifUrl}
                        label={`Техника: ${exercise.name}`}
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
                {!isDone ? (
                  <button
                    type="button"
                    className="home__plan-drawer-btn home__plan-drawer-btn--primary home__strength-exercise-btn"
                    disabled={isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleExerciseDone(exercise.id);
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
