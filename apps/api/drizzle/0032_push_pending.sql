CREATE TABLE "push_pending" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"body" text NOT NULL,
	"harshness_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_pending" ADD CONSTRAINT "push_pending_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "push_pending_user_id_idx" ON "push_pending" USING btree ("user_id");
