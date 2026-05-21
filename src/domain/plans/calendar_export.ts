import { ValidationError } from '../../lib/errors.js';
import type { ScheduledSession } from './types.js';

/**
 * Exports a plan as an iCalendar feed so athletes can subscribe to it from
 * their phone.
 */
const ICS_LINE_LIMIT = 75;

function fold(line: string): string {
  if (line.length <= ICS_LINE_LIMIT) {
    return line;
  }
  const parts: string[] = [line.slice(0, ICS_LINE_LIMIT)];
  let rest = line.slice(ICS_LINE_LIMIT);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, ICS_LINE_LIMIT - 1));
    rest = rest.slice(ICS_LINE_LIMIT - 1);
  }
  return parts.join('\r\n');
}

function escapeText(value: string): string {
  return value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

function stamp(localDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new ValidationError('a session needs a local date to be exported', { localDate });
  }
  return localDate.replace(/-/g, '');
}

export function planToIcs(planId: string, sessions: readonly ScheduledSession[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pacenote//plan//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const session of sessions) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${planId}-${stamp(session.scheduledFor)}-${session.templateId}`);
    lines.push(`DTSTART;VALUE=DATE:${stamp(session.scheduledFor)}`);
    lines.push(fold(`SUMMARY:${escapeText(session.kind)} - load ${String(session.prescribedLoad)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
