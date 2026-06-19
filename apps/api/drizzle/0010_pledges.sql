CREATE TABLE "pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"amount_rub" integer DEFAULT 5000 NOT NULL,
	"status" varchar NOT NULL,
	"charity_fund" varchar NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"yukassa_payment_id" varchar,
	"refund_error" boolean DEFAULT false NOT NULL,
	"admin_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pledges_status_check" CHECK ("status" IN ('active', 'success', 'failed')),
	CONSTRAINT "pledges_charity_fund_check" CHECK ("charity_fund" IN ('oncology', 'children', 'animals'))
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_type" varchar NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pledges_user_id_idx" ON "pledges" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "pledges_habit_id_idx" ON "pledges" USING btree ("habit_id");
