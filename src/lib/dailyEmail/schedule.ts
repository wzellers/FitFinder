// When is a user's daily email due?
//
// Each user picks a local send time and time zone. The sender runs every 15
// minutes and asks `isDue` for each opted-in user. A user is due once their
// local clock passes the send time, unless today's email already went out.
// The catch-up window stops a late run (or a user who just opted in at 9pm)
// from sending a "morning" email in the evening.

/** How long after the chosen time a missed send still goes out. */
export const CATCH_UP_MINUTES = 120;

export interface LocalClock {
  /** `YYYY-MM-DD` in the user's time zone. */
  date: string;
  /** Minutes since local midnight. */
  minutes: number;
}

/** True when `timeZone` is an IANA zone this runtime understands. */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date and time of day at `now` in `timeZone` (UTC if invalid). */
export function localClock(now: Date, timeZone: string | null | undefined): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Minutes since midnight for a Postgres `time` value ("07:30" or "07:30:00"). */
export function parseSendTime(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** `YYYY-MM-DD` that is `days` before `date`. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DueCheck {
  now: Date;
  timeZone: string | null | undefined;
  sendTime: string | null | undefined;
  /** Local date the last email went out, or null if never. */
  lastSentDate: string | null | undefined;
}

/** Whether to send now, and the local date the email is for. */
export function isDue({ now, timeZone, sendTime, lastSentDate }: DueCheck): {
  due: boolean;
  localDate: string;
} {
  const clock = localClock(now, timeZone);
  const target = parseSendTime(sendTime);
  const due =
    target !== null &&
    lastSentDate !== clock.date &&
    clock.minutes >= target &&
    clock.minutes < target + CATCH_UP_MINUTES;
  return { due, localDate: clock.date };
}
