import { athleteLocalDay, instantFromWallClock } from '../lib/time.js';
import type { MappedSession, StravaActivity } from './types.js';

/**
 * Sport types we treat as a run. Anything else is left on Strava's side of
 * the fence - this package has never imported them.
 */
const RUN_SPORT_TYPES = ['Run', 'TrailRun', 'VirtualRun', 'TreadmillRun'];
