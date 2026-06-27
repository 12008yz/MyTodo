import { useEffect, useRef, useState } from "react";
import {
  isExerciseDemoVideo,
  STRENGTH_WORKOUT_EXERCISES,
  STRENGTH_WORKOUT_MINUTES_PER_REP,
} from "@mytodo/shared";

type StrengthWorkoutCircuitProps = {
  habitId: string;
  planDate: string;
  currentValue: number;
  repsPerExercise: number;
  isPending: boolean;
  resetKey: number;
  onRepComplete: (nextValue: number) => Promise<void>;
  onRoundComplete?: () => void;
};

type ExerciseRepCounts = Record<string, number>;

const EXERCISE_IDS = new Set(STRENGTH_WORKOUT_EXERCISES.map((exercise) => exercise.id));

function circuitStorageKey(habitId: string, planDate: string): string {
  return `mytodo_strength_circuit:${habitId}:${planDate}`;
}

export function clearStrengthCircuitStorage(habitId: string, planDate: string): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(circuitStorageKey(habitId, planDate));
}

function isRoundComplete(counts: ExerciseRepCounts, repsPerExercise: number): boolean {
  return STRENGTH_WORKOUT_EXERCISES.every(
    (exercise) => (counts[exercise.id] ?? 0) >= repsPerExercise,
  );
}

export function isStrengthCircuitRoundComplete(
  habitId: string,
  planDate: string,
  repsPerExercise: number,
): boolean {
  return isRoundComplete(readStoredRepCounts(habitId, planDate, repsPerExercise), repsPerExercise);
}

function emptyRepCounts(): ExerciseRepCounts {
  return {};
}

function readStoredRepCounts(
  habitId: string,
  planDate: string,
  repsPerExercise: number,
): ExerciseRepCounts {
  if (typeof window === "undefined") {
    return emptyRepCounts();
  }

  const raw = sessionStorage.getItem(circuitStorageKey(habitId, planDate));
  if (raw == null) {
    return emptyRepCounts();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const counts: ExerciseRepCounts = {};
      for (const [id, value] of Object.entries(parsed)) {
        if (!EXERCISE_IDS.has(id)) {
          continue;
        }
        const reps = Number(value);
        if (Number.isInteger(reps) && reps > 0) {
          counts[id] = Math.min(reps, repsPerExercise);
        }
      }
      return counts;
    }

    if (Array.isArray(parsed)) {
      const counts: ExerciseRepCounts = {};
      for (const id of parsed) {
        if (typeof id === "string" && EXERCISE_IDS.has(id)) {
          counts[id] = repsPerExercise;
        }
      }
      return counts;
    }
  } catch {
    return emptyRepCounts();
  }

  return emptyRepCounts();
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

function ExerciseDemoVideo({
  src,
  label,
  active,
}: {
  src: string;
  label: string;
  active: boolean;
}) {
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
  }, [src, active]);

  return (
    <video
      ref={videoRef}
      className="home__strength-exercise-demo-gif home__strength-exercise-demo-gif--video"
      src={src}
      preload={active ? "auto" : "none"}
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
  repsPerExercise,
  isPending,
  resetKey,
  onRepComplete,
  onRoundComplete,
}: StrengthWorkoutCircuitProps) {
  const [repCounts, setRepCounts] = useState(() =>
    readStoredRepCounts(habitId, planDate, repsPerExercise),
  );
  const [demoExerciseId, setDemoExerciseId] = useState<string | null>(null);

  useEffect(() => {
    setRepCounts(readStoredRepCounts(habitId, planDate, repsPerExercise));
    setDemoExerciseId(null);
  }, [habitId, planDate, resetKey, repsPerExercise]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    sessionStorage.setItem(circuitStorageKey(habitId, planDate), JSON.stringify(repCounts));
  }, [repCounts, habitId, planDate]);

  const handleExerciseDone = async (exerciseId: string) => {
    const currentReps = repCounts[exerciseId] ?? 0;
    if (currentReps >= repsPerExercise || isPending) {
      return;
    }

    const previousCounts = repCounts;
    const nextCounts = {
      ...repCounts,
      [exerciseId]: repsPerExercise,
    };
    setRepCounts(nextCounts);

    const nextValue = currentValue + STRENGTH_WORKOUT_MINUTES_PER_REP;
    const roundComplete = isRoundComplete(nextCounts, repsPerExercise);

    try {
      await onRepComplete(nextValue);
      if (roundComplete) {
        onRoundComplete?.();
      }
    } catch {
      setRepCounts(previousCounts);
    }
  };

  const toggleExerciseDemo = (exerciseId: string) => {
    setDemoExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  return (
    <div
      className="home__strength-circuit"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <ol className="home__strength-exercises">
        {STRENGTH_WORKOUT_EXERCISES.map((exercise, index) => {
          const reps = repCounts[exercise.id] ?? 0;
          const isDone = reps >= repsPerExercise;
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
              role="button"
              tabIndex={0}
              aria-expanded={isDemoOpen}
              aria-label={`${exercise.name}. ${isDemoOpen ? "Скрыть" : "Как сделать"}`}
              onClick={(event) => {
                event.stopPropagation();
                const target = event.target as HTMLElement;
                if (target.closest(".home__strength-exercise-btn, video")) {
                  return;
                }
                toggleExerciseDemo(exercise.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                toggleExerciseDemo(exercise.id);
              }}
            >
              <div className="home__strength-exercise-marker" aria-hidden="true">
                {isDone ? <CheckIcon className="home__strength-exercise-check" /> : index + 1}
              </div>
              <div className="home__strength-exercise-body">
                <div className="home__strength-exercise-name-btn">
                  {exercise.name}
                  <span className="home__strength-exercise-name-hint">
                    {isDemoOpen ? "Скрыть" : "Как сделать"}
                  </span>
                </div>
                <p className="home__strength-exercise-desc">{exercise.description}</p>
                <p className="home__strength-exercise-reps">
                  {isDone ? repsPerExercise : reps} / {repsPerExercise}
                </p>
                <div
                  className={[
                    "home__strength-exercise-demo-shell",
                    isDemoOpen ? "home__strength-exercise-demo-shell--open" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="home__strength-exercise-demo-shell-inner">
                    <div
                      className={[
                        "home__strength-exercise-demo",
                        isExerciseDemoVideo(exercise.demoGifUrl)
                          ? "home__strength-exercise-demo--video"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isExerciseDemoVideo(exercise.demoGifUrl) ? (
                        <ExerciseDemoVideo
                          src={exercise.demoGifUrl}
                          label={`Техника: ${exercise.name}`}
                          active={isDemoOpen}
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
                  </div>
                </div>
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
                    Сделал
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
