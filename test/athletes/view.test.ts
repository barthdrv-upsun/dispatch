import { describe, expect, it } from 'vitest';
import { athleteSummaries, athleteSummary } from '../../src/domain/athletes/view.js';
import type { Athlete } from '../../src/domain/athletes/types.js';

const athlete: Athlete = {
  id: 'athlete-a',
  squadId: 'squad-a',
  userId: 'user-athlete-a',
  dateOfBirth: '1994-06-20',
  timezone: 'Europe/Berlin',
  restingHr: 48,
  maxHr: 192,
  state: 'active',
};

describe('athleteSummary', () => {
  it('keeps what a coach needs', () => {
    expect(athleteSummary(athlete)).toEqual({
      id: 'athlete-a',
      squadId: 'squad-a',
      timezone: 'Europe/Berlin',
      state: 'active',
      restingHr: 48,
      maxHr: 192,
    });
  });

  it('does not carry the date of birth out of the server', () => {
    const summary = athleteSummary(athlete) as Record<string, unknown>;
    expect(summary['dateOfBirth']).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain('1994');
  });

  it('does not carry the user id either', () => {
    expect((athleteSummary(athlete) as Record<string, unknown>)['userId']).toBeUndefined();
  });

  it('maps a roster', () => {
    expect(athleteSummaries([athlete, { ...athlete, id: 'athlete-b' }]).map((a) => a.id)).toEqual([
      'athlete-a',
      'athlete-b',
    ]);
  });
});
