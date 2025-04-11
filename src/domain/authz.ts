import { ForbiddenError } from '../lib/errors.js';

export type Role = 'head_coach' | 'assistant_coach' | 'physio' | 'athlete';

export const ROLES: readonly Role[] = ['head_coach', 'assistant_coach', 'physio', 'athlete'];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
