import { ForbiddenError } from '../lib/errors.js';

export type Role = 'head_coach' | 'assistant_coach' | 'physio' | 'athlete';

export const ROLES: readonly Role[] = ['head_coach', 'assistant_coach', 'physio', 'athlete'];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** One row of user_roles. A user can hold several, in several squads. */
export type RoleGrant = {
  squadId: string;
  role: Role;
};

/**
 * Who is asking. Assembled once per request from user_roles and never
 * inferred from anything the caller sends beyond their identity.
 */
export type Actor = {
  userId: string;
  grants: readonly RoleGrant[];
  /** Set when the caller is themselves an athlete in one of these squads. */
  athleteId?: string | null;
};

export function hasRoleInSquad(actor: Actor, squadId: string, role: Role): boolean {
  return actor.grants.some((grant) => grant.squadId === squadId && grant.role === role);
}

export function hasRoleAnywhere(actor: Actor, role: Role): boolean {
  return actor.grants.some((grant) => grant.role === role);
}

export function squadsWithRole(actor: Actor, role: Role): string[] {
  return actor.grants.filter((grant) => grant.role === role).map((grant) => grant.squadId);
}

export function isSelf(actor: Actor, athleteId: string): boolean {
  return actor.athleteId !== null && actor.athleteId !== undefined && actor.athleteId === athleteId;
}
