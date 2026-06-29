ALTER TABLE "english_settings" ADD COLUMN IF NOT EXISTS "selected_lesson_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "english_settings" ADD CONSTRAINT "english_settings_selected_lesson_id_english_lessons_id_fk" FOREIGN KEY ("selected_lesson_id") REFERENCES "public"."english_lessons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
