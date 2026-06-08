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

/**
 * R4. An injured athlete may not be prescribed or credited a running session
 * until a physio has signed off the open injury and not withdrawn it.
 *
 * `returning` is the state an athlete sits in after the signature: they are
 * running again, so the gate is open, but the injury is still on their record
 * until a physio resolves it.
 */
export function assessReturnToRun(input: GateInput): ReturnToRunDecision {
  if (input.state === 'active') {
    return { allowed: true, reason: 'athlete is active', blockingInjuryIds: [] };
  }

  const open = openInjuries(input.injuries, input.asOf);

  if (input.state === 'returning') {
    const unsigned = open.filter(
      (injury) => activeClearanceFor(injury, input.clearances, input.isPhysio) === null,
    );
    if (unsigned.length > 0) {
      return {
        allowed: false,
        reason: 'return-to-run clearance was withdrawn or never signed',
        blockingInjuryIds: unsigned.map((injury) => injury.id),
      };
    }
    return { allowed: true, reason: 'clearance signed and standing', blockingInjuryIds: [] };
  }

  if (open.length === 0) {
    return {
      allowed: false,
      reason: 'athlete is marked injured but has no open injury on record',
      blockingInjuryIds: [],
    };
  }

  const blocking = open.filter(
    (injury) => activeClearanceFor(injury, input.clearances, input.isPhysio) === null,
  );
  if (blocking.length > 0) {
    return {
      allowed: false,
      reason: 'no standing return-to-run clearance signed by a physio',
      blockingInjuryIds: blocking.map((injury) => injury.id),
    };
  }
  return { allowed: true, reason: 'clearance signed and standing', blockingInjuryIds: [] };
}
