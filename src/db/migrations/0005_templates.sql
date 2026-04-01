CREATE TYPE "template_kind" AS ENUM ('easy', 'tempo', 'interval', 'long', 'strength', 'cycling', 'swimming');
--> statement-breakpoint
CREATE TABLE "workout_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "squad_id" uuid NOT NULL,
  "code" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "kind" "template_kind" NOT NULL,
  "prescription" jsonb NOT NULL,
  "load_factor" numeric(5, 2) NOT NULL,
  "superseded_at" timestamp with time zone,
  CONSTRAINT "workout_templates_squad_code_version" UNIQUE("squad_id","code","version")
);
--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE cascade;
