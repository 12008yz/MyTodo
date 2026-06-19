export const PUSH_EVENT_TYPES = [
  "morning",
  "afternoon",
  "evening",
  "relapse",
  "success",
  "smoke_cheer",
  "doom_scroll_start",
  "doom_scroll_end",
  "doom_scroll_limit",
  "test",
] as const;

export type PushEventType = (typeof PUSH_EVENT_TYPES)[number];
