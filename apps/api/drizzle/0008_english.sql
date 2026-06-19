CREATE TABLE "english_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_number" integer NOT NULL,
	"title" varchar NOT NULL,
	"video_url" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "english_lessons_day_number_unique" UNIQUE("day_number")
);
--> statement-breakpoint
CREATE TABLE "english_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"current_day" integer DEFAULT 1 NOT NULL,
	"started_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "english_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid,
	"date" date NOT NULL,
	"status" varchar NOT NULL,
	"watched_sec" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "english_progress_user_id_date_unique" UNIQUE("user_id","date"),
	CONSTRAINT "english_progress_status_check" CHECK ("status" IN ('success', 'fail', 'pending', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "english_settings" ADD CONSTRAINT "english_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "english_progress" ADD CONSTRAINT "english_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "english_progress" ADD CONSTRAINT "english_progress_lesson_id_english_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."english_lessons"("id") ON DELETE set null ON UPDATE no action;
