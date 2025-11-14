import { describe, expect, it } from 'vitest';
import { assessReadiness, brokenRules, prescribeKind } from '../../src/domain/load/readiness.js';

/**
 * Four weeks of steady running ending Sunday 2026-05-17, with Wednesdays off.
 */
function steadyMonth() {
  const entries: Array<{ localDate: string; load: number }> = [];
  const volume: Array<{ localDate: string; distanceM: number }> = [];
  const start = new Date('2026-04-20T12:00:00Z');
  for (let day = 0; day < 28; day += 1) {
    const at = new Date(start.getTime() + day * 86_400_000);
    const localDate = at.toISOString().slice(0, 10);
    if (at.getUTCDay() === 3) {
      continue;
    }
    entries.push({ localDate, load: 50 });
    volume.push({ localDate, distanceM: 10_000 });
  }
  return { entries, volume };
}

describe('assessReadiness', () => {
  const { entries, volume } = steadyMonth();

  it('passes every rule for an athlete holding steady', () => {
    const readiness = assessReadiness({ asOf: '2026-05-17', loadEntries: entries, volumeEntries: volume });
    expect(readiness.ok).toBe(true);
    expect(brokenRules(readiness)).toEqual([]);
  });

  it('reports a finding for each of the four rules it covers', () => {
    const readiness = assessReadiness({ asOf: '2026-05-17', loadEntries: entries, volumeEntries: volume });
    expect(readiness.findings.map((finding) => finding.rule)).toEqual(['R1', 'R2', 'R3', 'R8']);
  });

  it('breaks R3 when the athlete has run every day for a week', () => {
    const everyDay = [
      { localDate: '2026-05-11', load: 50 },
      { localDate: '2026-05-12', load: 50 },
      { localDate: '2026-05-13', load: 50 },
      { localDate: '2026-05-14', load: 50 },
      { localDate: '2026-05-15', load: 50 },
      { localDate: '2026-05-16', load: 50 },
      { localDate: '2026-05-17', load: 50 },
    ];
    const readiness = assessReadiness({
      asOf: '2026-05-17',
      loadEntries: everyDay,
      volumeEntries: [],
    });
    expect(brokenRules(readiness)).toContain('R3');
  });

  it('breaks R2 when the week jumps', () => {
    const jump = [
      { localDate: '2026-05-06', distanceM: 30_000 },
      { localDate: '2026-05-13', distanceM: 60_000 },
    ];
    const readiness = assessReadiness({
      asOf: '2026-05-17',
      loadEntries: [],
      volumeEntries: jump,
    });
    expect(brokenRules(readiness)).toContain('R2');
  });

  it('breaks R8 when volume climbs inside the taper', () => {
    const climbing = [
      { localDate: '2026-05-13', distanceM: 40_000 },
      { localDate: '2026-05-20', distanceM: 44_000 },
    ];
    const readiness = assessReadiness({
      asOf: '2026-05-22',
      loadEntries: [],
      volumeEntries: climbing,
      raceDate: '2026-05-24',
    });
    expect(brokenRules(readiness)).toContain('R8');
    expect(readiness.taper.inTaper).toBe(true);
  });
});
