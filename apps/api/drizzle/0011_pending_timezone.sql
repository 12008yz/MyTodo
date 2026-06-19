ALTER TABLE "users" ADD COLUMN "pending_timezone" varchar(64);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_timezone_from" date;
