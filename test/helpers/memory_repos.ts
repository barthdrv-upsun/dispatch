import type { Athlete, Squad } from '../../src/domain/athletes/types.js';
import type { RoleGrant } from '../../src/domain/authz.js';
import type { SessionForLoad } from '../../src/domain/load/entries.js';
import type {
  BlockSlotRow,
  ClearanceRow,
  GoalRow,
  HydrationLogRow,
  InjuryRow,
  NewSessionRow,
  PlanRow,
  Repositories,
  ShoeRow,
  SleepLogRow,
  TrainingBlockRow,
  WorkoutTemplateRow,
} from '../../src/ports/index.js';
import { toNumber } from '../../src/lib/numbers.js';

export type MemoryWorld = {
  squads: Squad[];
  users: Array<{ id: string; name: string }>;
  grants: Array<{ userId: string } & RoleGrant>;
  athletes: Athlete[];
  sessions: Array<NewSessionRow & { id: string }>;
  templates: WorkoutTemplateRow[];
  blocks: TrainingBlockRow[];
  slots: BlockSlotRow[];
  plans: PlanRow[];
  goals: GoalRow[];
  injuries: InjuryRow[];
  clearances: ClearanceRow[];
  sleep: SleepLogRow[];
  hydration: HydrationLogRow[];
  shoes: ShoeRow[];
};

export function emptyWorld(): MemoryWorld {
  return {
    squads: [],
    users: [],
    grants: [],
    athletes: [],
    sessions: [],
    templates: [],
    blocks: [],
    slots: [],
    plans: [],
    goals: [],
    injuries: [],
    clearances: [],
    sleep: [],
    hydration: [],
    shoes: [],
  };
}

let ids = 0;

export function nextId(prefix = 'id'): string {
  ids += 1;
  return `${prefix}-${String(ids).padStart(4, '0')}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * The ports, backed by arrays. Same contract as the Drizzle implementations,
 * including the bit where numerics come back as strings.
 */
export function memoryRepositories(world: MemoryWorld): Repositories {
  return {
    users: {
      async grantsFor(userId) {
        return world.grants
          .filter((grant) => grant.userId === userId)
          .map((grant) => ({ squadId: grant.squadId, role: grant.role }));
      },
      async athleteIdFor(userId) {
        return world.athletes.find((athlete) => athlete.userId === userId)?.id ?? null;
      },
      async physioUserIds(squadId) {
        return world.grants
          .filter((grant) => grant.squadId === squadId && grant.role === 'physio')
          .map((grant) => grant.userId);
      },
    },

    squads: {
      async byId(squadId) {
        return clone(world.squads.find((squad) => squad.id === squadId) ?? null);
      },
    },

    athletes: {
      async byId(athleteId) {
        return clone(world.athletes.find((athlete) => athlete.id === athleteId) ?? null);
      },
      async bySquad(squadId) {
        return clone(world.athletes.filter((athlete) => athlete.squadId === squadId));
      },
      async save(athlete) {
        const index = world.athletes.findIndex((candidate) => candidate.id === athlete.id);
        if (index >= 0) {
          world.athletes[index] = clone(athlete);
        }
      },
    },

    sessions: {
      async insert(session) {
        const id = nextId('session');
        world.sessions.push({ ...session, id });
        return id;
      },
      async forAthleteFrom(athleteId, from): Promise<SessionForLoad[]> {
        return world.sessions
          .filter((session) => session.athleteId === athleteId)
          .filter((session) => session.completedAt.getTime() >= from.getTime())
          .map((session) => ({
            completedAt: session.completedAt,
            load: session.load,
            distanceM: session.distanceM,
            templateKind:
              world.templates.find((template) => template.id === session.templateId)?.kind ?? null,
          }));
      },
    },

    templates: {
      async byId(templateId) {
        return clone(world.templates.find((template) => template.id === templateId) ?? null);
      },
      async bySquad(squadId) {
        return clone(world.templates.filter((template) => template.squadId === squadId));
      },
      async insert(template) {
        const id = nextId('template');
        world.templates.push({ ...clone(template), id });
        return id;
      },
      async markSuperseded(templateId, at) {
        const template = world.templates.find((candidate) => candidate.id === templateId);
        if (template) {
          template.supersededAt = at;
        }
      },
    },

    blocks: {
      async byId(blockId) {
        return clone(world.blocks.find((block) => block.id === blockId) ?? null);
      },
      async bySquad(squadId) {
        return clone(world.blocks.filter((block) => block.squadId === squadId));
      },
      async slotsFor(blockId) {
        return clone(
          world.slots
            .filter((slot) => slot.blockId === blockId)
            .sort((a, b) => (a.week === b.week ? a.day - b.day : a.week - b.week)),
        );
      },
      async insert(block) {
        const id = nextId('block');
        world.blocks.push({ ...clone(block), id });
        return id;
      },
      async save(block) {
        const index = world.blocks.findIndex((candidate) => candidate.id === block.id);
        if (index >= 0) {
          world.blocks[index] = clone(block);
        }
      },
      async putSlot(slot) {
        const index = world.slots.findIndex(
          (candidate) =>
            candidate.blockId === slot.blockId &&
            candidate.week === slot.week &&
            candidate.day === slot.day,
        );
        if (index >= 0) {
          world.slots[index] = clone(slot);
        } else {
          world.slots.push(clone(slot));
        }
      },
      async putSlots(slots) {
        for (const slot of slots) {
          world.slots.push(clone(slot));
        }
      },
    },

    plans: {
      async insert(plan) {
        const id = nextId('plan');
        world.plans.push({ ...clone(plan), id });
        return id;
      },
      async byId(planId) {
        return clone(world.plans.find((plan) => plan.id === planId) ?? null);
      },
      async forAthlete(athleteId) {
        return clone(world.plans.filter((plan) => plan.athleteId === athleteId));
      },
    },

    goals: {
      async byId(goalId) {
        return clone(world.goals.find((goal) => goal.id === goalId) ?? null);
      },
      async forAthlete(athleteId) {
        return clone(world.goals.filter((goal) => goal.athleteId === athleteId));
      },
    },

    injuries: {
      async byId(injuryId) {
        return clone(world.injuries.find((injury) => injury.id === injuryId) ?? null);
      },
      async forAthlete(athleteId) {
        return clone(world.injuries.filter((injury) => injury.athleteId === athleteId));
      },
      async clearancesForAthlete(athleteId) {
        const theirs = new Set(
          world.injuries.filter((injury) => injury.athleteId === athleteId).map((injury) => injury.id),
        );
        return clone(world.clearances.filter((clearance) => theirs.has(clearance.injuryId)));
      },
      async clearanceById(clearanceId) {
        return clone(world.clearances.find((clearance) => clearance.id === clearanceId) ?? null);
      },
      async insertClearance(clearance) {
        const id = nextId('clearance');
        world.clearances.push({ ...clone(clearance), id });
        return id;
      },
      async saveClearance(clearance) {
        const index = world.clearances.findIndex((candidate) => candidate.id === clearance.id);
        if (index >= 0) {
          world.clearances[index] = clone(clearance);
        }
      },
    },

    wellness: {
      async sleepFrom(athleteId, from) {
        return clone(
          world.sleep
            .filter((log) => log.athleteId === athleteId && log.localDate >= from)
            .sort((a, b) => (a.localDate < b.localDate ? -1 : 1)),
        );
      },
      async putSleep(log) {
        const index = world.sleep.findIndex(
          (candidate) => candidate.athleteId === log.athleteId && candidate.localDate === log.localDate,
        );
        if (index >= 0) {
          world.sleep[index] = clone(log);
        } else {
          world.sleep.push(clone(log));
        }
      },
      async putHydration(log) {
        const index = world.hydration.findIndex(
          (candidate) => candidate.athleteId === log.athleteId && candidate.localDate === log.localDate,
        );
        if (index >= 0) {
          world.hydration[index] = clone(log);
        } else {
          world.hydration.push(clone(log));
        }
      },
    },

    dashboard: {
      async athletesForDashboard(squadId) {
        return world.athletes
          .filter((athlete) => athlete.squadId === squadId)
          .map((athlete) => ({
            athlete,
            link: null,
            openInjury: null,
          }));
      },
      async recentSessions(athleteId, since) {
        return world.sessions
          .filter((session) => session.athleteId === athleteId)
          .filter((session) => session.completedAt.getTime() >= since.getTime())
          .map((session) => ({
            completedAt: session.completedAt,
            load: session.load,
            distanceM: session.distanceM,
          }));
      },
    },

    shoes: {
      async byId(shoeId) {
        return clone(world.shoes.find((shoe) => shoe.id === shoeId) ?? null);
      },
      async forAthlete(athleteId) {
        return clone(world.shoes.filter((shoe) => shoe.athleteId === athleteId));
      },
      async insert(shoe) {
        const id = nextId('shoe');
        world.shoes.push({ ...clone(shoe), id });
        return id;
      },
      async save(shoe) {
        const index = world.shoes.findIndex((candidate) => candidate.id === shoe.id);
        if (index >= 0) {
          world.shoes[index] = clone(shoe);
        }
      },
    },
  };
}

export function totalKm(row: ShoeRow): number {
  return toNumber(row.currentKm);
}
