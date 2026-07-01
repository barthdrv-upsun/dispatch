CREATE TABLE "sleep_logs" (
  "athlete_id" uuid NOT NULL,
  "local_date" date NOT NULL,
  "hours" numeric(4, 2) NOT NULL,
  "quality" integer,
  CONSTRAINT "sleep_logs_athlete_id_local_date_pk" PRIMARY KEY("athlete_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "hydration_logs" (
  "athlete_id" uuid NOT NULL,
  "local_date" date NOT NULL,
  "litres" numeric(4, 2) NOT NULL,
  CONSTRAINT "hydration_logs_athlete_id_local_date_pk" PRIMARY KEY("athlete_id","local_date")
);
--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "hydration_logs" ADD CONSTRAINT "hydration_logs_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
