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
