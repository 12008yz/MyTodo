import { useState } from "react";
import { PLANK_DEMO_URL } from "@mytodo/shared";
import { ExerciseDemoVideo } from "./ExerciseDemoVideo";

export function PlankTechniqueDemo() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div
      className="home__plank-technique-wrap"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className={[
          "home__strength-exercise home__plank-technique",
          demoOpen ? "home__strength-exercise--demo-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="button"
        tabIndex={0}
        aria-expanded={demoOpen}
        aria-label={`Техника планки. ${demoOpen ? "Скрыть" : "Как сделать"}`}
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
          <p className="home__strength-exercise-desc">
            Корпус прямой, локти под плечами, не прогибайте поясницу.
          </p>
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
                <ExerciseDemoVideo
                  src={PLANK_DEMO_URL}
                  label="Техника: планка"
                  active={demoOpen}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
