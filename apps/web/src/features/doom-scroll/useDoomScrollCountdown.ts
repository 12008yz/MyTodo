import { useEffect, useState } from "react";
import type { DoomScrollSessionResponse } from "@mytodo/shared";

export function useDoomScrollCountdown(
  session: DoomScrollSessionResponse | null | undefined,
): number {
  const [remainingSec, setRemainingSec] = useState(() =>
    session?.remaining_sec ?? 0,
  );

  useEffect(() => {
    if (!session || session.completed) {
      setRemainingSec(0);
      return;
    }

    const tick = () => {
      const endsAt = new Date(session.ends_at).getTime();
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSec(next);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session]);

  return remainingSec;
}

export function formatDoomScrollCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
