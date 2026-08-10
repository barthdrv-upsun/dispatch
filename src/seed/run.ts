import { closeDb, getDb } from '../db/client.js';
import {
  athletes,
  blockSlots,
  clearances,
  goals,
  hydrationLogs,
  injuries,
  plans,
  raceResults,
  sessions,
  shoes,
  sleepLogs,
  squads,
  stravaActivities,
  stravaLinks,
  trainingBlocks,
  userRoles,
  users,
  workoutTemplates,
} from '../db/schema.js';
import { buildSeedData } from './data.js';

/**
 * Wipes the tables this seed owns and refills them with the synthetic squads.
 * Development only - it truncates.
 */
export async function seed(): Promise<void> {
  const db = getDb();
  const data = buildSeedData(process.env.SEED_TODAY ?? undefined);

  await db.transaction(async (tx) => {
    await tx.delete(stravaActivities);
    await tx.delete(stravaLinks);
    await tx.delete(clearances);
    await tx.delete(injuries);
    await tx.delete(hydrationLogs);
    await tx.delete(sleepLogs);
    await tx.delete(sessions);
    await tx.delete(shoes);
    await tx.delete(plans);
    await tx.delete(blockSlots);
    await tx.delete(trainingBlocks);
    await tx.delete(workoutTemplates);
    await tx.delete(raceResults);
    await tx.delete(goals);
    await tx.delete(athletes);
    await tx.delete(userRoles);
    await tx.delete(users);
    await tx.delete(squads);

    await tx.insert(squads).values(data.squads);
    await tx.insert(users).values(data.users);
    await tx.insert(userRoles).values(data.userRoles);
    await tx.insert(athletes).values(data.athletes);
    await tx.insert(goals).values(data.goals);
    await tx.insert(raceResults).values(data.raceResults);
    await tx.insert(workoutTemplates).values(data.templates);
    await tx.insert(trainingBlocks).values(data.blocks);
    await tx.insert(blockSlots).values(data.blockSlots);
    await tx.insert(plans).values(data.plans);
    await tx.insert(shoes).values(data.shoes);
    for (const batch of chunk(data.sessions, 500)) {
      await tx.insert(sessions).values(batch);
    }
    for (const batch of chunk(data.sleepLogs, 500)) {
      await tx.insert(sleepLogs).values(batch);
    }
    for (const batch of chunk(data.hydrationLogs, 500)) {
      await tx.insert(hydrationLogs).values(batch);
    }
    await tx.insert(injuries).values(data.injuries);
    await tx.insert(clearances).values(data.clearances);
    await tx.insert(stravaLinks).values(data.stravaLinks);
  });

  console.log(
    `seeded ${String(data.squads.length)} squads, ${String(data.athletes.length)} athletes, ${String(data.sessions.length)} sessions (today = ${data.today})`,
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

seed().then(
  () => closeDb(),
  (err: unknown) => {
    console.error(err);
    return closeDb().then(() => process.exit(1));
  },
);
