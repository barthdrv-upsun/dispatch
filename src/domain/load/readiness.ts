import type { LocalDate } from '../../lib/time.js';
import type { LoadEntry, RunningKind, VolumeEntry } from './entries.js';
import { assessRamp, type RampVerdict } from './ramp.js';
import { assessRatio, downgradeForRatio, type KindDecision, type RatioVerdict } from './ratio.js';
import { assessRest, type RestVerdict } from './rest.js';
import { assessTaper, type TaperVerdict } from './taper.js';
import {
  ACUTE_DAYS,
  CHRONIC_DAYS,
  computeAcuteLoad,
  computeChronicLoad,
  rollingWindow,
} from './windows.js';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R8';

export type RuleFinding = {
  rule: RuleId;
  ok: boolean;
  detail: string;
};

export type ReadinessInput = {
  asOf: LocalDate;
  loadEntries: readonly LoadEntry[];
  volumeEntries: readonly VolumeEntry[];
  raceDate?: LocalDate | null;
};

export type Readiness = {
  asOf: LocalDate;
  ratio: RatioVerdict;
  ramp: RampVerdict;
  rest: RestVerdict;
  taper: TaperVerdict;
  findings: RuleFinding[];
  ok: boolean;
};

// @P:m09.A

/**
 * Everything the load rules have to say about one athlete on one day.
 *
 * Nothing here refuses a session on its own - R4 is the only rule that does
 * that, and it lives with the clearances. This is the input a coach argues
 * with.
 */
export function assessReadiness(input: ReadinessInput): Readiness {
  const acuteLoad = computeAcuteLoad(input.loadEntries, rollingWindow(input.asOf, ACUTE_DAYS));
  const chronicLoad = computeChronicLoad(
    input.loadEntries,
    rollingWindow(input.asOf, CHRONIC_DAYS),
  );

  const ratio = assessRatio(acuteLoad, chronicLoad);
  const ramp = assessRamp(input.volumeEntries, input.asOf);
  const rest = assessRest(input.loadEntries, input.asOf);
  const taper = assessTaper(input.volumeEntries, input.asOf, input.raceDate ?? null);

  const findings: RuleFinding[] = [
    {
      rule: 'R1',
      ok: ratio.withinBounds,
      detail:
        ratio.position === 'unknown'
          ? 'no chronic load to compare against yet'
          : `acute ${ratio.acuteLoad} against chronic ${ratio.chronicLoad} gives ${ratio.ratio}`,
    },
    {
      rule: 'R2',
      ok: ramp.withinCap,
      detail: `${Math.round(ramp.currentM / 100) / 10}km against ${Math.round(ramp.previousM / 100) / 10}km the week before`,
    },
    {
      rule: 'R3',
      ok: rest.compliant,
      detail: rest.compliant
        ? `rest days in window: ${rest.restDays.join(', ')}`
        : 'no rest day in the last seven',
    },
    {
      rule: 'R8',
      ok: taper.compliant,
      detail: taper.inTaper
        ? `${String(taper.daysToRace)} days to the race, ${taper.currentM}m against ${taper.previousM}m`
        : 'not inside the taper window',
    },
  ];

  return {
    asOf: input.asOf,
    ratio,
    ramp,
    rest,
    taper,
    findings,
    ok: findings.every((finding) => finding.ok),
  };
}

// @P:m09.A

/**
 * What the athlete should actually be given, once R1 has had its say about
 * what the coach asked for.
 */
export function prescribeKind(requested: RunningKind, readiness: Readiness): KindDecision {
  return downgradeForRatio(requested, readiness.ratio);
}

export function brokenRules(readiness: Readiness): RuleId[] {
  return readiness.findings.filter((finding) => !finding.ok).map((finding) => finding.rule);
}
