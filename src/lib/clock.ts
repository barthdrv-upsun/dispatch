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
