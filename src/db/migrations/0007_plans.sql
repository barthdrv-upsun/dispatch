CREATE TABLE "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "athlete_id" uuid NOT NULL,
  "goal_id" uuid,
  "block_id" uuid NOT NULL,
  "block_version" integer NOT NULL,
  "starts_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "plan_id" uuid;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "template_id" uuid;
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_block_id_training_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "training_blocks"("id");
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE set null;
