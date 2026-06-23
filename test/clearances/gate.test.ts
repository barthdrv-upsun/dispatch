import { describe, expect, it } from 'vitest';
import { activeClearanceFor, assessReturnToRun, openInjuries } from '../../src/domain/clearances/gate.js';
import type { Clearance, Injury } from '../../src/domain/clearances/types.js';

const ASOF = '2026-05-20';
const PHYSIO = 'user-physio';

function injury(overrides: Partial<Injury> = {}): Injury {
  return {
    id: 'injury-1',
    athleteId: 'athlete-a',
    region: 'left achilles',
    onsetOn: '2026-05-01',
    severity: 5,
    notes: null,
    resolvedOn: null,
    ...overrides,
  };
}

function clearance(overrides: Partial<Clearance> = {}): Clearance {
  return {
    id: 'clearance-1',
    injuryId: 'injury-1',
    signedBy: PHYSIO,
    signedAt: new Date('2026-05-18T10:00:00Z'),
    revokedAt: null,
    notes: null,
    loadSnapshot: null,
    ...overrides,
  };
}

describe('openInjuries', () => {
  it('finds an injury with no resolution date', () => {
    expect(openInjuries([injury()], ASOF)).toHaveLength(1);
  });

  it('ignores one resolved before the day asked about', () => {
    expect(openInjuries([injury({ resolvedOn: '2026-05-10' })], ASOF)).toHaveLength(0);
  });

  it('still counts one resolved after the day asked about', () => {
    expect(openInjuries([injury({ resolvedOn: '2026-05-25' })], ASOF)).toHaveLength(1);
  });

  it('ignores one that has not started yet', () => {
    expect(openInjuries([injury({ onsetOn: '2026-06-01' })], ASOF)).toHaveLength(0);
  });
});

describe('activeClearanceFor', () => {
  it('finds a standing clearance', () => {
    expect(activeClearanceFor(injury(), [clearance()])?.id).toBe('clearance-1');
  });

  it('ignores a withdrawn one', () => {
    const withdrawn = clearance({ revokedAt: new Date('2026-05-19T09:00:00Z') });
    expect(activeClearanceFor(injury(), [withdrawn])).toBeNull();
  });

  it('ignores one signed against another injury', () => {
    expect(activeClearanceFor(injury(), [clearance({ injuryId: 'injury-2' })])).toBeNull();
  });

  it('takes the most recent when there is more than one', () => {
    const older = clearance({ id: 'clearance-0', signedAt: new Date('2026-05-02T10:00:00Z') });
    expect(activeClearanceFor(injury(), [older, clearance()])?.id).toBe('clearance-1');
  });

  it('discounts a clearance signed by somebody who is not a physio', () => {
    const byCoach = clearance({ signedBy: 'user-head' });
    const isPhysio = (userId: string) => userId === PHYSIO;
    expect(activeClearanceFor(injury(), [byCoach], isPhysio)).toBeNull();
    expect(activeClearanceFor(injury(), [clearance()], isPhysio)?.id).toBe('clearance-1');
  });
});

describe('assessReturnToRun', () => {
  it('lets an active athlete run', () => {
    const decision = assessReturnToRun({ state: 'active', injuries: [], clearances: [], asOf: ASOF });
    expect(decision.allowed).toBe(true);
  });

  it('lets an active athlete run even with an old injury on file', () => {
    const decision = assessReturnToRun({
      state: 'active',
      injuries: [injury({ resolvedOn: '2026-05-10' })],
      clearances: [],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(true);
  });

  it('refuses an injured athlete with nothing signed', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [injury()],
      clearances: [],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('signed by a physio');
    expect(decision.blockingInjuryIds).toEqual(['injury-1']);
  });

  it('lets an injured athlete run once a physio has signed', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [injury()],
      clearances: [clearance()],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(true);
  });

  it('shuts the gate again the moment the clearance is withdrawn', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [injury()],
      clearances: [clearance({ revokedAt: new Date('2026-05-19T09:00:00Z') })],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(false);
  });

  it('needs a clearance for every open injury, not just one of them', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [injury(), injury({ id: 'injury-2', region: 'right soleus' })],
      clearances: [clearance()],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blockingInjuryIds).toEqual(['injury-2']);
  });

  it('will not take a coach\'s signature for a physio\'s', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [injury()],
      clearances: [clearance({ signedBy: 'user-head' })],
      asOf: ASOF,
      isPhysio: (userId) => userId === PHYSIO,
    });
    expect(decision.allowed).toBe(false);
  });

  it('flags an athlete marked injured with no injury on record', () => {
    const decision = assessReturnToRun({
      state: 'injured',
      injuries: [],
      clearances: [],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('no open injury on record');
  });

  it('lets a returning athlete run on a standing clearance', () => {
    const decision = assessReturnToRun({
      state: 'returning',
      injuries: [injury()],
      clearances: [clearance()],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(true);
  });

  it('stops a returning athlete whose clearance was withdrawn', () => {
    const decision = assessReturnToRun({
      state: 'returning',
      injuries: [injury()],
      clearances: [clearance({ revokedAt: new Date('2026-05-19T09:00:00Z') })],
      asOf: ASOF,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('withdrawn');
  });
});
