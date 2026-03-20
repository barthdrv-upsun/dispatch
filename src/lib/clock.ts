/**
 * Injected so the physio gate and the publish path can be tested without
 * reaching for the system clock.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(at: Date | string): Clock {
  const instant = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`fixedClock received an invalid instant: ${String(at)}`);
  }
  return { now: () => new Date(instant.getTime()) };
}
