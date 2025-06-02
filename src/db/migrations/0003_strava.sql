CREATE TABLE "strava_links" (
  "athlete_id" uuid PRIMARY KEY NOT NULL,
  "strava_athlete_id" bigint NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "strava_activity_id" bigint NOT NULL,
  "ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "session_id" uuid,
  CONSTRAINT "strava_activities_strava_activity_id_unique" UNIQUE("strava_activity_id")
);
--> statement-breakpoint
ALTER TABLE "strava_links" ADD CONSTRAINT "strava_links_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE set null;
