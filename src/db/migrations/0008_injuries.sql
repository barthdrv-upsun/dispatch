CREATE TABLE "injuries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "region" text NOT NULL,
  "onset_on" date NOT NULL,
  "severity" integer NOT NULL,
  "notes" text,
  "resolved_on" date
);
--> statement-breakpoint
CREATE TABLE "clearances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "injury_id" uuid NOT NULL,
  "signed_by" uuid NOT NULL,
  "signed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "notes" text,
  "load_snapshot" jsonb
);
--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "clearances" ADD CONSTRAINT "clearances_injury_id_injuries_id_fk" FOREIGN KEY ("injury_id") REFERENCES "injuries"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "clearances" ADD CONSTRAINT "clearances_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "users"("id");
