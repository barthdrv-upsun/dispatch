CREATE TYPE "squad_role" AS ENUM ('head_coach', 'assistant_coach', 'physio', 'athlete');
--> statement-breakpoint
CREATE TYPE "athlete_state" AS ENUM ('active', 'injured', 'returning');
--> statement-breakpoint
CREATE TABLE "squads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "timezone" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
  "user_id" uuid NOT NULL,
  "squad_id" uuid NOT NULL,
  "role" "squad_role" NOT NULL,
  CONSTRAINT "user_roles_user_id_squad_id_role_pk" PRIMARY KEY("user_id","squad_id","role")
);
--> statement-breakpoint
CREATE TABLE "athletes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "squad_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "date_of_birth" date NOT NULL,
  "timezone" text NOT NULL,
  "resting_hr" integer,
  "max_hr" integer,
  "state" "athlete_state" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
