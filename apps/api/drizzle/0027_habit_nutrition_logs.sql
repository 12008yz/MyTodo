CREATE TABLE "habit_nutrition_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "habit_id" uuid NOT NULL,
  "date" date NOT NULL,
  "ingredient_ids" jsonb NOT NULL,
  "recipe_id" varchar(64),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "habit_nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "habit_nutrition_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "habit_nutrition_logs_habit_id_date_unique" ON "habit_nutrition_logs" USING btree ("habit_id","date");
--> statement-breakpoint
CREATE INDEX "habit_nutrition_logs_user_idx" ON "habit_nutrition_logs" USING btree ("user_id");
