/**
 * Sentry stub for development. Real SDK wiring comes in block 14.
 */
export function initSentry(_dsn: string | undefined): void {
  // no-op in block 1
}

export function captureException(_error: unknown): void {
  // no-op in block 1
}
