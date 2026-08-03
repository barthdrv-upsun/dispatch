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
