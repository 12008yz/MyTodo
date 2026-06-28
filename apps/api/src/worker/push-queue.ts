import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Redis } from "ioredis";
import { DOOM_SCROLL_DURATION_MIN } from "@mytodo/shared";
import type { PushService } from "../services/push.js";
import type { DoomScrollService } from "../services/doom-scroll.js";

export const PUSH_QUEUE_NAME = "mytodo-push";
export const DOOM_SCROLL_END_JOB = "doom-scroll-end";

export type DoomScrollEndJobData = {
  session_id: string;
  user_id: string;
  habit_id: string;
};

type PushLogger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

function bullmqConnection(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

export function createPushQueue(redis: Redis): Queue<DoomScrollEndJobData> {
  return new Queue(PUSH_QUEUE_NAME, {
    connection: bullmqConnection(redis),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

export async function scheduleDoomScrollEndPush(
  queue: Queue<DoomScrollEndJobData>,
  data: DoomScrollEndJobData,
): Promise<void> {
  await queue.add(DOOM_SCROLL_END_JOB, data, {
    jobId: `doom-scroll-end:${data.session_id}`,
    delay: DOOM_SCROLL_DURATION_MIN * 60_000,
    removeOnComplete: true,
  });
}

export function createDoomScrollEndWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  logger: PushLogger,
): Worker<DoomScrollEndJobData> {
  return new Worker<DoomScrollEndJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      if (job.name !== DOOM_SCROLL_END_JOB) {
        return;
      }

      const result = await doomScrollService.finalizeSessionForPush(
        job.data.user_id,
        job.data.session_id,
        job.data.habit_id,
      );

      if (!result) {
        return;
      }

      const sent = await pushService.onDoomScrollEnd(
        result.user,
        result.habit,
        result.sessionStartedAt,
      );

      if (sent) {
        logger.info(
          {
            event: "push_sent",
            user_id: result.user.id,
            event_type: "doom_scroll_end",
            session_id: job.data.session_id,
          },
          "doom scroll end push sent",
        );
      }
    },
    { connection: bullmqConnection(redis) },
  );
}

export async function startPushWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  logger: PushLogger,
): Promise<{ queue: Queue<DoomScrollEndJobData>; worker: Worker<DoomScrollEndJobData> }> {
  const queue = createPushQueue(redis);
  const worker = createDoomScrollEndWorker(redis, pushService, doomScrollService, logger);

  worker.on("failed", (job, error) => {
    logger.error(
      { event: "push_worker_failed", job_id: job?.id, error: error.message },
      "push worker job failed",
    );
  });

  return { queue, worker };
}
