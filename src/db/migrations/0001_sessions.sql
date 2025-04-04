CREATE TYPE "session_source" AS ENUM ('manual', 'strava');
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "scheduled_for" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "distance_m" integer,
  "duration_s" integer,
  "avg_hr" integer,
  "perceived_effort" integer,
  "source" "session_source" DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
