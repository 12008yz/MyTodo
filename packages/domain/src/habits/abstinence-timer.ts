export type AbstinenceElapsed = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total_seconds: number;
};

export function computeAbstinenceElapsed(
  lastRelapseAt: Date,
  now: Date,
): AbstinenceElapsed {
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - lastRelapseAt.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    total_seconds: totalSeconds,
  };
}
