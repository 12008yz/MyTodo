ALTER TABLE "checkins" ADD CONSTRAINT "checkins_status_check" CHECK ("status" IN ('success', 'fail', 'pending', 'skipped'));
