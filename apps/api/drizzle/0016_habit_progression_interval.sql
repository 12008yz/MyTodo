ALTER TABLE "habits" ADD COLUMN "progression_interval_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "success_days_at_goal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "habits" SET "progression_interval_days" = 3 WHERE "template_id" IN ('smoking', 'sugar', 'sweets');
