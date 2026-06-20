import { z } from "zod";
import { englishLessonSchema } from "./english.js";
import { pledgeResponseSchema } from "./pledges.js";
import { subscriptionResponseSchema } from "./billing.js";
import { userProfileSchema } from "./user.js";

export const ADMIN_SUBSCRIPTION_FILTERS = ["trial", "active", "past_due", "expired", "none"] as const;
export type AdminSubscriptionFilter = (typeof ADMIN_SUBSCRIPTION_FILTERS)[number];

export const ADMIN_PLEDGE_FILTERS = ["active", "none"] as const;
export type AdminPledgeFilter = (typeof ADMIN_PLEDGE_FILTERS)[number];

export const ADMIN_BROADCAST_FILTERS = ["all", "subscribed", "trial", "no_subscription"] as const;
export type AdminBroadcastFilter = (typeof ADMIN_BROADCAST_FILTERS)[number];

export const adminUsersQuerySchema = z.object({
  subscription: z.enum(ADMIN_SUBSCRIPTION_FILTERS).optional(),
  pledge: z.enum(ADMIN_PLEDGE_FILTERS).optional(),
  search: z.string().min(1).max(255).optional(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUserListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["user", "admin"]),
  trial_ends_at: z.string().datetime(),
  subscription_status: z.string().nullable(),
  has_active_pledge: z.boolean(),
  created_at: z.string().datetime(),
});

export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminUsersListResponseSchema = z.object({
  items: z.array(adminUserListItemSchema),
});

export type AdminUsersListResponse = z.infer<typeof adminUsersListResponseSchema>;

export const adminUserDetailSchema = z.object({
  user: userProfileSchema,
  subscription: subscriptionResponseSchema.nullable(),
  pledges: z.array(pledgeResponseSchema),
});

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminClosePledgeRequestSchema = z.object({
  status: z.enum(["success", "failed"]),
  admin_comment: z.string().min(1).max(2000),
});

export type AdminClosePledgeRequest = z.infer<typeof adminClosePledgeRequestSchema>;

export const createEnglishLessonRequestSchema = z.object({
  day_number: z.number().int().positive().max(365),
  title: z.string().min(1).max(255),
  video_url: z.string().url(),
  duration_sec: z.number().int().positive().max(7200),
  description: z.string().max(1000).nullable().optional(),
});

export type CreateEnglishLessonRequest = z.infer<typeof createEnglishLessonRequestSchema>;

export const patchEnglishLessonRequestSchema = z
  .object({
    day_number: z.number().int().positive().max(365).optional(),
    title: z.string().min(1).max(255).optional(),
    video_url: z.string().url().optional(),
    duration_sec: z.number().int().positive().max(7200).optional(),
    description: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export type PatchEnglishLessonRequest = z.infer<typeof patchEnglishLessonRequestSchema>;

export const adminEnglishLessonsResponseSchema = z.object({
  items: z.array(englishLessonSchema),
});

export type AdminEnglishLessonsResponse = z.infer<typeof adminEnglishLessonsResponseSchema>;

export const adminPushBroadcastRequestSchema = z.object({
  text: z.string().min(1).max(500),
  filter: z.enum(ADMIN_BROADCAST_FILTERS).default("all"),
});

export type AdminPushBroadcastRequest = z.infer<typeof adminPushBroadcastRequestSchema>;

export const adminPushBroadcastResponseSchema = z.object({
  targeted_users: z.number().int().min(0),
  sent: z.number().int().min(0),
  failed: z.number().int().min(0),
});

export type AdminPushBroadcastResponse = z.infer<typeof adminPushBroadcastResponseSchema>;
