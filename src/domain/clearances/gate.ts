import type { LocalDate } from '../../lib/time.js';
import type { AthleteState, Clearance, Injury } from './types.js';

export type ReturnToRunDecision = {
  allowed: boolean;
  reason: string;
  blockingInjuryIds: string[];
};

export type GateInput = {
  state: AthleteState;
  injuries: readonly Injury[];
  clearances: readonly Clearance[];
  asOf: LocalDate;
  /**
   * Optional second look at who signed. When it is supplied, a clearance
   * signed by somebody who is not a physio does not count, whatever the row
   * says.
   */
  isPhysio?: (userId: string) => boolean;
};

export function openInjuries(injuries: readonly Injury[], asOf: LocalDate): Injury[] {
  return injuries.filter(
    (injury) => injury.onsetOn <= asOf && (injury.resolvedOn === null || injury.resolvedOn > asOf),
  );
}

export function activeClearanceFor(
  injury: Injury,
  clearances: readonly Clearance[],
  isPhysio?: (userId: string) => boolean,
): Clearance | null {
  const live = clearances
    .filter((clearance) => clearance.injuryId === injury.id)
    .filter((clearance) => clearance.revokedAt === null)
    .filter((clearance) => (isPhysio ? isPhysio(clearance.signedBy) : true))
    .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());
  return live[0] ?? null;
}
