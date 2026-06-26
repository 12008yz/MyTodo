-- Early rise: goal is minutes earlier than profile wake_time (0 = no shift yet).
UPDATE "habits"
SET
  "baseline_value" = 0,
  "current_goal" = GREATEST(0, "current_goal" - 5)
WHERE "category_key" = 'early_rise'
  AND "baseline_value" = 5;
