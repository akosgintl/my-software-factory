#!/usr/bin/env node
// One-time migration of the Markdown reminder store (REMINDERS.md) into the SQLite database.
// Staged, verifiable and safe to retry. After the switch it refuses to import again: the live
// store is then SQLite, and a historical backup must never be laid over newer edits or removals.
//
//   node scripts/migrate-from-markdown.mjs status
//   node scripts/migrate-from-markdown.mjs inspect            parse the source, print what would be preserved
//   node scripts/migrate-from-markdown.mjs backup             copy the source, byte for byte, into the labelled backup folder
//   node scripts/migrate-from-markdown.mjs import             create the database if needed and import (no duplicates on retry)
//   node scripts/migrate-from-markdown.mjs verify             compare every source value with the database
//   node scripts/migrate-from-markdown.mjs switch             retire REMINDERS.md from the project root (the backup stays)
//   node scripts/migrate-from-markdown.mjs complete [--checker-job <id>]   record that the checker job uses the database
//
// Options (tests only): --source <file>  --backup-dir <dir>   and the REMINDERS_DB environment variable.
//
// Stages recorded in the database (meta.migration_stage): none -> imported -> switched -> complete.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setProjectRoot, dbLocation, project } from '../lib/reminders/paths.mjs';
import { withDb, writeTx, readTx, getMeta, setMeta } from '../lib/reminders/db.mjs';
import { normalizeZone, ISO_RE, CALENDAR_RULE_RE, DURATION_RULE_RE } from '../lib/reminders/time.mjs';
import { formatId } from '../lib/reminders/format.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
setProjectRoot(ROOT);

const BACKUP_LABEL = `HISTORICAL BACKUP - NOT THE LIVE STORE

This folder holds the Markdown-era reminder store exactly as it was when the service moved to
SQLite. The live reminders are in the database named in reminders-guide.md ("Paths").

- REMINDERS.md              byte-for-byte copy of the old store (see SHA256 below)
- reminders.sh.markdown-era the old reader/writer for that file (if present)
- reminders-time.ps1        its timezone helper (if present)

Do not import this file again and do not copy it back into the project root: reminders added,
changed or removed since the migration exist only in the database, and a second writable store
would split the service. It is kept for audit and for the recovery route in reminders-guide.md.
`;

const fail = (message, code = 1) => {
  const err = new Error(message);
  err.exitCode = code;
  throw err;
};

function parseArgs(argv) {
  const options = { source: path.join(ROOT, 'REMINDERS.md'), backupDir: path.join(ROOT, 'backups', 'markdown-store-pre-sqlite'), checkerJob: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') options.source = path.resolve(argv[++i]);
    else if (argv[i] === '--backup-dir') options.backupDir = path.resolve(argv[++i]);
    else if (argv[i] === '--checker-job') options.checkerJob = argv[++i];
    else rest.push(argv[i]);
  }
  return { command: rest[0] ?? 'status', options };
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const dash = (v) => (v === undefined || v === '-' || v === '' ? null : v);

/** Parses the Markdown store. Refuses anything it does not understand instead of dropping it. */
export function parseMarkdownStore(content) {
  const lines = content.replace(/\r/g, '').split('\n');
  const problems = [];
  let nextId = null;
  let defaultTimezone = null;
  const records = new Map();
  let inRecords = false;
  lines.forEach((line, index) => {
    const where = `line ${index + 1}`;
    let m;
    if ((m = /^Next ID: R-(\d+)$/.exec(line))) nextId = Number(m[1]);
    else if ((m = /^Default timezone: (.+)$/.exec(line))) {
      if (/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(m[1])) defaultTimezone = m[1];
    } else if (/^## Records\s*$/.test(line)) inRecords = true;
    else if ((m = /^- R-(\d+): (.*)$/.exec(line))) {
      const n = Number(m[1]);
      if (records.has(n)) problems.push(`${where}: duplicate reminder ${formatId(n)}`);
      else if (m[2].trim() === '') problems.push(`${where}: ${formatId(n)} has empty text`);
      else records.set(n, { n, text: m[2], state: 'unscheduled', tz: null, rule: null, next: null, local: null, pending: null, prun: null, pmarked: null, pnote: null, last: null, acked: null, hasSchedule: false });
    } else if ((m = /^ {2}~ R-(\d+) \|(.*)$/.exec(line))) {
      const n = Number(m[1]);
      const rec = records.get(n);
      if (!rec) return problems.push(`${where}: schedule line for ${formatId(n)} without its reminder line`);
      if (rec.hasSchedule) return problems.push(`${where}: second schedule line for ${formatId(n)}`);
      const f = {};
      for (const part of m[2].split('|')) {
        const p = part.trim();
        const eq = p.indexOf('=');
        if (eq > 0) f[p.slice(0, eq)] = p.slice(eq + 1);
      }
      rec.hasSchedule = true;
      rec.state = f.state;
      rec.tz = dash(f.tz);
      rec.rule = dash(f.rule);
      rec.next = dash(f.next);
      rec.local = dash(f.local);
      rec.pending = dash(f.pending);
      rec.prun = dash(f.prun);
      rec.pmarked = dash(f.pmarked);
      rec.pnote = dash(f.pnote);
      rec.last = dash(f.last);
      rec.acked = dash(f.acked);
      const id = formatId(n);
      if (!['active', 'completed'].includes(rec.state)) problems.push(`${where}: ${id} has unknown state '${f.state}'`);
      if (!rec.rule || !(rec.rule === 'once' || CALENDAR_RULE_RE.test(rec.rule) || DURATION_RULE_RE.test(rec.rule))) problems.push(`${where}: ${id} has unknown rule '${f.rule}'`);
      try {
        normalizeZone(rec.tz);
      } catch (err) {
        problems.push(`${where}: ${id}: ${err.message}`);
      }
      for (const key of ['next', 'pending', 'pmarked', 'last', 'acked']) {
        if (rec[key] !== null && !ISO_RE.test(rec[key])) problems.push(`${where}: ${id} ${key}='${rec[key]}' is not a UTC instant`);
      }
      if (rec.state === 'active' && rec.next === null) problems.push(`${where}: ${id} is active without a next due instant`);
      if (rec.state === 'completed' && rec.rule !== 'once') problems.push(`${where}: ${id} is completed but not a one-off`);
      if (rec.pending === null) rec.prun = rec.pmarked = rec.pnote = null;
    } else if (inRecords && line.trim() !== '') {
      problems.push(`${where}: unrecognised line under "## Records": ${line}`);
    }
  });
  if (nextId === null) problems.push("the store has no 'Next ID: R-NNNN' line");
  return { nextId, defaultTimezone, records: [...records.values()].sort((a, b) => a.n - b.n), problems };
}

function readSource(options) {
  if (!fs.existsSync(options.source)) fail(`source ${options.source} does not exist. If the migration already switched, the live store is the database; there is nothing to import.`);
  const buffer = fs.readFileSync(options.source);
  const parsed = parseMarkdownStore(buffer.toString('utf8'));
  if (parsed.problems.length) fail(`the source cannot be imported safely:\n  ${parsed.problems.join('\n  ')}\nNothing was changed.`);
  return { buffer, hash: sha256(buffer), ...parsed };
}

function describe(rec) {
  if (rec.state === 'unscheduled') return `${formatId(rec.n)} | unscheduled | ${rec.text}`;
  return `${formatId(rec.n)} | ${rec.state} | tz=${rec.tz} | rule=${rec.rule} | next=${rec.next ?? '-'} | local=${rec.local ?? '-'} | pending=${rec.pending ?? '-'} | last=${rec.last ?? '-'} | acked=${rec.acked ?? '-'} | ${rec.text}`;
}

const SOURCE_TO_COLUMN = { text: 'text', state: 'state', tz: 'tz', rule: 'rule', next: 'next_due', local: 'next_local', pending: 'pending', prun: 'prun', pmarked: 'pmarked', pnote: 'pnote', last: 'last', acked: 'acked' };

function differences(rec, row) {
  const diffs = [];
  for (const [key, column] of Object.entries(SOURCE_TO_COLUMN)) {
    const want = key === 'tz' && rec.tz ? normalizeZone(rec.tz) : rec[key];
    if ((want ?? null) !== (row[column] ?? null)) diffs.push(`${key}: source '${want ?? '-'}' / database '${row[column] ?? '-'}'`);
  }
  return diffs;
}

const stageOf = () => {
  if (!fs.existsSync(dbLocation().path)) return 'none';
  return withDb((db) => getMeta(db, 'migration_stage') ?? 'none');
};

const commands = {
  status(options) {
    const loc = dbLocation();
    console.log(`Database: ${loc.path}${loc.isolated ? ' (isolated test database)' : ''} - ${fs.existsSync(loc.path) ? 'exists' : 'not created yet'}`);
    console.log(`Migration stage: ${stageOf()}`);
    console.log(`Markdown source: ${options.source} - ${fs.existsSync(options.source) ? 'present' : 'absent'}`);
    console.log(`Backup folder: ${options.backupDir} - ${fs.existsSync(path.join(options.backupDir, 'REMINDERS.md')) ? 'holds a backup' : 'no backup yet'}`);
  },

  inspect(options) {
    const src = readSource(options);
    console.log(`Source: ${options.source}  (sha256 ${src.hash})`);
    console.log(`Next ID: ${formatId(src.nextId)}; default timezone: ${src.defaultTimezone ?? '(not confirmed)'}`);
    const count = (s) => src.records.filter((r) => r.state === s).length;
    console.log(`Records: ${src.records.length} (active ${count('active')}, completed ${count('completed')}, unscheduled ${count('unscheduled')}; pending delivery ${src.records.filter((r) => r.pending).length})`);
    for (const rec of src.records) console.log(`  ${describe(rec)}`);
  },

  backup(options) {
    const src = readSource(options);
    fs.mkdirSync(options.backupDir, { recursive: true });
    const target = path.join(options.backupDir, 'REMINDERS.md');
    if (fs.existsSync(target)) {
      const existing = sha256(fs.readFileSync(target));
      if (existing !== src.hash) fail(`a different backup already exists at ${target} (sha256 ${existing}; source is ${src.hash}). Nothing was overwritten; inspect both before continuing.`);
      console.log(`Backup already present and identical: ${target}`);
    } else {
      fs.copyFileSync(options.source, target, fs.constants.COPYFILE_EXCL);
      if (sha256(fs.readFileSync(target)) !== src.hash) fail('the backup copy does not match the source');
      console.log(`Backup written: ${target}`);
    }
    fs.writeFileSync(path.join(options.backupDir, 'README.md'), `${BACKUP_LABEL}\nSHA256 of REMINDERS.md: ${src.hash}\nBacked up from: ${options.source}\n`);
    console.log(`sha256 ${src.hash}`);
  },

  import(options) {
    const src = readSource(options);
    const backupFile = path.join(options.backupDir, 'REMINDERS.md');
    if (!fs.existsSync(backupFile) || sha256(fs.readFileSync(backupFile)) !== src.hash) fail('no matching backup of the source exists yet. Run the "backup" step first.');
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const result = withDb(
      (db) =>
        writeTx(db, () => {
          const stage = getMeta(db, 'migration_stage') ?? 'none';
          if (stage === 'switched' || stage === 'complete') {
            fail(`the migration stage is '${stage}': SQLite is the live store. Importing the historical Markdown file again is refused, because it would overwrite newer edits or restore removed reminders.`);
          }
          let inserted = 0;
          let unchanged = 0;
          const conflicts = [];
          const insert = db.prepare(
            `INSERT INTO reminders (n, text, state, tz, rule, next_due, next_local, pending, prun, pmarked, pnote, last, acked, destination, rev, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'checker-chat', 1, ?, ?)`,
          );
          for (const rec of src.records) {
            const row = db.prepare('SELECT * FROM reminders WHERE n = ?').get(rec.n);
            if (row) {
              const diffs = differences(rec, row);
              if (diffs.length) conflicts.push(`${formatId(rec.n)}: ${diffs.join('; ')}`);
              else unchanged++;
              continue;
            }
            insert.run(rec.n, rec.text, rec.state, rec.tz ? normalizeZone(rec.tz) : null, rec.rule, rec.next, rec.local, rec.pending, rec.prun, rec.pmarked, rec.pnote, rec.last, rec.acked, stamp, stamp);
            inserted++;
          }
          if (conflicts.length) fail(`these IDs already exist in the database with different values; nothing was imported:\n  ${conflicts.join('\n  ')}`);
          const maxN = db.prepare('SELECT MAX(n) AS m FROM reminders').get().m ?? 0;
          const nextId = Math.max(Number(getMeta(db, 'next_id') ?? 1), src.nextId, maxN + 1);
          setMeta(db, 'next_id', nextId);
          if (src.defaultTimezone && !getMeta(db, 'default_timezone')) setMeta(db, 'default_timezone', normalizeZone(src.defaultTimezone));
          setMeta(db, 'migration_stage', 'imported');
          setMeta(db, 'migration_source', options.source);
          setMeta(db, 'migration_source_sha256', src.hash);
          setMeta(db, 'migration_backup', options.backupDir);
          if (!getMeta(db, 'migration_imported_at')) setMeta(db, 'migration_imported_at', stamp);
          return { inserted, unchanged, nextId };
        }),
      { create: true },
    );
    console.log(`Imported into ${dbLocation().path}: ${result.inserted} inserted, ${result.unchanged} already present and identical (no duplicates). Next ID: ${formatId(result.nextId)}.`);
    console.log("Stage: imported. Next: 'verify', then 'switch'.");
  },

  verify(options) {
    const stage = stageOf();
    if (stage === 'none') fail("nothing has been imported yet. Run 'import' first.");
    if (stage !== 'imported') fail(`the migration stage is '${stage}': the database is live and may rightly differ from the historical file. Verification against the source is only meaningful before the switch.`);
    const src = readSource(options);
    const report = withDb((db) =>
      readTx(db, () => {
        const lines = [];
        let bad = 0;
        const seen = new Set();
        for (const rec of src.records) {
          seen.add(rec.n);
          const row = db.prepare('SELECT * FROM reminders WHERE n = ?').get(rec.n);
          const diffs = row ? differences(rec, row) : ['missing from the database'];
          if (diffs.length) bad++;
          lines.push(`  ${diffs.length ? 'DIFF' : 'OK  '} ${describe(rec)}${diffs.length ? `\n         ${diffs.join('\n         ')}` : ''}`);
        }
        for (const row of db.prepare('SELECT n FROM reminders ORDER BY n').all()) {
          if (!seen.has(row.n)) {
            bad++;
            lines.push(`  DIFF ${formatId(row.n)} is in the database but not in the source`);
          }
        }
        const dbNext = Number(getMeta(db, 'next_id'));
        if (dbNext < src.nextId) {
          bad++;
          lines.push(`  DIFF Next ID: source ${formatId(src.nextId)} / database ${formatId(dbNext)} (must not be lower)`);
        } else lines.push(`  OK   Next ID: source ${formatId(src.nextId)} / database ${formatId(dbNext)}`);
        const dbTz = getMeta(db, 'default_timezone');
        const srcTz = src.defaultTimezone ? normalizeZone(src.defaultTimezone) : null;
        if (srcTz !== dbTz) {
          bad++;
          lines.push(`  DIFF Default timezone: source ${srcTz ?? '(not confirmed)'} / database ${dbTz ?? '(not confirmed)'}`);
        } else lines.push(`  OK   Default timezone: ${dbTz ?? '(not confirmed)'}`);
        return { lines, bad };
      }),
    );
    console.log(`Verifying ${src.records.length} source record(s) against ${dbLocation().path}:`);
    for (const line of report.lines) console.log(line);
    if (report.bad) fail(`${report.bad} difference(s). The migration must not switch until they are resolved.`);
    console.log('VERIFIED: every ID, text, state, timezone, rule, next occurrence and delivery state matches the source.');
  },

  switch(options) {
    const stage = stageOf();
    if (stage === 'switched' || stage === 'complete') {
      // A retry after an interruption between recording the stage and retiring the file.
      const kept = path.join(options.backupDir, 'REMINDERS.md');
      if (fs.existsSync(options.source) && fs.existsSync(kept) && sha256(fs.readFileSync(options.source)) === sha256(fs.readFileSync(kept))) {
        fs.rmSync(options.source);
        return console.log(`Already switched (stage '${stage}'); retired the leftover ${options.source} (identical to its backup).`);
      }
      return console.log(`Already switched (stage '${stage}'). Nothing to do.`);
    }
    commands.verify(options);
    const src = readSource(options);
    const backupFile = path.join(options.backupDir, 'REMINDERS.md');
    if (sha256(fs.readFileSync(backupFile)) !== src.hash) fail('the backup no longer matches the source; refusing to retire the source.');
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    withDb((db) =>
      writeTx(db, () => {
        setMeta(db, 'migration_stage', 'switched');
        setMeta(db, 'migration_switched_at', stamp);
      }),
    );
    fs.rmSync(options.source);
    console.log(`Switched: ${options.source} retired (its byte-identical copy stays in ${options.backupDir}).`);
    console.log("Stage: switched. The database is now the only live store. Remaining step: the controller recreates the reminder checker job with the database prompt, then runs 'complete'.");
  },

  complete(options) {
    const stage = stageOf();
    if (stage === 'complete') return console.log("Already complete. Nothing to do.");
    if (stage !== 'switched') fail(`the migration stage is '${stage}', not 'switched'.`);
    withDb((db) =>
      writeTx(db, () => {
        setMeta(db, 'migration_stage', 'complete');
        setMeta(db, 'migration_completed_at', new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
        if (options.checkerJob) setMeta(db, 'migration_checker_job', options.checkerJob);
      }),
    );
    console.log('Stage: complete. Chat, browser and the reminder checker all use the database.');
  },
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { command, options } = parseArgs(process.argv.slice(2));
  try {
    if (!Object.hasOwn(commands, command)) fail(`unknown command '${command}'. Commands: ${Object.keys(commands).join(', ')}`);
    void project();
    commands[command](options);
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exitCode = err.exitCode ?? 1;
  }
}
