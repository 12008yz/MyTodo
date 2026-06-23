UPDATE "notification_templates"
SET "message" = 'Подъём, боец. День начинается с победы над собой. В строй!'
WHERE "event_type" = 'morning' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = 'Доклад по целям. Ты выполнил план или оправдываешься?'
WHERE "event_type" = 'afternoon' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = 'Отбой через час. Проверь выполнение. Слабость — не для тебя.'
WHERE "event_type" = 'evening' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = 'Срыв зафиксирован. Встань, отряхнись и вспомни, зачем ты здесь. Ты сильнее этого. Продолжаем.'
WHERE "event_type" = 'relapse' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = 'Норматив сдан. Продолжай.'
WHERE "event_type" = 'success' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = '48 часов в строю. Дыши свободно. Так держать!'
WHERE "event_type" = 'smoke_cheer' AND "harshness_level" = 3;
--> statement-breakpoint
UPDATE "notification_templates"
SET "message" = 'Таймер на 15 минут. По окончании — отбой. Контролируй себя.'
WHERE "event_type" = 'doom_scroll_start' AND "harshness_level" = 3;
