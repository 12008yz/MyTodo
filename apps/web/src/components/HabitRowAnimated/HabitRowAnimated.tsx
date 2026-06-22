type HabitRowHintProps = {
  text: string;
  visible: boolean;
};

type HabitRowMetaProps = {
  text: string;
  visible: boolean;
};

export function HabitRowHint({ text, visible }: HabitRowHintProps) {
  return (
    <span className={["onboarding__habit-row-subline", visible ? "is-open" : ""].filter(Boolean).join(" ")}>
      <span className="onboarding__habit-row-subline-inner">
        <span
          className={[
            "onboarding__habit-row-hint",
            visible ? "is-visible" : "is-hidden",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={!visible}
        >
          {text}
        </span>
      </span>
    </span>
  );
}

export function HabitRowMeta({ text, visible }: HabitRowMetaProps) {
  return (
    <span
      className={["onboarding__habit-row-meta", visible ? "is-visible" : "is-hidden"]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!visible}
    >
      {text}
    </span>
  );
}
