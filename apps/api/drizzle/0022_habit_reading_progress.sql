CREATE TABLE "habit_reading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"book_id" varchar(64) NOT NULL,
	"pages_read" integer DEFAULT 0 NOT NULL,
	"pages_credited_today" integer DEFAULT 0 NOT NULL,
	"last_checkin_date" date,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_reading_progress_habit_id_unique" UNIQUE("habit_id")
);
--> statement-breakpoint
ALTER TABLE "habit_reading_progress" ADD CONSTRAINT "habit_reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "habit_reading_progress" ADD CONSTRAINT "habit_reading_progress_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "habit_reading_progress_user_idx" ON "habit_reading_progress" USING btree ("user_id");
