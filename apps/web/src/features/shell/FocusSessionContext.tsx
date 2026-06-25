import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type FocusSessionContextValue = {
  isActive: boolean;
  setActive: (active: boolean) => void;
};

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setActive] = useState(false);
  const value = useMemo(() => ({ isActive, setActive }), [isActive]);

  return <FocusSessionContext.Provider value={value}>{children}</FocusSessionContext.Provider>;
}

export function useFocusSession(): FocusSessionContextValue {
  const value = useContext(FocusSessionContext);
  if (!value) {
    throw new Error("useFocusSession must be used within FocusSessionProvider");
  }
  return value;
}
