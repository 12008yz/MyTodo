import { addDays, listDatesInclusive } from "../stats/day-color.js";

export type PledgeDayStatus = "success" | "fail" | "skipped";

export type PledgeDayRecord = {
  date: string;
  status: PledgeDayStatus;
};

/** Evaluate a 30-day pledge period (§8.4). Skipped is OK — only silence-mode worker can skip pledge habits. */
export function evaluatePledgePeriod(
  records: PledgeDayRecord[],
  startedAt: string,
  periodDays = 30,
): "success" | "failed" {
  const byDate = new Map(records.map((record) => [record.date, record.status]));
  const endDate = addDays(startedAt, periodDays - 1);
  const expectedDates = listDatesInclusive(startedAt, endDate);

  for (const date of expectedDates) {
    const status = byDate.get(date);
    if (!status) {
      return "failed";
    }
    if (status === "fail") {
      return "failed";
    }
    if (status === "success" || status === "skipped") {
      continue;
    }
    return "failed";
  }

  return "success";
}
