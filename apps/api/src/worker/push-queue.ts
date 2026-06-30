import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { DoomScrollPlatform } from "@mytodo/shared";
import type { DoomScrollService } from "../services/doom-scroll.js";
import type { PomodoroService } from "../services/pomodoro.js";
import type { PushService } from "../services/push.js";

export const PUSH_QUEUE_NAME = "mytodo-push";
export const DOOM_SCROLL_END_JOB = "doom-scroll-end";
export const DOOM_SCROLL_WARNING_JOB = "doom-scroll-warning";
export const POMODORO_BREAK_JOB = "pomodoro-break";

export type DoomScrollSessionJobData = {
  session_id: string;
  user_id: string;
  habit_id: string;
  platform?: DoomScrollPlatform | null;
};

export type PomodoroBreakJobData = {
  session_id: string;
  user_id: string;
  habit_id: string;
};

type PushJobData = DoomScrollSessionJobData | PomodoroBreakJobData;

type PushLogger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

function bullmqConnection(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

export function createPushQueue(redis: Redis): Queue<PushJobData> {
  return new Queue(PUSH_QUEUE_NAME, {
    connection: bullmqConnection(redis),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

export function createPushJobsWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  pomodoroService: PomodoroService,
  logger: PushLogger,
): Worker<PushJobData> {
  return new Worker<PushJobData>(
    PUSH_QUEUE_NAME,
    async (job) => {
      if (job.name === POMODORO_BREAK_JOB) {
        const data = job.data as PomodoroBreakJobData;
        const result = await pomodoroService.getSessionForBreakPush(
          data.user_id,
          data.session_id,
          data.habit_id,
        );

        if (!result) {
          return;
        }

        const sent = await pushService.onPomodoroBreak(result.user, result.breakMin);

        if (sent) {
          logger.info(
            {
              event: "push_sent",
              user_id: result.user.id,
              event_type: "pomodoro_break",
              session_id: data.session_id,
            },
            "pomodoro break push sent",
          );
        }
        return;
      }

      if (job.name === DOOM_SCROLL_WARNING_JOB) {
        const data = job.data as DoomScrollSessionJobData;
        const result = await doomScrollService.getSessionForWarningPush(
          data.user_id,
          data.session_id,
          data.habit_id,
        );

        if (!result) {
          return;
        }

        const sent = await pushService.onDoomScrollWarning(
          result.user,
          result.habit,
          data.platform ?? null,
        );

        if (sent) {
          logger.info(
            {
              event: "push_sent",
              user_id: result.user.id,
              event_type: "doom_scroll_warning",
              session_id: data.session_id,
            },
            "doom scroll warning push sent",
          );
        }
        return;
      }

      if (job.name !== DOOM_SCROLL_END_JOB) {
        return;
      }

      const data = job.data as DoomScrollSessionJobData;
      await doomScrollService.finalizeSessionForPush(
        data.user_id,
        data.session_id,
        data.habit_id,
        data.platform ?? null,
      );
    },
    { connection: bullmqConnection(redis) },
  );
}

export async function startPushWorker(
  redis: Redis,
  pushService: PushService,
  doomScrollService: DoomScrollService,
  pomodoroService: PomodoroService,
  logger: PushLogger,
): Promise<{ queue: Queue<PushJobData>; worker: Worker<PushJobData> }> {
  const queue = createPushQueue(redis);
  const worker = createPushJobsWorker(
    redis,
    pushService,
    doomScrollService,
    pomodoroService,
    logger,
  );

  worker.on("failed", (job, error) => {
    logger.error(
      { event: "push_worker_failed", job_id: job?.id, error: error.message },
      "push worker job failed",
    );
  });

  return { queue, worker };
}
