# Pacenote

Training management for coached running squads. Coaches build training blocks
out of reusable workout templates and assign them against an athlete's goal
race; athletes log the sessions they actually did.

Early days. The schema is in `src/db/schema` and the migrations next to it.

## Running it locally

```sh
npm install
cp .env.example .env
npm run migrate
npm run dev
```

You need Postgres 15 or newer with `pgcrypto` available for
`gen_random_uuid()`.

```sh
npm test
npm run typecheck
```

## Roles

Roles are rows in `user_roles`, one per squad, and every route checks them
server-side.

| Role | Scope | Can |
|---|---|---|
| Head coach | one squad | Everything in their squad |
| Assistant coach | one squad | Draft blocks. Cannot publish |
| Physio | across squads | Sign off an injured athlete's return to running |
| Athlete | themselves | Log their own sessions, read their own plan |

## Days belong to the athlete

Every day bucket is a day in the athlete's own timezone - not the squad's,
and not UTC. A 22:40 run in Auckland belongs to the Auckland date.
