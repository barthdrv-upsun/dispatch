import { ValidationError } from '../../lib/errors.js';
import { addLocalDays, type LocalDate } from '../../lib/time.js';
import { prescribedLoad } from './templates.js';
import { DAYS_PER_WEEK } from './slots.js';
import type { BlockSlot, Plan, ScheduledSession, WorkoutTemplate } from './types.js';

/**
 * Lays a block's slots out on the calendar for one plan.
 *
 * Week 1 day 1 is the plan's start date; the dates it returns are local days
 * in the athlete's own calendar, and the caller turns them into instants when
 * it writes them.
 */
export function expandPlan(
  plan: Plan,
  slots: readonly BlockSlot[],
  templates: readonly WorkoutTemplate[],
): ScheduledSession[] {
  const byId = new Map(templates.map((template) => [template.id, template]));

  return slots
    .slice()
    .sort((a, b) => (a.week === b.week ? a.day - b.day : a.week - b.week))
    .map((slot) => {
      const template = byId.get(slot.templateId);
      if (!template) {
        throw new ValidationError(`slot week ${slot.week} day ${slot.day} points at a template we do not have`, {
          templateId: slot.templateId,
        });
      }
      if (template.version !== slot.templateVersion) {
        throw new ValidationError(
          `slot week ${slot.week} day ${slot.day} pins template ${template.code} v${slot.templateVersion} but we were handed v${template.version}`,
        );
      }
      return {
        planId: plan.id,
        athleteId: plan.athleteId,
        templateId: template.id,
        templateVersion: slot.templateVersion,
        scheduledFor: dayFor(plan.startsOn, slot.week, slot.day),
        kind: template.kind,
        prescribedLoad: prescribedLoad(template),
      };
    });
}

export function dayFor(startsOn: LocalDate, week: number, day: number): LocalDate {
  return addLocalDays(startsOn, (week - 1) * DAYS_PER_WEEK + (day - 1));
}
