CREATE TYPE "block_state" AS ENUM ('draft', 'published');
--> statement-breakpoint
CREATE TABLE "training_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "squad_id" uuid NOT NULL,
  "name" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "weeks" integer NOT NULL,
  "state" "block_state" DEFAULT 'draft' NOT NULL,
  "published_by" uuid,
  "published_at" timestamp with time zone,
  CONSTRAINT "training_blocks_squad_name_version" UNIQUE("squad_id","name","version")
);
--> statement-breakpoint
CREATE TABLE "block_slots" (
  "block_id" uuid NOT NULL,
  "week" integer NOT NULL,
  "day" integer NOT NULL,
  "template_id" uuid NOT NULL,
  "template_version" integer NOT NULL,
  CONSTRAINT "block_slots_block_id_week_day_pk" PRIMARY KEY("block_id","week","day")
);
--> statement-breakpoint
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "training_blocks" ADD CONSTRAINT "training_blocks_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "block_slots" ADD CONSTRAINT "block_slots_block_id_training_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "training_blocks"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "block_slots" ADD CONSTRAINT "block_slots_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id");
