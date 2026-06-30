import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { DoomScrollPlatform } from "@mytodo/shared";
import type { PushService } from "../services/push.js";
import type { DoomScrollService } from "../services/doom-scroll.js";

export const PUSH_QUEUE_NAME = "mytodo-push";
export const DOOM_SCROLL_END_JOB = "doom-scroll-end";
export const DOOM_SCROLL_WARNING_JOB = "doom-scroll-warning";

export type DoomScrollSessionJobData = {
  session_id: string;
  user_id: string;
  habit_id: string;
  platform?: DoomScrollPlatform | null;
};

type PushLogger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

function bullmqConnection(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

export function createPushQueue(redis: Redis): Queue<DoomScrollSessionJobData> {
  return new Queue(PUSH_QUEUE_NAME, {
    connection: bullmqConnection(redis),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

export function createDoomScrollJobsWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  logger: PushLogger,
): Worker<DoomScrollSessionJobData> {
  return new Worker<DoomScrollSessionJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      if (job.name === DOOM_SCROLL_WARNING_JOB) {
        const result = await doomScrollService.getSessionForWarningPush(
          job.data.user_id,
          job.data.session_id,
          job.data.habit_id,
        );

        if (!result) {
          return;
        }

        const sent = await pushService.onDoomScrollWarning(
          result.user,
          result.habit,
          job.data.platform ?? null,
        );

        if (sent) {
          logger.info(
            {
              event: "push_sent",
              user_id: result.user.id,
              event_type: "doom_scroll_warning",
              session_id: job.data.session_id,
            },
            "doom scroll warning push sent",
          );
        }
        return;
      }

      if (job.name !== DOOM_SCROLL_END_JOB) {
        return;
      }

      await doomScrollService.finalizeSessionForPush(
        job.data.user_id,
        job.data.session_id,
        job.data.habit_id,
        job.data.platform ?? null,
      );
    },
    { connection: bullmqConnection(redis) },
  );
}

export async function startPushWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  logger: PushLogger,
): Promise<{ queue: Queue<DoomScrollSessionJobData>; worker: Worker<DoomScrollSessionJobData> }> {
  const queue = createPushQueue(redis);
  const worker = createDoomScrollJobsWorker(redis, pushService, doomScrollService, logger);

  worker.on("failed", (job, error) => {
    logger.error(
      { event: "push_worker_failed", job_id: job?.id, error: error.message },
      "push worker job failed",
    );
  });

  return { queue, worker };
}
