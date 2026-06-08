import type { Clock } from '../../lib/clock.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { requireRoleInSquad, type Actor } from '../authz.js';
import { activeClearanceFor } from './gate.js';
import type { Clearance, ClearancePacket, Injury } from './types.js';

export const SIGN_CLEARANCE_ACTION = 'sign return-to-run clearance';
export const REVOKE_CLEARANCE_ACTION = 'revoke return-to-run clearance';

export type SignInput = {
  injury: Injury;
  athleteSquadId: string;
  actor: Actor;
  existing: readonly Clearance[];
  packet: ClearancePacket | null;
  notes?: string | null;
};

/**
 * The physio's signature. Injected clock so the signed_at stamp is something
 * a test can assert on.
 *
 * The role check runs first and on its own line: nothing about the injury or
 * the athlete is read before we know the caller is allowed to sign.
 */
export function signClearance(input: SignInput, clock: Clock): Omit<Clearance, 'id'> {
  requireRoleInSquad(input.actor, input.athleteSquadId, 'physio', SIGN_CLEARANCE_ACTION);

  if (input.injury.resolvedOn !== null) {
    throw new ConflictError('that injury is already resolved, there is nothing to clear');
  }
  if (activeClearanceFor(input.injury, input.existing) !== null) {
    throw new ConflictError('this injury already has a standing clearance');
  }
  const notes = input.notes ?? null;
  if (notes !== null && notes.length > 2000) {
    throw new ValidationError('clearance notes are limited to 2000 characters');
  }

  return {
    injuryId: input.injury.id,
    signedBy: input.actor.userId,
    signedAt: clock.now(),
    revokedAt: null,
    notes,
    loadSnapshot: input.packet,
  };
}

export type RevokeInput = {
  clearance: Clearance;
  athleteSquadId: string;
  actor: Actor;
  reason?: string | null;
};

/** Withdrawing a signature shuts the gate again straight away. */
export function revokeClearance(input: RevokeInput, clock: Clock): Clearance {
  requireRoleInSquad(input.actor, input.athleteSquadId, 'physio', REVOKE_CLEARANCE_ACTION);

  if (input.clearance.revokedAt !== null) {
    throw new ConflictError('that clearance has already been withdrawn');
  }
  const reason = input.reason ?? null;
  return {
    ...input.clearance,
    revokedAt: clock.now(),
    notes: reason === null ? input.clearance.notes : `${input.clearance.notes ?? ''}\nwithdrawn: ${reason}`.trim(),
  };
}
