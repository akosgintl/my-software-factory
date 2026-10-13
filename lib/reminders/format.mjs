// Wording shared by chat output and the browser. No Node-only imports: this file also runs in the browser.

export const formatId = (n) => `R-${String(n).padStart(4, '0')}`;

/** "R-0003", "r-3", "3" -> 3. Returns null when it is not a reminder ID. */
export function parseId(input) {
  const m = /^[Rr]?-?(\d{1,9})$/.exec(String(input ?? '').replace(/\s+/g, ''));
  return m ? Number(m[1]) : null;
}

const DAY_NAMES = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
const UNIT_NAMES = { m: ['minute', 'minutes'], h: ['hour', 'hours'], d: ['day', 'days'] };

/** The chat wording of a rule (unchanged from the Markdown-era service). */
export function describeRule(rule) {
  if (!rule) return '';
  if (rule === 'once') return 'one-off';
  let m = /^every:(\d+)([mhd])$/.exec(rule);
  if (m) {
    if (m[2] === 'm') return `every ${m[1]} minute(s), exact duration`;
    if (m[2] === 'h') return `every ${m[1]} hour(s), exact duration`;
    return `every ${m[1]} x 24 hours, exact duration (local time shifts at clock changes)`;
  }
  m = /^daily@(.+)$/.exec(rule);
  if (m) return `every day at ${m[1]} local time`;
  m = /^weekly:(.+)@(.+)$/.exec(rule);
  if (m) return `weekly on ${m[1]} at ${m[2]} local time`;
  m = /^monthly:(\d+)@(.+)$/.exec(rule);
  if (m) return `monthly on day ${m[1]} (last day of shorter months) at ${m[2]} local time`;
  return rule;
}

/** A short label for lists: "Once", "Every Monday and Friday at 08:30". */
export function ruleLabel(rule) {
  if (!rule) return 'No schedule';
  if (rule === 'once') return 'Once';
  let m = /^every:(\d+)([mhd])$/.exec(rule);
  if (m) {
    const n = Number(m[1]);
    if (m[2] === 'd') return n === 1 ? 'Every 24 hours' : `Every ${n} × 24 hours`;
    return n === 1 ? `Every ${UNIT_NAMES[m[2]][0]}` : `Every ${n} ${UNIT_NAMES[m[2]][1]}`;
  }
  m = /^daily@(.+)$/.exec(rule);
  if (m) return `Every day at ${m[1]}`;
  m = /^weekly:(.+)@(.+)$/.exec(rule);
  if (m) {
    const days = m[1].split(',').map((d) => DAY_NAMES[d] ?? d);
    const list = days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
    return `Every ${list} at ${m[2]}`;
  }
  m = /^monthly:(\d+)@(.+)$/.exec(rule);
  if (m) return `Monthly on day ${m[1]} at ${m[2]}`;
  return rule;
}

/** The longer explanation shown in details. */
export function ruleDetail(rule) {
  if (!rule) return 'Not scheduled. It is kept as text and is never sent.';
  if (rule === 'once') return 'Once. After it is delivered it is marked as delivered and not sent again.';
  let m = /^every:(\d+)([mhd])$/.exec(rule);
  if (m) {
    const tail = m[2] === 'd' ? ' The local clock time shifts by an hour when clocks change.' : '';
    return `${ruleLabel(rule)}, counted exactly from the first occurrence.${tail}`;
  }
  m = /^monthly:(\d+)@/.exec(rule);
  if (m && Number(m[1]) >= 29) {
    return `${ruleLabel(rule)}; in a shorter month, on its last day. The local time is kept when clocks change.`;
  }
  return `${ruleLabel(rule)}. The local time is kept when clocks change.`;
}

/** "Mon 2026-10-19 09:00 +02:00" -> { weekday, date, time, offset } (null when it does not parse). */
export function splitLocal(local) {
  const m = /^(\w{3}) (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/.exec(String(local ?? ''));
  return m ? { weekday: m[1], date: m[2], time: m[3], offset: m[4] } : null;
}

export function clockChangeNote(flag, tz, local) {
  if (flag === 'missing') {
    return `NOTE: that local time does not exist on that date in ${tz} (clocks go forward); it was moved forward to ${local}.`;
  }
  if (flag === 'repeated') {
    return `NOTE: that local time happens twice on that date in ${tz} (clocks go back); the first (earlier) one is used: ${local}.`;
  }
  return '';
}

/** 3725 -> "1h 2m" (as in late catch-up labels). */
export function span(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let out = '';
  if (d) out += `${d}d `;
  if (d || h) out += `${h}h `;
  return `${out}${m}m`;
}

/** Destination wording. One destination exists: the reminder checker's chat (FACTORY.md "Reminder checker"). */
export const DESTINATIONS = {
  'checker-chat': 'The reminder checker’s chat (the factory chat in VS Code)',
};
export const describeDestination = (d) => DESTINATIONS[d] ?? d;
