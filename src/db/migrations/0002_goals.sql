CREATE TYPE "goal_state" AS ENUM ('planned', 'active', 'completed', 'abandoned');
--> statement-breakpoint
CREATE TABLE "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "race_name" text NOT NULL,
  "race_date" date NOT NULL,
  "distance_m" integer NOT NULL,
  "target_time_s" integer,
  "state" "goal_state" DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "race_name" text NOT NULL,
  "race_date" date NOT NULL,
  "distance_m" integer NOT NULL,
  "finish_time_s" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
