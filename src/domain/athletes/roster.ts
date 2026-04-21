import { ForbiddenError } from '../../lib/errors.js';
import { hasRoleInSquad, isSelf, type Actor } from '../authz.js';
import type { Athlete } from './types.js';

/**
 * Every read of a roster is scoped to one squad, and the squad comes from the
 * caller's grants rather than from the request. A coach in squad A has no
 * query that can reach squad B's athletes.
 */
export function rosterFor(athletes: readonly Athlete[], squadId: string): Athlete[] {
  return athletes
    .filter((athlete) => athlete.squadId === squadId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function visibleSquadIds(actor: Actor): string[] {
  const squads = new Set<string>();
  for (const grant of actor.grants) {
    if (grant.role === 'head_coach' || grant.role === 'assistant_coach' || grant.role === 'physio') {
      squads.add(grant.squadId);
    }
  }
  return [...squads];
}

export function assertCanReadAthlete(actor: Actor, athlete: Athlete, action: string): void {
  if (isSelf(actor, athlete.id)) {
    return;
  }
  const squadId = athlete.squadId;
  if (
    hasRoleInSquad(actor, squadId, 'head_coach') ||
    hasRoleInSquad(actor, squadId, 'assistant_coach') ||
    hasRoleInSquad(actor, squadId, 'physio')
  ) {
    return;
  }
  throw new ForbiddenError(action, 'head_coach');
}
