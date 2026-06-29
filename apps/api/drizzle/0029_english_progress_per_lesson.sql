ALTER TABLE "english_settings" ADD COLUMN "selected_lesson_id" uuid;--> statement-breakpoint
ALTER TABLE "english_settings" ADD CONSTRAINT "english_settings_selected_lesson_id_english_lessons_id_fk" FOREIGN KEY ("selected_lesson_id") REFERENCES "public"."english_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "english_progress" AS ep
SET "lesson_id" = el."id"
FROM "english_lessons" AS el, "english_settings" AS es
WHERE ep."lesson_id" IS NULL
  AND ep."user_id" = es."user_id"
  AND el."day_number" = es."current_day";--> statement-breakpoint
UPDATE "english_progress" AS ep
SET "lesson_id" = (SELECT "id" FROM "english_lessons" WHERE "day_number" = 1 LIMIT 1)
WHERE ep."lesson_id" IS NULL;--> statement-breakpoint
ALTER TABLE "english_progress" DROP CONSTRAINT "english_progress_user_id_date_unique";--> statement-breakpoint
ALTER TABLE "english_progress" ADD CONSTRAINT "english_progress_user_id_date_lesson_id_unique" UNIQUE("user_id","date","lesson_id");
