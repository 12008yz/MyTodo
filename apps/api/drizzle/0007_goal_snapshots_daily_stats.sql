CREATE TABLE "goal_snapshots" (
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"goal_value" numeric NOT NULL,
	CONSTRAINT "goal_snapshots_habit_id_date_pk" PRIMARY KEY("habit_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" varchar NOT NULL,
	"value" numeric,
	"minutes_total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_stats_habit_id_date_pk" PRIMARY KEY("habit_id","date"),
	CONSTRAINT "daily_stats_status_check" CHECK ("status" IN ('success', 'fail', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "goal_snapshots" ADD CONSTRAINT "goal_snapshots_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
