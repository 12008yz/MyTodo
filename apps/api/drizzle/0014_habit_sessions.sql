CREATE TABLE "habit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"block_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"planned_min" integer NOT NULL,
	"actual_min" integer,
	"value_added" numeric,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habit_sessions" ADD CONSTRAINT "habit_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "habit_sessions" ADD CONSTRAINT "habit_sessions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "habit_sessions_habit_idx" ON "habit_sessions" USING btree ("habit_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "habit_sessions_one_active_per_habit" ON "habit_sessions" ("habit_id") WHERE "completed" = false AND "ended_at" IS NULL;
