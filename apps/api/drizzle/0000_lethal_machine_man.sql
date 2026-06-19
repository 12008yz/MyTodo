CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"gender" varchar(10) NOT NULL,
	"weight_kg" numeric(5, 1),
	"height_cm" numeric(5, 1),
	"free_time_min" integer,
	"daily_budget_min" integer DEFAULT 60 NOT NULL,
	"timezone" varchar(64) DEFAULT 'Europe/Moscow' NOT NULL,
	"wake_time" varchar(8),
	"sleep_time" varchar(8),
	"pomodoro_work_min" integer DEFAULT 25 NOT NULL,
	"pomodoro_break_min" integer DEFAULT 5 NOT NULL,
	"pomodoro_long_break_min" integer DEFAULT 15 NOT NULL,
	"harshness_level" integer DEFAULT 1 NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"silence_mode_until" timestamp with time zone,
	"silence_mode_used_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;