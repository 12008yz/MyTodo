import { PLANK_DEMO_URL } from "@mytodo/shared";
import { HabitTechniqueDemo } from "./HabitTechniqueDemo";

export function PlankTechniqueDemo() {
  return (
    <HabitTechniqueDemo
      videoSrc={PLANK_DEMO_URL}
      videoLabel="Техника: планка"
      ariaTopic="планки"
      description="Корпус прямой, локти под плечами, не прогибайте поясницу."
      wrapClassName="home__plank-technique-wrap"
      itemClassName="home__plank-technique"
    />
  );
}
