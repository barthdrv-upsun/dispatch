CREATE TABLE "shoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "model" text NOT NULL,
  "purchased_on" date NOT NULL,
  "retire_at_km" numeric(7, 2) NOT NULL,
  "current_km" numeric(7, 2) DEFAULT '0' NOT NULL,
  "retired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "shoe_id" uuid;
--> statement-breakpoint
ALTER TABLE "shoes" ADD CONSTRAINT "shoes_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_shoe_id_shoes_id_fk" FOREIGN KEY ("shoe_id") REFERENCES "shoes"("id") ON DELETE set null;
