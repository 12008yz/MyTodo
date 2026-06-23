import { createContext, useContext, useState, type ReactNode } from "react";
import type { StatsSide } from "@mytodo/shared";

export type HabitSide = StatsSide;

type SideContextValue = {
  side: HabitSide;
  setSide: (side: HabitSide) => void;
};

const SideContext = createContext<SideContextValue | null>(null);

export function SideProvider({ children }: { children: ReactNode }) {
  const [side, setSide] = useState<HabitSide>("light");

  return (
    <SideContext.Provider value={{ side, setSide }}>
      {children}
    </SideContext.Provider>
  );
}

export function useHabitSide(): SideContextValue {
  const value = useContext(SideContext);
  if (!value) {
    throw new Error("useHabitSide must be used within SideProvider");
  }
  return value;
}
