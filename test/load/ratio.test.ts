import { describe, expect, it } from 'vitest';
import {
  assessRatio,
  computeLoadRatio,
  downgradeForRatio,
  RATIO_MAX,
  RATIO_MIN,
} from '../../src/domain/load/ratio.js';

describe('computeLoadRatio', () => {
  it('divides acute by chronic', () => {
    expect(computeLoadRatio(300, 250)).toBe(1.2);
  });

  it('reports zero when there is no chronic load to divide by', () => {
    expect(computeLoadRatio(300, 0)).toBe(0);
  });

  it('refuses figures that are not numbers', () => {
    expect(() => computeLoadRatio(Number.NaN, 100)).toThrow(RangeError);
  });
});

describe('assessRatio', () => {
  it('accepts a ratio inside the band', () => {
    const verdict = assessRatio(260, 250);
    expect(verdict.position).toBe('within');
    expect(verdict.withinBounds).toBe(true);
  });

  it('accepts both edges of the band', () => {
    expect(assessRatio(RATIO_MIN * 100, 100).position).toBe('within');
    expect(assessRatio(RATIO_MAX * 100, 100).position).toBe('within');
  });

  it('flags a ratio above the band', () => {
    const verdict = assessRatio(400, 250);
    expect(verdict.ratio).toBe(1.6);
    expect(verdict.position).toBe('above');
    expect(verdict.withinBounds).toBe(false);
  });

  it('flags a ratio below the band', () => {
    const verdict = assessRatio(100, 250);
    expect(verdict.position).toBe('below');
    expect(verdict.withinBounds).toBe(false);
  });

  it('does not punish an athlete with no history for having no history', () => {
    const verdict = assessRatio(120, 0);
    expect(verdict.position).toBe('unknown');
    expect(verdict.withinBounds).toBe(true);
  });
});

describe('downgradeForRatio', () => {
  it('downgrades a hard session when the ratio is outside the band', () => {
    const decision = downgradeForRatio('interval', assessRatio(400, 250));
    expect(decision.kind).toBe('easy');
    expect(decision.downgradedFrom).toBe('interval');
    expect(decision.reason).toContain('1.60');
  });

  it('downgrades a long run too', () => {
    expect(downgradeForRatio('long', assessRatio(400, 250)).kind).toBe('easy');
  });

  it('leaves an easy session alone whatever the ratio says', () => {
    const decision = downgradeForRatio('easy', assessRatio(400, 250));
    expect(decision.kind).toBe('easy');
    expect(decision.downgradedFrom).toBeNull();
  });

  it('leaves a hard session alone when the ratio is fine', () => {
    const decision = downgradeForRatio('tempo', assessRatio(260, 250));
    expect(decision.kind).toBe('tempo');
    expect(decision.reason).toBeNull();
  });
});
