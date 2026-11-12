ALTER TABLE "days" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "kind" text DEFAULT 'itinerary' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "day_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "client" jsonb;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "stops" ADD COLUMN "time" text;--> statement-breakpoint
-- Day 2 folded the stop time into the description ("09:00 · text"); split it out.
UPDATE "stops" SET "time" = substring("description" from '^(\d\d:\d\d)'), "description" = NULLIF(regexp_replace("description", '^\d\d:\d\d( · )?', ''), '') WHERE "description" ~ '^\d\d:\d\d';
