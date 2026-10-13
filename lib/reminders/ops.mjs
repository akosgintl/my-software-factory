// The shared reminder operations. Chat (reminders-cli.mjs), the browser app (app/api) and the
// reminder checker all call these functions and nothing else touches the database.
//
// Every write runs in one BEGIN IMMEDIATE transaction: take the write lock, re-read the record,
// check it, change only that record, commit. A browser edit carries the revision it was based on
// (`expectedRev`) and is refused, not merged, when the record changed in between.
//
// Delivery is not exactly-once: `due` marks an occurrence pending, the checker writes the chat
// message, then `ack` completes or advances it. An occurrence left pending is reported once as
// uncertain and never resent automatically.
import { ReminderError } from './errors.mjs';
import { withDb, writeTx, readTx, getMeta, setMeta, SCHEMA_VERSION } from './db.mjs';
import { dbLocation, pollSeconds } from './paths.mjs';
import {
  normalizeZone,
  resolveLocal,
  nextCalendar,
  formatLocal,
  durationSeconds,
  toIso,
  fromIso,
  ISO_RE,
  CALENDAR_RULE_RE,
  DURATION_RULE_RE,
} from './time.mjs';
import { formatId, parseId, describeRule, ruleLabel, ruleDetail, clockChangeNote, span, describeDestination } from './format.mjs';

export const TEXT_MAX = 2000;
const GRACE_DEFAULT = 120; // a pending delivery older than this many seconds is "delivery uncertain"
const LATE = 300; // a delivery this many seconds after its due instant is labelled late
const DEFAULT_DESTINATION = 'checker-chat';
// C0 controls (tab, CR, LF ...), DEL, NEL and the Unicode line/paragraph separators: all become a space.
const CONTROL_CHARS = new RegExp('[' + ['x00-', 'x1f', 'x7f', 'x85', 'u2028', 'u2029'].map((c) => (c.endsWith('-') ? '\\' + c.slice(0, -1) + '-' : '\\' + c)).join('') + ']+', 'g');

// ---------- clock ----------

/**
 * Current instant (epoch seconds). REMINDERS_TEST_NOW=<YYYY-MM-DDTHH:MM:SSZ> replaces the clock for
 * isolated tests only: it is refused unless REMINDERS_DB points at a scratch database, so it can
 * never move the clock of the canonical store.
 */
export function nowEpoch() {
  const fake = process.env.REMINDERS_TEST_NOW;
  if (fake) {
    if (!dbLocation().isolated) {
      throw new ReminderError(
        'invalid',
        'REMINDERS_TEST_NOW is a test clock and is refused for the canonical database (it needs REMINDERS_DB set to a scratch database). Unset it.',
      );
    }
    if (!ISO_RE.test(fake)) throw new ReminderError('invalid', 'REMINDERS_TEST_NOW must look like 2026-10-13T10:00:00Z');
    return fromIso(fake);
  }
  return Math.floor(Date.now() / 1000);
}

function graceSeconds() {
  const n = Number(process.env.REMINDERS_PENDING_GRACE);
  return Number.isFinite(n) && n >= 0 && process.env.REMINDERS_PENDING_GRACE !== undefined && process.env.REMINDERS_PENDING_GRACE !== '' ? n : GRACE_DEFAULT;
}

// ---------- validation ----------

/** One line of text: line breaks and tabs become spaces, runs of spaces collapse. */
export function normalizeText(raw) {
  if (typeof raw !== 'string') throw new ReminderError('invalid', 'reminder text is empty', { field: 'text' });
  const t = raw.replace(CONTROL_CHARS, ' ').replace(/ +/g, ' ').trim();
  if (t === '') throw new ReminderError('invalid', 'reminder text is empty', { field: 'text' });
  const length = [...t].length;
  if (length > TEXT_MAX) {
    throw new ReminderError('invalid', `reminder text is ${length} characters; the limit is ${TEXT_MAX}. Shorten it; nothing was saved.`, { field: 'text' });
  }
  return t;
}

export function requireId(input) {
  const n = parseId(input);
  if (n === null || n < 1) throw new ReminderError('invalid', `'${input}' is not a reminder ID (expected e.g. R-0003)`, { field: 'id' });
  return n;
}

function checkZone(input) {
  try {
    return normalizeZone(input);
  } catch (err) {
    throw new ReminderError('invalid', err.message, { field: 'tz' });
  }
}

const AT_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/;

/**
 * Resolves a schedule request against the current instant.
 * input: { tz?, at?, rule?, from? } — the same parts as the chat SCHEDULE arguments.
 * Returns { tz, rule, next, local, flag, note }. Throws ReminderError('invalid') with a field.
 */
function computeSchedule(db, input, now) {
  const given = input ?? {};
  const rawTz = given.tz && String(given.tz).trim() !== '' ? String(given.tz).trim() : getMeta(db, 'default_timezone');
  if (!rawTz) {
    throw new ReminderError(
      'invalid',
      "no timezone: none was given and no confirmed default timezone is saved. Say which timezone is meant (an IANA name, e.g. Europe/Budapest); the host's timezone is never assumed.",
      { field: 'tz' },
    );
  }
  const tz = checkZone(rawTz);
  const rule = given.rule && String(given.rule).trim() !== '' ? String(given.rule).trim() : 'once';
  const at = given.at ? String(given.at).trim() : '';
  const from = given.from ? String(given.from).trim() : '';
  let date = null;
  let time = null;
  if (at) {
    const m = AT_RE.exec(at);
    if (!m) throw new ReminderError('invalid', 'the date and time must be "YYYY-MM-DD HH:MM" (24-hour local time in the reminder\'s timezone)', { field: 'at' });
    [, date, time] = m;
  }
  const local = (d, t) => {
    try {
      return resolveLocal(tz, d, t);
    } catch (err) {
      throw new ReminderError('invalid', err.message, { field: 'at' });
    }
  };
  let r;
  if (rule === 'once') {
    if (!at) throw new ReminderError('invalid', 'a one-off needs a date and time ("YYYY-MM-DD HH:MM")', { field: 'at' });
    if (from) throw new ReminderError('invalid', 'a start date (--from) is only for daily/weekly/monthly rules', { field: 'from' });
    r = local(date, time);
  } else if (rule.startsWith('every:')) {
    if (!DURATION_RULE_RE.test(rule)) {
      throw new ReminderError('invalid', 'duration rule must be every:N followed by m, h or d (whole minutes at least), e.g. every:90m', { field: 'rule' });
    }
    if (from) throw new ReminderError('invalid', 'a start date (--from) is only for daily/weekly/monthly rules; give the first occurrence as a date and time', { field: 'from' });
    if (at) r = local(date, time);
    else {
      const e = now + durationSeconds(rule);
      r = { epoch: e, flag: 'ok', local: formatLocal(tz, e) };
    }
  } else if (/^(daily|weekly|monthly)/.test(rule)) {
    if (!CALENDAR_RULE_RE.test(rule)) {
      throw new ReminderError(
        'invalid',
        'calendar rule must be daily@HH:MM, weekly:MO,WE@HH:MM (days MO TU WE TH FR SA SU) or monthly:D@HH:MM (D = 1-31), 24-hour time',
        { field: 'rule' },
      );
    }
    if (at) {
      throw new ReminderError('invalid', 'calendar rules take their time from the rule (e.g. daily@09:00); use a start date (--from YYYY-MM-DD), not a date and time', { field: 'at' });
    }
    try {
      r = nextCalendar(tz, rule, now, from || undefined);
    } catch (err) {
      throw new ReminderError('invalid', err.message, { field: from ? 'from' : 'rule' });
    }
  } else {
    throw new ReminderError(
      'invalid',
      `unsupported rule '${rule}'. Supported: (none = one-off), every:N{m|h|d}, daily@HH:MM, weekly:DAYS@HH:MM, monthly:D@HH:MM`,
      { field: 'rule' },
    );
  }
  if (!(r.epoch > now)) {
    throw new ReminderError('invalid', `that time (${r.local} ${tz}) is not in the future (now: ${formatLocal(tz, now)} ${tz}). Nothing was saved; choose a later date or time.`, {
      field: 'at',
    });
  }
  return { tz, rule, next: toIso(r.epoch), local: r.local, flag: r.flag, note: clockChangeNote(r.flag, tz, r.local) };
}

// ---------- records ----------

function toRecord(row) {
  if (!row) return null;
  return {
    id: formatId(row.n),
    n: row.n,
    text: row.text,
    state: row.state,
    tz: row.tz,
    rule: row.rule,
    ruleText: describeRule(row.rule),
    ruleLabel: ruleLabel(row.rule),
    ruleDetail: ruleDetail(row.rule),
    nextDue: row.next_due,
    nextLocal: row.next_local,
    pending: row.pending
      ? { occurrence: row.pending, run: row.prun, markedAt: row.pmarked, uncertain: row.pnote === 'yes' }
      : null,
    lastDelivered: row.last,
    ackedAt: row.acked,
    destination: row.destination,
    destinationText: describeDestination(row.destination),
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const selectRow = (db, n) => db.prepare('SELECT * FROM reminders WHERE n = ?').get(n);

function requireRow(db, n) {
  const row = selectRow(db, n);
  if (!row) throw new ReminderError('not_found', `no reminder with ID ${formatId(n)}. Nothing was changed.`);
  return row;
}

function checkRev(row, expectedRev) {
  if (expectedRev === undefined || expectedRev === null) return;
  if (!Number.isInteger(expectedRev)) throw new ReminderError('invalid', 'the revision of the reminder being edited is missing or not a number', { field: 'rev' });
  if (row.rev !== expectedRev) {
    throw new ReminderError(
      'conflict',
      `${formatId(row.n)} was changed somewhere else (in chat or another window) after you opened it. Nothing was saved.`,
      { current: toRecord(row) },
    );
  }
}

function scheduleSummary(rec) {
  return `${rec.state}; rule ${rec.rule}; next due ${rec.nextLocal} (${rec.tz})`;
}

function pendingNote(row) {
  return row.pending
    ? `NOTE: occurrence ${row.pending} was being delivered when this change was saved; it may already have been sent. Its acknowledgement will now be refused and it will not be sent again.`
    : '';
}

function saveDefaultZone(db, zone) {
  const z = checkZone(zone);
  setMeta(db, 'default_timezone', z);
  return z;
}

// ---------- reads ----------

function overview(db, now) {
  const rows = db.prepare('SELECT * FROM reminders ORDER BY n').all();
  return {
    reminders: rows.map(toRecord),
    defaultTimezone: getMeta(db, 'default_timezone'),
    nextId: formatId(Number(getMeta(db, 'next_id') ?? 1)),
    now: toIso(now),
  };
}

/** Every reminder, read fresh from the database. */
export function listReminders() {
  const now = nowEpoch();
  return withDb((db) => readTx(db, () => overview(db, now)));
}

export function getReminder(id) {
  const n = requireId(id);
  return withDb((db) => {
    const row = selectRow(db, n);
    if (!row) throw new ReminderError('not_found', `no reminder with ID ${formatId(n)}.`);
    return toRecord(row);
  });
}

export function getDefaultTimezone() {
  return withDb((db) => getMeta(db, 'default_timezone'));
}

/** Shows what a schedule would be saved as, without writing. */
export function resolveSchedule(schedule) {
  const now = nowEpoch();
  return withDb((db) => {
    const s = computeSchedule(db, schedule, now);
    return { ...s, ruleText: describeRule(s.rule), ruleLabel: ruleLabel(s.rule), now: toIso(now) };
  });
}

export function currentTime(tz) {
  const now = nowEpoch();
  return withDb((db) => {
    const raw = tz && String(tz).trim() !== '' ? tz : getMeta(db, 'default_timezone');
    if (!raw) {
      throw new ReminderError('invalid', 'no timezone: give one (--tz <IANA zone>), or ask the user and save a confirmed default with: reminders.sh tz <Zone>', { field: 'tz' });
    }
    const zone = checkZone(raw);
    return { tz: zone, now: toIso(now), local: formatLocal(zone, now) };
  });
}

// ---------- writes ----------

/**
 * Creates a reminder. `schedule` is omitted for an unscheduled reminder.
 * Returns { reminder, note } read back from the committed row.
 */
export function createReminder({ text, schedule, saveDefaultTimezone } = {}) {
  const clean = normalizeText(text);
  const now = nowEpoch();
  return withDb((db) => {
    const { n, note } = writeTx(db, () => {
      const s = schedule ? computeSchedule(db, schedule, now) : null;
      const counter = Number(getMeta(db, 'next_id'));
      if (!Number.isInteger(counter) || counter < 1) {
        throw new ReminderError('store', "the database has no valid 'next_id'; refusing to guess an ID (removed IDs must never be reused).");
      }
      const max = db.prepare('SELECT MAX(n) AS m FROM reminders').get().m ?? 0;
      const id = Math.max(counter, max + 1);
      setMeta(db, 'next_id', id + 1);
      const stamp = toIso(now);
      db.prepare(
        `INSERT INTO reminders (n, text, state, tz, rule, next_due, next_local, destination, rev, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(id, clean, s ? 'active' : 'unscheduled', s?.tz ?? null, s?.rule ?? null, s?.next ?? null, s?.local ?? null, DEFAULT_DESTINATION, stamp, stamp);
      if (saveDefaultTimezone && s) saveDefaultZone(db, s.tz);
      return { n: id, note: s?.note ?? '' };
    });
    const reminder = toRecord(selectRow(db, n));
    if (!reminder || reminder.text !== clean) throw new ReminderError('store', 'the saved database does not contain the new record');
    return { reminder, note, defaultTimezone: getMeta(db, 'default_timezone') };
  });
}

/**
 * Changes text and/or schedule of one reminder in a single transaction.
 *   changes.text:     string (replace the whole text) | undefined (keep)
 *   changes.schedule: object (replace the whole schedule) | null (stop sending, keep the text) | undefined (keep)
 * Returns { reminder, previous, note } with `reminder` read back from the committed row.
 */
export function updateReminder(id, changes = {}, { expectedRev, saveDefaultTimezone } = {}) {
  const n = requireId(id);
  const clean = changes.text === undefined ? undefined : normalizeText(changes.text);
  const now = nowEpoch();
  return withDb((db) => {
    const outcome = writeTx(db, () => {
      const row = requireRow(db, n);
      checkRev(row, expectedRev);
      const previous = toRecord(row);
      let note = '';
      const next = { ...row };
      let changed = false;
      if (clean !== undefined && clean !== row.text) {
        next.text = clean;
        changed = true;
      }
      if (changes.schedule === null) {
        if (row.state !== 'unscheduled') {
          note = pendingNote(row);
          Object.assign(next, { state: 'unscheduled', tz: null, rule: null, next_due: null, next_local: null, pending: null, prun: null, pmarked: null, pnote: null, last: null, acked: null });
          changed = true;
        }
      } else if (changes.schedule !== undefined) {
        const s = computeSchedule(db, changes.schedule, now);
        note = [pendingNote(row), s.note].filter(Boolean).join('\n');
        Object.assign(next, { state: 'active', tz: s.tz, rule: s.rule, next_due: s.next, next_local: s.local, pending: null, prun: null, pmarked: null, pnote: null });
        if (saveDefaultTimezone) saveDefaultZone(db, s.tz);
        changed = true;
      }
      if (changed) {
        db.prepare(
          `UPDATE reminders SET text = ?, state = ?, tz = ?, rule = ?, next_due = ?, next_local = ?, pending = ?, prun = ?, pmarked = ?, pnote = ?,
             last = ?, acked = ?, rev = rev + 1, updated_at = ? WHERE n = ?`,
        ).run(next.text, next.state, next.tz, next.rule, next.next_due, next.next_local, next.pending, next.prun, next.pmarked, next.pnote, next.last, next.acked, toIso(now), n);
      }
      return { previous, note, changed };
    });
    return { reminder: toRecord(selectRow(db, n)), ...outcome, defaultTimezone: getMeta(db, 'default_timezone') };
  });
}

export const modifyText = (id, text, options) => updateReminder(id, { text }, options);
export const setSchedule = (id, schedule, options) => updateReminder(id, { schedule }, options);
export const unscheduleReminder = (id, options) => updateReminder(id, { schedule: null }, options);

/** Deletes one reminder with its schedule. Its ID is never given out again. */
export function removeReminder(id, { expectedRev } = {}) {
  const n = requireId(id);
  return withDb((db) => {
    const outcome = writeTx(db, () => {
      const row = requireRow(db, n);
      checkRev(row, expectedRev);
      const counter = Number(getMeta(db, 'next_id'));
      if (!(counter > n)) setMeta(db, 'next_id', n + 1); // an ID at or above the counter must still never be reused
      db.prepare('DELETE FROM reminders WHERE n = ?').run(n);
      return { removed: toRecord(row), note: pendingNote(row) };
    });
    if (selectRow(db, n)) throw new ReminderError('store', `record ${formatId(n)} is still present after removal`);
    return outcome;
  });
}

export function setDefaultTimezone(zone) {
  return withDb((db) => writeTx(db, () => saveDefaultZone(db, zone)));
}

// ---------- delivery (the reminder checker) ----------

function sanitizeRun(run, now) {
  const handle = run && String(run).trim() !== '' ? String(run) : `chk-${toIso(now).replace(/[-:]/g, '')}-${process.pid}`;
  return handle.replace(/[^A-Za-z0-9._-]/g, '_');
}

const ruleWord = (rule) => (rule === 'once' ? 'one-off' : `recurring ${rule}`);

/**
 * The checker's selection step. In one write transaction: select every active reminder whose next
 * occurrence is due, mark that occurrence pending and return what to deliver. A reminder that
 * already has a pending occurrence is never selected again (an older check may have sent it); once
 * it is older than the grace period it is reported a single time as uncertain.
 */
export function selectDue({ run } = {}) {
  const now = nowEpoch();
  const handle = sanitizeRun(run, now);
  const grace = graceSeconds();
  return withDb((db) =>
    writeTx(db, () => {
      const items = [];
      const rows = db.prepare("SELECT * FROM reminders WHERE state = 'active' ORDER BY n").all();
      for (const row of rows) {
        const id = formatId(row.n);
        if (row.pending) {
          if (row.pnote !== 'yes' && now - fromIso(row.pmarked) >= grace) {
            db.prepare("UPDATE reminders SET pnote = 'yes', updated_at = ? WHERE n = ?").run(toIso(now), row.n);
            items.push({
              kind: 'UNCERTAIN',
              id,
              occurrence: row.pending,
              message: `Delivery uncertain for reminder ${id}: "${row.text}" (due ${row.next_local} ${row.tz}; ${ruleWord(row.rule)}). An earlier check (run ${row.prun}, ${row.pmarked}) selected it but never confirmed delivery. It has NOT been resent.`,
            });
          }
        } else if (row.next_due && fromIso(row.next_due) <= now) {
          db.prepare("UPDATE reminders SET pending = ?, prun = ?, pmarked = ?, pnote = 'no', updated_at = ? WHERE n = ?").run(row.next_due, handle, toIso(now), toIso(now), row.n);
          const late = now - fromIso(row.next_due);
          items.push({
            kind: 'DELIVER',
            id,
            occurrence: row.next_due,
            message: `Reminder ${id}: ${row.text}  (due ${row.next_local} ${row.tz}; ${ruleWord(row.rule)}${late >= LATE ? `; LATE by ${span(late)} - catch-up` : ''})`,
          });
        }
      }
      return { run: handle, now: toIso(now), items };
    }),
  );
}

function pendingGuard(db, n, occurrence, verb) {
  const id = formatId(n);
  if (!ISO_RE.test(String(occurrence))) {
    throw new ReminderError('invalid', `'${occurrence}' is not an occurrence instant (expected e.g. 2026-10-13T10:50:00Z, as printed by due)`, { field: 'occurrence' });
  }
  const row = selectRow(db, n);
  if (!row) throw new ReminderError('refused', `${verb} refused: reminder ${id} no longer exists (removed after it was selected). Nothing was changed.`);
  if (row.state === 'unscheduled') throw new ReminderError('refused', `${verb} refused: reminder ${id} has no schedule any more. Nothing was changed.`);
  if (verb === 'ack' && !row.pending && row.last === occurrence) return { row, already: true };
  if (row.state !== 'active') throw new ReminderError('refused', `${verb} refused: reminder ${id} is ${row.state}. Nothing was changed.`);
  if (row.pending !== occurrence) {
    throw new ReminderError(
      'refused',
      `${verb} refused: occurrence ${occurrence} of ${id} is not pending (pending: ${row.pending ?? '-'}; next due: ${row.next_due ?? '-'}). It was edited, rescheduled or already reconciled. Nothing was changed.`,
    );
  }
  return { row, already: false };
}

/**
 * The checker's confirmation step, run only after the chat message was written: re-checks under the
 * write lock that this occurrence is still pending, then completes a one-off or advances a
 * recurring reminder to its first future occurrence (calculated from the saved occurrence).
 */
export function acknowledge(id, occurrence) {
  const n = requireId(id);
  const now = nowEpoch();
  return withDb((db) => {
    const outcome = writeTx(db, () => {
      const { row, already } = pendingGuard(db, n, occurrence, 'ack');
      if (already) return { already: true, note: '' };
      const base = fromIso(occurrence);
      let nextDue = null;
      let nextLocal = row.next_local;
      let state = 'active';
      let note = '';
      if (row.rule === 'once') {
        state = 'completed';
      } else if (row.rule.startsWith('every:')) {
        const dur = durationSeconds(row.rule);
        const k = now >= base ? Math.floor((now - base) / dur) + 1 : 1;
        const e = base + k * dur;
        nextDue = toIso(e);
        nextLocal = formatLocal(row.tz, e);
      } else {
        const r = nextCalendar(row.tz, row.rule, Math.max(now, base));
        nextDue = toIso(r.epoch);
        nextLocal = r.local;
        note = clockChangeNote(r.flag, row.tz, r.local);
      }
      db.prepare(
        `UPDATE reminders SET state = ?, next_due = ?, next_local = ?, pending = NULL, prun = NULL, pmarked = NULL, pnote = NULL,
           last = ?, acked = ?, updated_at = ? WHERE n = ?`,
      ).run(state, nextDue, nextLocal, occurrence, toIso(now), toIso(now), n);
      return { already: false, note };
    });
    return { reminder: toRecord(selectRow(db, n)), occurrence, ...outcome };
  });
}

/** Reconciliation: the occurrence was NOT delivered, so make it due again (sent once, labelled late). */
export function retryDelivery(id, occurrence) {
  const n = requireId(id);
  const now = nowEpoch();
  return withDb((db) => {
    writeTx(db, () => {
      pendingGuard(db, n, occurrence, 'retry');
      db.prepare('UPDATE reminders SET pending = NULL, prun = NULL, pmarked = NULL, pnote = NULL, updated_at = ? WHERE n = ?').run(toIso(now), n);
    });
    return { reminder: toRecord(selectRow(db, n)), occurrence };
  });
}

// ---------- status ----------

export function storeStatus() {
  const loc = dbLocation();
  return withDb((db) =>
    readTx(db, () => {
      const count = (where) => db.prepare(`SELECT COUNT(*) AS c FROM reminders ${where}`).get().c;
      return {
        databasePath: loc.path,
        canonicalPath: loc.canonical,
        isolated: loc.isolated,
        schemaVersion: SCHEMA_VERSION,
        journalMode: db.prepare('PRAGMA journal_mode').get().journal_mode,
        migrationStage: getMeta(db, 'migration_stage') ?? 'none',
        migrationSource: getMeta(db, 'migration_source'),
        migrationBackup: getMeta(db, 'migration_backup'),
        nextId: formatId(Number(getMeta(db, 'next_id') ?? 1)),
        defaultTimezone: getMeta(db, 'default_timezone'),
        pollSeconds: pollSeconds(),
        counts: {
          total: count(''),
          active: count("WHERE state = 'active'"),
          unscheduled: count("WHERE state = 'unscheduled'"),
          completed: count("WHERE state = 'completed'"),
          pending: count('WHERE pending IS NOT NULL'),
        },
      };
    }),
  );
}

/** Writes a consistent copy of the database to `destination` (a labelled backup, never a live store). */
export function backupTo(destination) {
  return withDb((db) => {
    db.prepare('VACUUM INTO ?').run(destination);
    return destination;
  });
}

export { scheduleSummary };
