# Pacenote

Training management for coached running squads. Coaches build training blocks
out of reusable workout templates and assign them against an athlete's goal
race; athletes log their sessions - or sync them from Strava - alongside
sleep, hydration and shoe mileage.

## Running it locally

```sh
npm install
cp .env.example .env          # nothing in here is a real credential
npm run migrate
npm run seed
npm run dev
```

You need Node 24 or newer - npm 10, which Node 20 and 22 ship, cannot
resolve the dev dependency tree - and Postgres 15 or newer with `pgcrypto`
available for `gen_random_uuid()`.

The tests do not need a database:

```sh
npm test
npm run typecheck
```

### Strava

There is no Strava integration in the sense of talking to strava.com. What
there is, is a local double in `src/fakes/strava` that answers from fixtures
recorded in July 2025, mints its own opaque tokens and has no network egress.
Point `STRAVA_BASE_URL` at it:

```sh
npm run fake:strava    # listens on 127.0.0.1:4010
```

That is also how the duplicate-delivery case gets exercised - the recorded
delivery log in `src/fakes/strava/fixtures/webhook_deliveries.json` contains
the same activity twice, and replaying it must not produce two sessions.

## Layout

```
src/
  legacy/ingest/   Strava sync and activity mapping. Class-based, callback
                   style, defensive about every field. The oldest code here
  domain/
    load/          Rolling-window load, ratio, ramp, rest, taper
    plans/         Templates, blocks, slots, assignment
    clearances/    Injuries and physio sign-off
    athletes/      Athlete state, roster, serialisation
    sessions/      Logging and crediting sessions
    shoes/         Mileage and retirement
    wellness/      Sleep and hydration
  routes/          Fastify handlers. Each one authorises itself
  ports/           The repository interfaces the handlers are given
  db/              Schema, migrations, and the Drizzle implementations
  fakes/strava/    The HTTP double and its fixtures
  seed/            Synthetic squads for development
test/
```

Two styles live here on purpose-ish: `src/legacy/ingest` is the original
2025 code and the rest of `src/domain` is the 2026 rewrite. They have not
been reconciled.

## Roles

Roles are rows in `user_roles`, one per squad, and every route checks them
server-side. Nothing a client sends widens what it can see.

| Role | Scope | Can |
|---|---|---|
| Head coach | one squad | Publish a training block, assign plans |
| Assistant coach | one squad | Draft blocks and templates. Cannot publish, cannot clear |
| Physio | across squads | Sign or withdraw a return-to-run clearance |
| Athlete | themselves | Log sessions, sleep, hydration, shoes; read their own plan |

Publishing and clearing are held by two different roles deliberately. A head
coach cannot sign their own athlete back to running, and a physio cannot
publish a block.

## The rules

These are the rules the domain enforces. They have numbers because the code
refers to them by number.

- **R1 - load ratio.** Acute load is the rolling 7-day sum. Chronic load is
  the rolling 28-day sum divided by four, so the two are comparable. The
  ratio has to stay inside 0.8-1.3; outside it, a hard session is downgraded
  to easy.
- **R2 - ramp cap.** Rolling 7-day volume may not exceed the previous rolling
  7-day figure by more than 10 per cent.
- **R3 - rest.** Every rolling 7-day window contains at least one day with no
  running load on it.
- **R4 - return to run.** An athlete in state `injured` cannot be prescribed
  or credited a running session until a physio has signed a clearance against
  the open injury and not withdrawn it. The clearance endpoints return 28 days
  of load, sleep and pain alongside the decision.
- **R5 - block versioning.** A plan pins `block_version` when it is assigned.
  Editing a block produces a new version and never reaches back into a plan
  that has already been assigned. Only a head coach may publish.
- **R6 - Strava idempotency.** An activity is ingested at most once per
  `strava_activity_id`. A replayed webhook must not double-count anything.
- **R7 - shoe retirement.** A pair at or past `retire_at_km` cannot be put on
  a new session.
- **R8 - taper.** Inside 14 days of a goal race, rolling 7-day volume has to
  be non-increasing week over week.

## Days belong to the athlete

Every day bucket in this codebase is a day in the athlete's own timezone -
not the squad's, and not UTC. A 22:40 run in Auckland belongs to the Auckland
date. An athlete who travels mid-block has their day boundaries move with
them, which moves a late-evening run into a different day and shifts every
rolling window that touches it. `athleteLocalDay` in `src/lib/time.ts` is the
only thing allowed to decide what day something happened on.

## The local Strava double, in one line

```sh
npm run fake:strava &
curl -s localhost:4010/_fake/webhook-deliveries | head
```

That delivery log is the one recorded during the July outage, duplicates
included. Post it at `/webhooks/strava` twice and the session count must not
move.

## Seed data

`npm run seed` builds three squads, sixteen athletes and around fifteen
months of training. All of it is invented: the names, the `.invalid` email
addresses, the dates of birth, the injuries and their notes. Do not replace
any of it with real athlete data.
