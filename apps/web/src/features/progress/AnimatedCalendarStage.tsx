import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type AnimatedCalendarStageProps = {
  measureKey: string;
  children: ReactNode;
};

export function AnimatedCalendarStage({ measureKey, children }: AnimatedCalendarStageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const updateHeight = () => {
      setHeight(content.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);

    return () => observer.disconnect();
  }, [measureKey]);

  return (
    <div
      className="progress__calendar-stage"
      style={height == null ? undefined : { height: `${height}px` }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
