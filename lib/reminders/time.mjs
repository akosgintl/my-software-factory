// Timezone calculations for reminders (named IANA zones, from the ICU data built into Node.js).
// The host's own timezone setting is never used.
//
// Clock-change policy (unchanged from the Markdown-era helper): a local time that does not exist
// (clocks go forward) is moved forward by the size of the gap; a local time that happens twice
// (clocks go back) means its first passage.

const ZONE_RE = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const formatters = new Map();
function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

let zoneIndex = null;
/** All IANA zone names this runtime knows (canonical names), plus UTC. */
export function knownZones() {
  if (!zoneIndex) {
    zoneIndex = new Map();
    for (const z of ['UTC', ...Intl.supportedValuesOf('timeZone')]) zoneIndex.set(z.toLowerCase(), z);
  }
  return [...zoneIndex.values()];
}

/**
 * Validates a timezone name and returns it in its proper spelling.
 * Throws Error with a user-facing message when it is not a usable IANA name.
 */
export function normalizeZone(input) {
  const z = String(input ?? '').trim();
  if (!ZONE_RE.test(z)) {
    throw new Error(`'${z}' is not an IANA timezone name (expected e.g. Europe/Budapest)`);
  }
  knownZones();
  const known = zoneIndex.get(z.toLowerCase());
  if (known) return known;
  try {
    formatter(z); // an alias such as Asia/Kolkata that ICU accepts
    return z;
  } catch {
    formatters.delete(z);
    throw new Error(`unknown timezone '${z}' (expected an IANA name such as Europe/Budapest)`);
  }
}

/** Wall-clock fields of an instant (epoch seconds) in a zone. */
export function wall(tz, epoch) {
  const parts = {};
  for (const p of formatter(tz).formatToParts(new Date(epoch * 1000))) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const asUtc = (w) => Math.floor(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) / 1000);

/** UTC offset in seconds of a zone at an instant. */
export function offset(tz, epoch) {
  return asUtc(wall(tz, epoch)) - epoch;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** "Mon 2026-10-19 09:00 +02:00" */
export function formatLocal(tz, epoch) {
  const w = wall(tz, epoch);
  let o = offset(tz, epoch);
  const sign = o < 0 ? '-' : '+';
  o = Math.abs(o);
  const wd = WEEKDAYS[new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay()];
  return `${wd} ${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)} ${sign}${pad(Math.floor(o / 3600))}:${pad(Math.floor((o % 3600) / 60))}`;
}

/** Parses "YYYY-MM-DD" into {year, month, day}; throws on anything that is not a real date. */
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) throw new Error(`'${s}' is not a date (expected YYYY-MM-DD)`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (year < 1970 || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`'${s}' is not a real calendar date`);
  }
  return { year, month, day };
}

/** Parses 24-hour "HH:MM" into minutes after midnight. */
export function parseTime(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? ''));
  if (!m) throw new Error(`'${s}' is not a time (expected 24-hour HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Wall-clock time -> instant. `wallSeconds` is the local time written as if it were UTC.
 * Returns { epoch, flag } with flag ok | missing | repeated.
 */
function resolveWall(tz, wallSeconds) {
  const o1 = offset(tz, wallSeconds - 86400);
  const o2 = offset(tz, wallSeconds + 86400);
  const valid = [];
  for (const o of [o1, o2]) {
    const u = wallSeconds - o;
    if (offset(tz, u) === o && !valid.includes(u)) valid.push(u);
  }
  if (valid.length === 0) return { epoch: wallSeconds - o1, flag: 'missing' };
  if (valid.length === 2) return { epoch: Math.min(valid[0], valid[1]), flag: 'repeated' };
  return { epoch: valid[0], flag: 'ok' };
}

/** Local date ("YYYY-MM-DD") and time ("HH:MM") in a zone -> { epoch, flag, local }. */
export function resolveLocal(tz, date, time) {
  const d = parseDate(date);
  const mins = parseTime(time);
  const r = resolveWall(tz, Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 1000) + mins * 60);
  return { ...r, local: formatLocal(tz, r.epoch) };
}

export const CALENDAR_RULE_RE =
  /^(daily|weekly:((?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*)|monthly:([1-9]|[12]\d|3[01]))@((?:[01]\d|2[0-3]):[0-5]\d)$/;
export const DURATION_RULE_RE = /^every:([1-9]\d{0,4})([mhd])$/;

/**
 * First occurrence of a calendar rule strictly after `after` (epoch seconds), and not before the
 * local date `from` when given. Returns { epoch, flag, local }.
 */
export function nextCalendar(tz, rule, after, from) {
  const m = CALENDAR_RULE_RE.exec(rule);
  if (!m) throw new Error(`unsupported calendar rule '${rule}'`);
  const kind = m[1];
  const days = m[2] ? m[2].split(',') : null;
  const dom = m[3] ? Number(m[3]) : null;
  const mins = parseTime(m[4]);
  if (from) {
    const f = parseDate(from);
    const start = resolveWall(tz, Math.floor(Date.UTC(f.year, f.month - 1, f.day) / 1000)).epoch - 1;
    if (start > after) after = start;
  }
  const w = wall(tz, after);
  let day = Math.floor(Date.UTC(w.year, w.month - 1, w.day) / 1000) - 86400; // a local date, as UTC midnight
  for (let i = 0; i < 800; i++) {
    const d = new Date(day * 1000);
    let hit = true;
    if (kind.startsWith('weekly')) hit = days.includes(DAY_CODES[d.getUTCDay()]);
    else if (kind.startsWith('monthly')) {
      const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      hit = d.getUTCDate() === Math.min(dom, dim);
    }
    if (hit) {
      const r = resolveWall(tz, day + mins * 60);
      if (r.epoch > after) return { ...r, local: formatLocal(tz, r.epoch) };
    }
    day += 86400;
  }
  throw new Error(`no occurrence found for rule '${rule}'`);
}

export function durationSeconds(rule) {
  const m = DURATION_RULE_RE.exec(rule);
  if (!m) throw new Error(`unsupported duration rule '${rule}'`);
  return Number(m[1]) * { m: 60, h: 3600, d: 86400 }[m[2]];
}

export const toIso = (epoch) => new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
export function fromIso(iso) {
  if (!ISO_RE.test(String(iso))) throw new Error(`'${iso}' is not a UTC instant (expected e.g. 2026-10-13T10:50:00Z)`);
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`'${iso}' is not a real instant`);
  return Math.floor(t / 1000);
}
