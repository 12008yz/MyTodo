CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"yukassa_payment_method_id" varchar,
	"plan" varchar NOT NULL,
	"status" varchar NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"past_due_retry_count" integer DEFAULT 0 NOT NULL,
	"last_payment_failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_plan_check" CHECK ("plan" IN ('monthly', '2months', '3months')),
	CONSTRAINT "subscriptions_status_check" CHECK ("status" IN ('active', 'canceled', 'expired', 'past_due'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yukassa_payment_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_payment_event_unique" UNIQUE("yukassa_payment_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");
