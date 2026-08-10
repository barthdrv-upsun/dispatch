import { addLocalDays, athleteLocalDay, localWeekday, type LocalDate } from '../lib/time.js';
import { round2 } from '../lib/numbers.js';
import { sessionLoad } from '../domain/load/session_load.js';
import type { Prescription, TemplateKind } from '../domain/plans/types.js';
import { chance, floatBetween, intBetween, mulberry32, pick, type Rng } from './random.js';

/**
 * Synthetic squads for local development.
 *
 * Everything in here is invented: the names, the emails on the .invalid
 * domain, the dates of birth, the injuries and the notes attached to them.
 * None of it belongs to a real athlete and none of it should be replaced with
 * anything that does.
 */

const SQUAD_NAMES = [
  { name: 'Riverside Track Club', timezone: 'Europe/Berlin' },
  { name: 'Northgate Harriers', timezone: 'Europe/London' },
  { name: 'Southern Cross Runners', timezone: 'Pacific/Auckland' },
];

const ATHLETE_NAMES = [
  'Ama Boateng',
  'Bela Kovacs',
  'Corin Alvarez',
  'Dilan Kaya',
  'Esme Fournier',
  'Farid Nasser',
  'Greta Lindqvist',
  'Halina Wozniak',
  'Ines Duarte',
  'Jonty Whitfield',
  'Kaia Nurmi',
  'Leif Andersen',
  'Mira Solberg',
  'Nadia Haddad',
  'Oren Feldman',
  'Petra Novak',
];

const STAFF = [
  { name: 'Rowan Casteel', role: 'head_coach' as const, squadIndex: 0 },
  { name: 'Sunniva Berg', role: 'assistant_coach' as const, squadIndex: 0 },
  { name: 'Tomasz Wieczorek', role: 'head_coach' as const, squadIndex: 1 },
  { name: 'Uma Ferreira', role: 'assistant_coach' as const, squadIndex: 1 },
  { name: 'Viktor Halvorsen', role: 'head_coach' as const, squadIndex: 2 },
  { name: 'Wren Iremonger', role: 'assistant_coach' as const, squadIndex: 2 },
];

const PHYSIO = { name: 'Yasmin Okoro', email: 'yasmin.okoro@pacenote.invalid' };

const SHOE_MODELS = ['Meridian Glide 4', 'Fenwick Tempo 2', 'Kestrel Trail 7', 'Alto Racer 3'];

const INJURY_REGIONS = ['left achilles', 'right soleus', 'left ITB', 'right peroneal tendon'];

const INJURY_NOTES = [
  'Sore after the hill session, walks fine, hurts on push-off. Invented record.',
  'Reported tightness two days running. Synthetic seed data.',
  'Flagged during the Monday check-in, no swelling. Synthetic seed data.',
];

export type SeedIds = {
  squads: string[];
  users: string[];
  athletes: string[];
};

let counter = 0;

/** Deterministic, obviously-not-random UUIDs so the seed is reproducible. */
export function seedId(): string {
  counter += 1;
  const hex = counter.toString(16).padStart(12, '0');
  return `0000beef-0000-4000-8000-${hex}`;
}

export function resetSeedIds(): void {
  counter = 0;
}

export type SeedTemplate = {
  id: string;
  squadId: string;
  code: string;
  version: number;
  kind: TemplateKind;
  prescription: Prescription;
  loadFactor: string;
  supersededAt: Date | null;
};

const TEMPLATE_SPECS: Array<{
  code: string;
  kind: TemplateKind;
  loadFactor: number;
  prescription: Prescription;
}> = [
  {
    code: 'EASY-45',
    kind: 'easy',
    loadFactor: 1,
    prescription: { summary: '45 minutes conversational', durationS: 2700, targetEffort: 3 },
  },
  {
    code: 'EASY-70',
    kind: 'easy',
    loadFactor: 1,
    prescription: { summary: '70 minutes conversational', durationS: 4200, targetEffort: 3 },
  },
  {
    code: 'TEMPO-4X8',
    kind: 'tempo',
    loadFactor: 1.35,
    prescription: {
      summary: '4x8 minutes at threshold, 2 minutes float',
      durationS: 3600,
      reps: 4,
      recoveryS: 120,
      targetEffort: 7,
    },
  },
  {
    code: 'INT-12X400',
    kind: 'interval',
    loadFactor: 1.5,
    prescription: {
      summary: '12x400m at 3k effort, 90 seconds standing',
      durationS: 3300,
      reps: 12,
      repDistanceM: 400,
      recoveryS: 90,
      targetEffort: 8,
    },
  },
  {
    code: 'LONG-25K',
    kind: 'long',
    loadFactor: 1.2,
    prescription: { summary: '25km steady', distanceM: 25000, targetEffort: 5 },
  },
  {
    code: 'STRENGTH-A',
    kind: 'strength',
    loadFactor: 0.8,
    prescription: { summary: 'Lower body circuit, 45 minutes', durationS: 2700, targetEffort: 5 },
  },
  {
    code: 'BIKE-60',
    kind: 'cycling',
    loadFactor: 0.7,
    prescription: { summary: '60 minutes on the turbo, zone 2', durationS: 3600, targetEffort: 4 },
  },
  {
    code: 'SWIM-1500',
    kind: 'swimming',
    loadFactor: 0.6,
    prescription: { summary: '1500m mixed, pull buoy on the odds', distanceM: 1500, targetEffort: 4 },
  },
];

export type SeedData = {
  today: LocalDate;
  squads: Array<{ id: string; name: string; timezone: string; active: boolean }>;
  users: Array<{ id: string; name: string; email: string }>;
  userRoles: Array<{ userId: string; squadId: string; role: 'head_coach' | 'assistant_coach' | 'physio' | 'athlete' }>;
  athletes: Array<{
    id: string;
    squadId: string;
    userId: string;
    dateOfBirth: LocalDate;
    timezone: string;
    restingHr: number;
    maxHr: number;
    state: 'active' | 'injured' | 'returning';
  }>;
  templates: SeedTemplate[];
  blocks: Array<{
    id: string;
    squadId: string;
    name: string;
    version: number;
    weeks: number;
    state: 'draft' | 'published';
    publishedBy: string | null;
    publishedAt: Date | null;
  }>;
  blockSlots: Array<{ blockId: string; week: number; day: number; templateId: string; templateVersion: number }>;
  goals: Array<{
    id: string;
    athleteId: string;
    raceName: string;
    raceDate: LocalDate;
    distanceM: number;
    targetTimeS: number;
    state: 'planned' | 'active';
  }>;
  raceResults: Array<{
    id: string;
    athleteId: string;
    raceName: string;
    raceDate: LocalDate;
    distanceM: number;
    finishTimeS: number;
  }>;
  plans: Array<{
    id: string;
    athleteId: string;
    goalId: string;
    blockId: string;
    blockVersion: number;
    startsOn: LocalDate;
  }>;
  shoes: Array<{
    id: string;
    athleteId: string;
    model: string;
    purchasedOn: LocalDate;
    retireAtKm: string;
    currentKm: string;
    retiredAt: Date | null;
  }>;
  sessions: Array<{
    id: string;
    athleteId: string;
    planId: string | null;
    templateId: string | null;
    scheduledFor: Date | null;
    completedAt: Date;
    distanceM: number | null;
    durationS: number | null;
    avgHr: number | null;
    perceivedEffort: number | null;
    load: string | null;
    shoeId: string | null;
    source: 'manual' | 'strava';
  }>;
  sleepLogs: Array<{ athleteId: string; localDate: LocalDate; hours: string; quality: number }>;
  hydrationLogs: Array<{ athleteId: string; localDate: LocalDate; litres: string }>;
  injuries: Array<{
    id: string;
    athleteId: string;
    region: string;
    onsetOn: LocalDate;
    severity: number;
    notes: string;
    resolvedOn: LocalDate | null;
  }>;
  clearances: Array<{
    id: string;
    injuryId: string;
    signedBy: string;
    signedAt: Date;
    revokedAt: Date | null;
    notes: string;
  }>;
  stravaLinks: Array<{
    athleteId: string;
    stravaAthleteId: number;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string;
  }>;
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, '.');
}

function instantAt(day: LocalDate, hour: number, minute: number): Date {
  return new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
}

const RUNNING_CODES = ['EASY-45', 'EASY-70', 'TEMPO-4X8', 'INT-12X400', 'LONG-25K'];
const CROSS_CODES = ['STRENGTH-A', 'BIKE-60', 'SWIM-1500'];

const HISTORY_DAYS = 460;
const WELLNESS_DAYS = 120;

/**
 * Builds the whole synthetic world. `today` defaults to the real today so
 * that the goal races stay in the future; set SEED_TODAY to pin it.
 */
export function buildSeedData(today: LocalDate = athleteLocalDay(new Date(), 'UTC')): SeedData {
  resetSeedIds();
  const rng = mulberry32(20260501);

  const data: SeedData = {
    today,
    squads: [],
    users: [],
    userRoles: [],
    athletes: [],
    templates: [],
    blocks: [],
    blockSlots: [],
    goals: [],
    raceResults: [],
    plans: [],
    shoes: [],
    sessions: [],
    sleepLogs: [],
    hydrationLogs: [],
    injuries: [],
    clearances: [],
    stravaLinks: [],
  };

  for (const spec of SQUAD_NAMES) {
    data.squads.push({ id: seedId(), name: spec.name, timezone: spec.timezone, active: true });
  }

  for (const member of STAFF) {
    const squad = data.squads[member.squadIndex];
    if (!squad) {
      continue;
    }
    const id = seedId();
    data.users.push({ id, name: member.name, email: `${slug(member.name)}@pacenote.invalid` });
    data.userRoles.push({ userId: id, squadId: squad.id, role: member.role });
  }

  /** One physio, covering all three squads - which is what "across squads" means. */
  const physioId = seedId();
  data.users.push({ id: physioId, name: PHYSIO.name, email: PHYSIO.email });
  for (const squad of data.squads) {
    data.userRoles.push({ userId: physioId, squadId: squad.id, role: 'physio' });
  }

  for (const squad of data.squads) {
    for (const spec of TEMPLATE_SPECS) {
      data.templates.push({
        id: seedId(),
        squadId: squad.id,
        code: spec.code,
        version: 1,
        kind: spec.kind,
        prescription: spec.prescription,
        loadFactor: spec.loadFactor.toFixed(2),
        supersededAt: null,
      });
    }
  }

  const headCoachFor = (squadId: string): string => {
    const grant = data.userRoles.find((role) => role.squadId === squadId && role.role === 'head_coach');
    return grant ? grant.userId : physioId;
  };

  const publishedAt = instantAt(addLocalDays(today, -70), 9, 15);
  for (const squad of data.squads) {
    const blockId = seedId();
    data.blocks.push({
      id: blockId,
      squadId: squad.id,
      name: 'Autumn base',
      version: 1,
      weeks: 12,
      state: 'published',
      publishedBy: headCoachFor(squad.id),
      publishedAt,
    });
    const squadTemplates = data.templates.filter((template) => template.squadId === squad.id);
    const byCode = new Map(squadTemplates.map((template) => [template.code, template]));
    const week = [
      'EASY-45',
      'TEMPO-4X8',
      'EASY-45',
      'INT-12X400',
      'EASY-70',
      'LONG-25K',
      'STRENGTH-A',
    ];
    for (let w = 1; w <= 12; w += 1) {
      for (let d = 1; d <= 7; d += 1) {
        const code = week[d - 1];
        if (!code || (d === 4 && w % 4 === 0)) {
          continue;
        }
        const template = byCode.get(code);
        if (!template) {
          continue;
        }
        data.blockSlots.push({
          blockId,
          week: w,
          day: d,
          templateId: template.id,
          templateVersion: template.version,
        });
      }
    }
  }

  const planStart = (() => {
    let day = addLocalDays(today, -56);
    while (localWeekday(day) !== 1) {
      day = addLocalDays(day, 1);
    }
    return day;
  })();

  ATHLETE_NAMES.forEach((name, index) => {
    const squad = data.squads[index % data.squads.length];
    if (!squad) {
      return;
    }
    const userId = seedId();
    const athleteId = seedId();
    data.users.push({ id: userId, name, email: `${slug(name)}@runners.invalid` });
    data.userRoles.push({ userId, squadId: squad.id, role: 'athlete' });

    const state = index === 0 ? 'injured' : index === 1 ? 'returning' : 'active';
    const restingHr = intBetween(rng, 38, 58);
    const athlete = {
      id: athleteId,
      squadId: squad.id,
      userId,
      dateOfBirth: `${String(intBetween(rng, 1986, 2004))}-${String(intBetween(rng, 1, 12)).padStart(2, '0')}-${String(intBetween(rng, 1, 28)).padStart(2, '0')}`,
      timezone: squad.timezone,
      restingHr,
      maxHr: restingHr + intBetween(rng, 130, 160),
      state: state as 'active' | 'injured' | 'returning',
    };
    data.athletes.push(athlete);

    const raceDate = addLocalDays(today, intBetween(rng, 70, 112));
    const goalId = seedId();
    const distanceM = pick(rng, [10000, 21097, 42195]);
    data.goals.push({
      id: goalId,
      athleteId,
      raceName: pick(rng, ['Harbour Half', 'Vineyard Marathon', 'Old Mill 10k', 'Lakeside Half']),
      raceDate,
      distanceM,
      targetTimeS: Math.round((distanceM / 1000) * intBetween(rng, 195, 300)),
      state: 'active',
    });

    for (let past = 0; past < intBetween(rng, 2, 3); past += 1) {
      const pastDistance = pick(rng, [5000, 10000, 21097]);
      data.raceResults.push({
        id: seedId(),
        athleteId,
        raceName: pick(rng, ['Winter Series 5k', 'Spring Half', 'Riverside 10k', 'Coastal Half']),
        raceDate: addLocalDays(today, -intBetween(rng, 60, 400)),
        distanceM: pastDistance,
        finishTimeS: Math.round((pastDistance / 1000) * intBetween(rng, 200, 320)),
      });
    }

    const block = data.blocks.find((candidate) => candidate.squadId === squad.id);
    if (block) {
      data.plans.push({
        id: seedId(),
        athleteId,
        goalId,
        blockId: block.id,
        blockVersion: block.version,
        startsOn: planStart,
      });
    }

    // One pair well past its threshold and not yet stamped, so R7 has
    // something to refuse.
    const wornOut = index === 2;
    const dailyShoe = {
      id: seedId(),
      athleteId,
      model: pick(rng, SHOE_MODELS),
      purchasedOn: addLocalDays(today, -intBetween(rng, 200, 400)),
      retireAtKm: '800.00',
      currentKm: wornOut ? '842.40' : floatBetween(rng, 120, 620).toFixed(2),
      retiredAt: null,
    };
    const raceShoe = {
      id: seedId(),
      athleteId,
      model: 'Alto Racer 3',
      purchasedOn: addLocalDays(today, -intBetween(rng, 30, 180)),
      retireAtKm: '400.00',
      currentKm: floatBetween(rng, 20, 260).toFixed(2),
      retiredAt: null,
    };
    data.shoes.push(dailyShoe, raceShoe);

    seedTraining(data, rng, athlete, dailyShoe.id, today);
  });

  seedInjuries(data, rng, physioId, today);
  seedStravaLinks(data, today);

  return data;
}

function seedTraining(
  data: SeedData,
  rng: Rng,
  athlete: SeedData['athletes'][number],
  shoeId: string,
  today: LocalDate,
): void {
  const squadTemplates = data.templates.filter((template) => template.squadId === athlete.squadId);
  const byCode = new Map(squadTemplates.map((template) => [template.code, template]));
  const plan = data.plans.find((candidate) => candidate.athleteId === athlete.id);
  /** The injured athlete stops running when the injury lands. */
  const stopRunningFrom = athlete.state === 'injured' ? addLocalDays(today, -12) : null;

  for (let back = HISTORY_DAYS; back >= 0; back -= 1) {
    const day = addLocalDays(today, -back);
    const weekday = localWeekday(day);
    if (weekday === 3 && chance(rng, 0.75)) {
      continue;
    }
    if (chance(rng, 0.08)) {
      continue;
    }

    const injured = stopRunningFrom !== null && day >= stopRunningFrom;
    const code = injured
      ? pick(rng, CROSS_CODES)
      : chance(rng, 0.18)
        ? pick(rng, CROSS_CODES)
        : weekday === 6
          ? 'LONG-25K'
          : pick(rng, RUNNING_CODES);
    const template = byCode.get(code);
    if (!template) {
      continue;
    }

    const running = ['easy', 'tempo', 'interval', 'long'].includes(template.kind);
    const durationS = running
      ? intBetween(rng, code === 'LONG-25K' ? 5400 : 2100, code === 'LONG-25K' ? 9000 : 4500)
      : intBetween(rng, 1800, 3600);
    const distanceM = running ? Math.round((durationS / 60) * floatBetween(rng, 175, 235)) : null;
    const perceivedEffort =
      template.kind === 'interval' ? intBetween(rng, 7, 9) : template.kind === 'tempo' ? intBetween(rng, 6, 8) : intBetween(rng, 2, 5);
    const avgHr = Math.round(athlete.restingHr + (athlete.maxHr - athlete.restingHr) * floatBetween(rng, 0.55, 0.88));
    const hour = intBetween(rng, 5, 20);
    const completedAt = instantAt(day, hour, intBetween(rng, 0, 59));
    const load = sessionLoad({ durationS, distanceM, avgHr, perceivedEffort });

    data.sessions.push({
      id: seedId(),
      athleteId: athlete.id,
      planId: plan && day >= plan.startsOn ? plan.id : null,
      templateId: template.id,
      scheduledFor: plan && day >= plan.startsOn ? instantAt(day, 7, 0) : null,
      completedAt,
      distanceM,
      durationS,
      avgHr,
      perceivedEffort,
      load: load === null ? null : load.toFixed(2),
      shoeId: running ? shoeId : null,
      source: chance(rng, 0.35) ? 'strava' : 'manual',
    });

    if (back < WELLNESS_DAYS) {
      data.sleepLogs.push({
        athleteId: athlete.id,
        localDate: day,
        hours: floatBetween(rng, 5.4, 9.1).toFixed(2),
        quality: intBetween(rng, 2, 5),
      });
      if (chance(rng, 0.8)) {
        data.hydrationLogs.push({
          athleteId: athlete.id,
          localDate: day,
          litres: floatBetween(rng, 1.2, 4.1).toFixed(2),
        });
      }
    }
  }
}

/**
 * One athlete injured with nothing signed, one back running on a standing
 * clearance, and one old injury that was resolved months ago.
 */
function seedInjuries(data: SeedData, rng: Rng, physioId: string, today: LocalDate): void {
  const injured = data.athletes[0];
  const returning = data.athletes[1];
  const other = data.athletes[4];

  if (injured) {
    data.injuries.push({
      id: seedId(),
      athleteId: injured.id,
      region: pick(rng, INJURY_REGIONS),
      onsetOn: addLocalDays(today, -12),
      severity: 6,
      notes: INJURY_NOTES[0] ?? 'Synthetic seed data.',
      resolvedOn: null,
    });
  }

  if (returning) {
    const injuryId = seedId();
    data.injuries.push({
      id: injuryId,
      athleteId: returning.id,
      region: pick(rng, INJURY_REGIONS),
      onsetOn: addLocalDays(today, -48),
      severity: 4,
      notes: INJURY_NOTES[1] ?? 'Synthetic seed data.',
      resolvedOn: null,
    });
    data.clearances.push({
      id: seedId(),
      injuryId,
      signedBy: physioId,
      signedAt: instantAt(addLocalDays(today, -9), 11, 30),
      revokedAt: null,
      notes: 'Pain-free walking and hopping, cleared for 20 minutes easy every other day.',
    });
  }

  if (other) {
    data.injuries.push({
      id: seedId(),
      athleteId: other.id,
      region: pick(rng, INJURY_REGIONS),
      onsetOn: addLocalDays(today, -300),
      severity: 3,
      notes: INJURY_NOTES[2] ?? 'Synthetic seed data.',
      resolvedOn: addLocalDays(today, -270),
    });
  }
}

/**
 * Links the first two athletes to the two athlete ids the local Strava double
 * answers for, so `npm run seed` leaves a working sync path behind.
 */
function seedStravaLinks(data: SeedData, today: LocalDate): void {
  const pairs = [
    { index: 0, stravaAthleteId: 7311001 },
    { index: 1, stravaAthleteId: 7311002 },
  ];
  for (const pair of pairs) {
    const athlete = data.athletes[pair.index];
    if (!athlete) {
      continue;
    }
    data.stravaLinks.push({
      athleteId: athlete.id,
      stravaAthleteId: pair.stravaAthleteId,
      accessToken: `local-access-${String(pair.stravaAthleteId)}`,
      refreshToken: `local-refresh-${String(pair.stravaAthleteId)}`,
      expiresAt: instantAt(addLocalDays(today, 1), 12, 0),
      scope: 'read,activity:read_all',
    });
  }
}
