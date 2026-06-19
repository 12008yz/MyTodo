CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"side" varchar(10) NOT NULL,
	"unit" varchar(20),
	"baseline_value" numeric(10, 2) NOT NULL,
	"current_goal" numeric(10, 2) NOT NULL,
	"growth_step" numeric(10, 2) DEFAULT '1' NOT NULL,
	"progression_direction" varchar(20) NOT NULL,
	"phase" varchar(20) DEFAULT 'reduction' NOT NULL,
	"last_relapse_at" timestamp with time zone,
	"allows_weekly_skip" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"icon" varchar(32),
	"template_id" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;