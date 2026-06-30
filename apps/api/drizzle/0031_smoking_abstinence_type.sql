UPDATE "habits"
SET
  "type" = 'abstinence',
  "progression_direction" = 'abstain'
WHERE
  "phase" = 'abstinence'
  AND "type" = 'limit';
