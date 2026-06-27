import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserLocalDate } from "@mytodo/domain";
import { habitReadingProgressSchema, selectHabitBookRequestSchema, updateReadingBookmarkRequestSchema } from "@mytodo/shared";
import { authenticate } from "../plugins/authenticate.js";
import type { RequireAccessHandler } from "../plugins/require-access.js";
import type { UserService } from "../services/auth.js";
import type { ReadingProgressService } from "../services/reading-progress.js";

export async function registerReadingRoutes(
  app: FastifyInstance,
  userService: UserService,
  readingProgressService: ReadingProgressService,
  requireAccess: RequireAccessHandler,
): Promise<void> {
  const preHandlers = [authenticate, requireAccess];

  app.get(
    "/api/v1/habits/:id/reading",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const reading = await readingProgressService.getForHabit(request.userId, params.id);
      return { reading };
    },
  );

  app.put(
    "/api/v1/habits/:id/reading/select",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = selectHabitBookRequestSchema.parse(request.body);
      const user = await userService.getById(request.userId);
      const planDate =
        body.checkin_baseline !== undefined
          ? getUserLocalDate(new Date(), user.timezone)
          : undefined;
      const reading = await readingProgressService.selectBook(user, params.id, body.book_id, {
        planDate,
        checkinBaseline: body.checkin_baseline,
      });
      return habitReadingProgressSchema.parse(reading);
    },
  );

  app.delete(
    "/api/v1/habits/:id/reading",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      await readingProgressService.clearBookSelection(request.userId, params.id);
      return { reading: null };
    },
  );

  app.patch(
    "/api/v1/habits/:id/reading/bookmark",
    { preHandler: preHandlers },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateReadingBookmarkRequestSchema.parse(request.body);
      const reading = await readingProgressService.updateBookmark(request.userId, params.id, {
        lastReadPage: body.last_read_page,
        timerRemainingSeconds: body.timer_remaining_seconds,
        timerSavedDate: body.timer_saved_date,
        readerDayStartPage: body.reader_day_start_page,
        readerDayDate: body.reader_day_date,
      });
      return habitReadingProgressSchema.parse(reading);
    },
  );
}
