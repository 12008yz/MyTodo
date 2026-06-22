import { useCallback, useRef } from "react";
import { afterKeyboardDismiss } from "../utils/scrollPanelIntoView";

export function useDeferredBaselineCommit(onCommit: (value: string) => void) {
  const pendingRef = useRef(false);

  const commit = useCallback(
    (value: string, isValid: (candidate: string) => boolean) => {
      if (!isValid(value) || pendingRef.current) return;
      pendingRef.current = true;

      afterKeyboardDismiss(() => {
        onCommit(value);
        pendingRef.current = false;
      });
    },
    [onCommit],
  );

  const isPending = useCallback(() => pendingRef.current, []);

  return { commit, isPending };
}
