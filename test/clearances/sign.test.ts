import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../src/lib/clock.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/lib/errors.js';
import type { Actor } from '../../src/domain/authz.js';
import { revokeClearance, signClearance, SIGN_CLEARANCE_ACTION } from '../../src/domain/clearances/sign.js';
import type { Clearance, Injury } from '../../src/domain/clearances/types.js';

const SQUAD = 'squad-a';
const SIGNED_AT = '2026-05-20T11:30:00Z';
const clock = fixedClock(SIGNED_AT);

const physio: Actor = { userId: 'user-physio', grants: [{ squadId: SQUAD, role: 'physio' }] };
const headCoach: Actor = { userId: 'user-head', grants: [{ squadId: SQUAD, role: 'head_coach' }] };
const assistant: Actor = {
  userId: 'user-assistant',
  grants: [{ squadId: SQUAD, role: 'assistant_coach' }],
};
const otherSquadPhysio: Actor = {
  userId: 'user-physio-b',
  grants: [{ squadId: 'squad-b', role: 'physio' }],
};

const injury: Injury = {
  id: 'injury-1',
  athleteId: 'athlete-a',
  region: 'left achilles',
  onsetOn: '2026-05-01',
  severity: 5,
  notes: null,
  resolvedOn: null,
};

function standing(): Clearance {
  return {
    id: 'clearance-1',
    injuryId: 'injury-1',
    signedBy: 'user-physio',
    signedAt: new Date('2026-05-10T10:00:00Z'),
    revokedAt: null,
    notes: null,
    loadSnapshot: null,
  };
}

describe('signClearance', () => {
  const base = { injury, athleteSquadId: SQUAD, existing: [], packet: null };

  it('lets a physio sign, and stamps the clock', () => {
    const clearance = signClearance({ ...base, actor: physio, notes: 'pain free hopping' }, clock);
    expect(clearance.injuryId).toBe('injury-1');
    expect(clearance.signedBy).toBe('user-physio');
    expect(clearance.signedAt).toEqual(new Date(SIGNED_AT));
    expect(clearance.revokedAt).toBeNull();
    expect(clearance.notes).toBe('pain free hopping');
  });

  it('refuses an assistant coach and names the role they would need', () => {
    try {
      signClearance({ ...base, actor: assistant }, clock);
      expect.unreachable('an assistant coach must not be able to sign a clearance');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).requiredRole).toBe('physio');
      expect((err as ForbiddenError).action).toBe(SIGN_CLEARANCE_ACTION);
      expect((err as ForbiddenError).status).toBe(403);
      expect((err as ForbiddenError).message).toContain('physio');
    }
  });

  it('refuses the head coach of the athlete\'s own squad', () => {
    expect(() => signClearance({ ...base, actor: headCoach }, clock)).toThrow(ForbiddenError);
  });

  it('refuses a physio who does not cover this squad', () => {
    expect(() => signClearance({ ...base, actor: otherSquadPhysio }, clock)).toThrow(ForbiddenError);
  });

  it('refuses to clear an injury that is already resolved', () => {
    const resolved = { ...injury, resolvedOn: '2026-05-15' };
    expect(() => signClearance({ ...base, injury: resolved, actor: physio }, clock)).toThrow(ConflictError);
  });

  it('refuses a second clearance on top of a standing one', () => {
    expect(() => signClearance({ ...base, existing: [standing()], actor: physio }, clock)).toThrow(
      ConflictError,
    );
  });

  it('allows a new signature once the last one was withdrawn', () => {
    const withdrawn = { ...standing(), revokedAt: new Date('2026-05-12T10:00:00Z') };
    expect(() => signClearance({ ...base, existing: [withdrawn], actor: physio }, clock)).not.toThrow();
  });

  it('refuses an essay', () => {
    const notes = 'x'.repeat(2001);
    expect(() => signClearance({ ...base, actor: physio, notes }, clock)).toThrow(ValidationError);
  });

  it('keeps the packet it was handed', () => {
    const packet = {
      athleteId: 'athlete-a',
      asOf: '2026-05-20',
      days: [],
      totals: { runningLoad: 0, daysWithSleep: 0, meanSleepHours: null, peakPain: null },
    };
    const clearance = signClearance({ ...base, actor: physio, packet }, clock);
    expect(clearance.loadSnapshot).toEqual(packet);
  });
});

describe('revokeClearance', () => {
  it('lets a physio withdraw, and stamps the clock', () => {
    const revoked = revokeClearance(
      { clearance: standing(), athleteSquadId: SQUAD, actor: physio, reason: 'flared up again' },
      clock,
    );
    expect(revoked.revokedAt).toEqual(new Date(SIGNED_AT));
    expect(revoked.notes).toContain('withdrawn: flared up again');
  });

  it('refuses anybody who is not a physio here', () => {
    expect(() =>
      revokeClearance({ clearance: standing(), athleteSquadId: SQUAD, actor: headCoach }, clock),
    ).toThrow(ForbiddenError);
    expect(() =>
      revokeClearance({ clearance: standing(), athleteSquadId: SQUAD, actor: assistant }, clock),
    ).toThrow(ForbiddenError);
  });

  it('refuses to withdraw one twice', () => {
    const already = { ...standing(), revokedAt: new Date('2026-05-12T10:00:00Z') };
    expect(() =>
      revokeClearance({ clearance: already, athleteSquadId: SQUAD, actor: physio }, clock),
    ).toThrow(ConflictError);
  });

  it('leaves the notes alone when no reason is given', () => {
    const revoked = revokeClearance(
      { clearance: { ...standing(), notes: 'original' }, athleteSquadId: SQUAD, actor: physio },
      clock,
    );
    expect(revoked.notes).toBe('original');
  });
});
