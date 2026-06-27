import { useState } from "react";
import { ExerciseDemoVideo } from "./ExerciseDemoVideo";

type HabitTechniqueDemoProps = {
  videoSrc: string;
  videoLabel: string;
  ariaTopic: string;
  description: string;
  wrapClassName: string;
  itemClassName: string;
};

export function HabitTechniqueDemo({
  videoSrc,
  videoLabel,
  ariaTopic,
  description,
  wrapClassName,
  itemClassName,
}: HabitTechniqueDemoProps) {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div
      className={wrapClassName}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className={[
          "home__strength-exercise",
          itemClassName,
          demoOpen ? "home__strength-exercise--demo-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="button"
        tabIndex={0}
        aria-expanded={demoOpen}
        aria-label={`Техника ${ariaTopic}. ${demoOpen ? "Скрыть" : "Как сделать"}`}
        onClick={(event) => {
          event.stopPropagation();
          if ((event.target as HTMLElement).closest("video")) {
            return;
          }
          setDemoOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setDemoOpen((open) => !open);
        }}
      >
        <div className="home__strength-exercise-body">
          <div className="home__strength-exercise-name-btn">
            Техника
            <span className="home__strength-exercise-name-hint">
              {demoOpen ? "Скрыть" : "Как сделать"}
            </span>
          </div>
          <p className="home__strength-exercise-desc">{description}</p>
          <div
            className={[
              "home__strength-exercise-demo-shell",
              demoOpen ? "home__strength-exercise-demo-shell--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="home__strength-exercise-demo-shell-inner">
              <div className="home__strength-exercise-demo home__strength-exercise-demo--video">
                <ExerciseDemoVideo src={videoSrc} label={videoLabel} active={demoOpen} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
