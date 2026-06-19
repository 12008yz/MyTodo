import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { BillingService } from "../services/billing.js";
import type { DayCloseService } from "../services/day-close.js";

export const WORKER_QUEUE_NAME = "mytodo-worker";
export const WORKER_JOB_NAME = "minute-tick";

type WorkerLogger = {
  info: (obj: Record<string, unknown>, message?: string) => void;
  error: (obj: Record<string, unknown>, message?: string) => void;
};

function bullmqConnection(redis: Redis): ConnectionOptions {
  return redis as unknown as ConnectionOptions;
}

export function createWorkerQueue(redis: Redis): Queue {
  return new Queue(WORKER_QUEUE_NAME, {
    connection: bullmqConnection(redis),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

export async function ensureMinuteTickSchedule(queue: Queue): Promise<void> {
  const schedulers = await queue.getJobSchedulers();
  const exists = schedulers.some((scheduler) => scheduler.id === WORKER_JOB_NAME);

  if (exists) {
    return;
  }

  await queue.upsertJobScheduler(
    WORKER_JOB_NAME,
    { every: 60_000 },
    { name: WORKER_JOB_NAME, data: {} },
  );
}

export function createMinuteTickWorker(
  redis: Redis,
  dayCloseService: DayCloseService,
  billingService: BillingService,
  logger: WorkerLogger,
): Worker {
  return new Worker(
    WORKER_QUEUE_NAME,
    async () => {
      const now = new Date();
      await billingService.processEndedSubscriptions(now);
      await billingService.processPastDueRetries(now);
      const summaries = await dayCloseService.runMinuteTick(now);

      for (const summary of summaries) {
        if (summary.habits_closed === 0 && !summary.english_closed) {
          continue;
        }

        logger.info(
          {
            event: "day_closed",
            user_id: summary.user_id,
            date: summary.date,
            habits_closed: summary.habits_closed,
            english_closed: summary.english_closed,
          },
          "day closed",
        );
      }
    },
    { connection: bullmqConnection(redis) },
  );
}

export async function startWorker(
  redis: Redis,
  dayCloseService: DayCloseService,
  billingService: BillingService,
  logger: WorkerLogger,
): Promise<{ queue: Queue; worker: Worker }> {
  const queue = createWorkerQueue(redis);
  await ensureMinuteTickSchedule(queue);

  const worker = createMinuteTickWorker(redis, dayCloseService, billingService, logger);
  worker.on("failed", (job, error) => {
    logger.error(
      { event: "worker_failed", job_id: job?.id, error: error.message },
      "worker job failed",
    );
  });

  logger.info({ event: "worker_started", queue: WORKER_QUEUE_NAME }, "worker started");

  return { queue, worker };
}
