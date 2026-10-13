// SQLite access for the reminder store. One database file (see paths.mjs); a connection is opened
// per operation and closed again, so every reader sees committed data and no process keeps a stale
// handle. Writers use BEGIN IMMEDIATE: the write lock is taken first, the record is re-read inside
// the transaction, and SQLite's busy timeout makes concurrent writers wait instead of failing.
// See https://www.sqlite.org/isolation.html.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dbLocation } from './paths.mjs';
import { ReminderError } from './errors.mjs';

export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS reminders (
  n           INTEGER PRIMARY KEY,           -- numeric part of the stable ID: 7 is R-0007; never reused
  text        TEXT    NOT NULL CHECK (length(text) > 0),
  state       TEXT    NOT NULL CHECK (state IN ('unscheduled', 'active', 'completed')),
  tz          TEXT,                          -- IANA timezone of the schedule
  rule        TEXT,                          -- once | daily@HH:MM | weekly:DAYS@HH:MM | monthly:D@HH:MM | every:N{m|h|d}
  next_due    TEXT,                          -- next due instant, UTC ISO-8601; NULL when completed
  next_local  TEXT,                          -- the same instant on the local clock of tz
  pending     TEXT,                          -- occurrence a check selected and has not acknowledged
  prun        TEXT,                          -- that check's run handle
  pmarked     TEXT,                          -- when it was selected (UTC)
  pnote       TEXT,                          -- 'yes' once reported as delivery-uncertain
  last        TEXT,                          -- last delivered occurrence (UTC)
  acked       TEXT,                          -- when it was acknowledged (UTC)
  destination TEXT    NOT NULL DEFAULT 'checker-chat',
  rev         INTEGER NOT NULL DEFAULT 1,    -- bumped by every change to text or schedule definition
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  CHECK ((state = 'unscheduled') = (rule IS NULL)),
  CHECK ((state = 'unscheduled') = (tz IS NULL)),
  CHECK (state <> 'active' OR next_due IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS reminders_due ON reminders (state, next_due);
`;

function busyMs() {
  const n = Number(process.env.REMINDERS_BUSY_MS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5000;
}

function isBusy(err) {
  return err && (err.errcode === 5 || err.errcode === 6 || /database is locked|database table is locked/i.test(String(err.message)));
}

function wrap(err) {
  if (err instanceof ReminderError) return err;
  if (isBusy(err)) {
    return new ReminderError('busy', 'the reminder database stayed locked by another writer. Nothing was changed; wait a moment and retry once.');
  }
  return err;
}

/**
 * Opens the one reminder database. It is never created implicitly: a missing file is an error
 * unless `create` is set (the migration and tests do that), so a wrong path cannot silently start
 * a second, empty store.
 */
export function openDatabase({ create = false } = {}) {
  const loc = dbLocation();
  const exists = fs.existsSync(loc.path);
  if (!exists && !create) {
    throw new ReminderError(
      'store',
      `reminder database ${loc.path} is missing. It is not recreated automatically; see "Recovery" in reminders-guide.md.`,
    );
  }
  if (!exists) fs.mkdirSync(path.dirname(loc.path), { recursive: true });
  let db;
  try {
    db = new DatabaseSync(loc.path);
    db.exec(`PRAGMA busy_timeout = ${busyMs()}; PRAGMA synchronous = FULL;`);
    if (create) {
      db.exec('PRAGMA journal_mode = DELETE;');
      db.exec('BEGIN IMMEDIATE');
      db.exec(SCHEMA);
      const ins = db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)');
      ins.run('schema_version', String(SCHEMA_VERSION));
      ins.run('next_id', '1');
      db.exec('COMMIT');
    } else {
      const row = tableExists(db, 'meta') ? db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() : null;
      if (!row) {
        throw new ReminderError('store', `${loc.path} is not a reminder database (no schema). Nothing was changed; see "Recovery" in reminders-guide.md.`);
      }
      if (Number(row.value) !== SCHEMA_VERSION) {
        throw new ReminderError('store', `reminder database schema ${row.value} is not the supported version ${SCHEMA_VERSION}. Nothing was changed.`);
      }
    }
    return db;
  } catch (err) {
    try {
      db?.close();
    } catch {
      /* already closed */
    }
    throw wrap(err);
  }
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

/** Runs fn(db) with a fresh connection and always closes it. */
export function withDb(fn, options) {
  const db = openDatabase(options);
  try {
    return fn(db);
  } catch (err) {
    throw wrap(err);
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/** A write transaction: takes the write lock first, so everything read inside is current. */
export function writeTx(db, fn) {
  try {
    db.exec('BEGIN IMMEDIATE');
  } catch (err) {
    throw wrap(err);
  }
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* the transaction is already gone */
    }
    throw wrap(err);
  }
}

/** A read transaction: several SELECTs see one consistent committed snapshot. */
export function readTx(db, fn) {
  try {
    db.exec('BEGIN');
  } catch (err) {
    throw wrap(err);
  }
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw wrap(err);
  }
}

export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(db, key, value) {
  if (value === null || value === undefined) db.prepare('DELETE FROM meta WHERE key = ?').run(key);
  else db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
