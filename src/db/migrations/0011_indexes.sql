CREATE INDEX "sessions_athlete_completed_idx" ON "sessions" ("athlete_id","completed_at");
--> statement-breakpoint
CREATE INDEX "sessions_plan_idx" ON "sessions" ("plan_id");
--> statement-breakpoint
CREATE INDEX "sleep_logs_athlete_date_idx" ON "sleep_logs" ("athlete_id","local_date");
--> statement-breakpoint
CREATE INDEX "injuries_athlete_open_idx" ON "injuries" ("athlete_id","resolved_on");
--> statement-breakpoint
CREATE INDEX "clearances_injury_idx" ON "clearances" ("injury_id");
--> statement-breakpoint
CREATE INDEX "user_roles_squad_role_idx" ON "user_roles" ("squad_id","role");
