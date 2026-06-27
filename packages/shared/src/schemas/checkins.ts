import { z } from "zod";

export const CHECKIN_STATUSES = ["success", "fail", "pending", "skipped"] as const;
export type CheckinStatusValue = (typeof CHECKIN_STATUSES)[number];

const checkinBodySchema = z.object({
  habit_id: z.string().uuid(),
  date: z.string().date().optional(),
  value: z.number().min(0).max(10_000).optional(),
  status: z.enum(["fail", "skipped"]).optional(),
  books_timer_expired: z.boolean().optional(),
});

export const createCheckinRequestSchema = checkinBodySchema.superRefine((body, ctx) => {
  if (body.status === "skipped") {
    return;
  }

  if (body.status === "fail") {
    return;
  }

  if (body.value === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "value is required unless status is fail or skipped",
      path: ["value"],
    });
  }
});

export type CreateCheckinRequest = z.infer<typeof createCheckinRequestSchema>;

export const batchCheckinItemSchema = checkinBodySchema.extend({
  updated_at: z.string().datetime().optional(),
});

export const batchCheckinRequestSchema = z
  .object({
    checkins: z.array(batchCheckinItemSchema).min(1).max(100),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();

    body.checkins.forEach((item, index) => {
      if (item.status === "skipped" || item.status === "fail") {
        // validated below for duplicates only
      } else if (item.value === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "value is required unless status is fail or skipped",
          path: ["checkins", index, "value"],
        });
      }

      if (item.date) {
        const key = `${item.habit_id}:${item.date}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate habit_id and date in batch",
            path: ["checkins", index, "habit_id"],
          });
        }
        seen.add(key);
      }
    });
  });

export type BatchCheckinRequest = z.infer<typeof batchCheckinRequestSchema>;

export const checkinResponseSchema = z.object({
  id: z.string().uuid(),
  habit_id: z.string().uuid(),
  date: z.string().date(),
  status: z.enum(CHECKIN_STATUSES),
  value: z.number().nullable(),
  updated_at: z.string().datetime(),
  current_goal: z.number(),
  preview_next_goal: z.number(),
});

export type CheckinResponse = z.infer<typeof checkinResponseSchema>;

export const batchCheckinResponseSchema = z.object({
  checkins: z.array(checkinResponseSchema),
  conflicts: z
    .array(
      z.object({
        habit_id: z.string().uuid(),
        date: z.string().date(),
        server_updated_at: z.string().datetime(),
      }),
    )
    .optional(),
});

export type BatchCheckinResponse = z.infer<typeof batchCheckinResponseSchema>;

export const listCheckinsQuerySchema = z.object({
  date: z.string().date(),
});

export type ListCheckinsQuery = z.infer<typeof listCheckinsQuerySchema>;
