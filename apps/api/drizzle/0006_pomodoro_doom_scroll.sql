CREATE TABLE "pomodoro_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"work_min" integer DEFAULT 25 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doom_scroll_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 15 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doom_scroll_sessions" ADD CONSTRAINT "doom_scroll_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doom_scroll_sessions" ADD CONSTRAINT "doom_scroll_sessions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pomodoro_sessions_active_habit_idx" ON "pomodoro_sessions" USING btree ("habit_id");
--> statement-breakpoint
CREATE INDEX "doom_scroll_sessions_active_habit_idx" ON "doom_scroll_sessions" USING btree ("habit_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "pomodoro_sessions_one_active_per_habit" ON "pomodoro_sessions" ("habit_id") WHERE "completed" = false AND "ended_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "doom_scroll_sessions_one_active_per_habit" ON "doom_scroll_sessions" ("habit_id") WHERE "completed" = false;
