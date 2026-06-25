ALTER TABLE "habit_sessions" ADD COLUMN "paused_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "habit_sessions" ADD COLUMN "paused_remaining_seconds" integer;
