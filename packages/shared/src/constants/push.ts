export const PUSH_EVENT_TYPES = [
  "morning",
  "afternoon",
  "evening",
  "early_rise_wake",
  "pomodoro_break",
  "relapse",
  "success",
  "smoke_cheer",
  "doom_scroll_start",
  "doom_scroll_warning",
  "doom_scroll_end",
  "doom_scroll_limit",
  "goal_reduced",
  "test",
] as const;

export type PushEventType = (typeof PUSH_EVENT_TYPES)[number];
