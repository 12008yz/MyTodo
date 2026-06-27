import { WARMUP_DEMO_URL } from "@mytodo/shared";
import { HabitTechniqueDemo } from "./HabitTechniqueDemo";

export function WarmupTechniqueDemo() {
  return (
    <HabitTechniqueDemo
      videoSrc={WARMUP_DEMO_URL}
      videoLabel="Техника: разминка"
      ariaTopic="разминки"
      description="Плавные движения суставов и мышц — без рывков и боли."
      wrapClassName="home__warmup-technique-wrap"
      itemClassName="home__warmup-technique"
    />
  );
}
