#!/usr/bin/env node
// Chat and checker entry point of the reminder service. Rules: reminders-guide.md.
// Run it through reminders.sh:  bash reminders.sh <command>
// It is a thin command-line face on the shared operations in lib/reminders/ops.mjs, the same
// operations the browser app uses, against the same SQLite database (lib/reminders/paths.mjs).
//
//   list [--json]
//   add    "<text>" [SCHEDULE]        (text "-" = read text from stdin)
//   modify <ID> "<text>"              (text only; the schedule is kept)
//   schedule   <ID> SCHEDULE          (set or replace the schedule)
//   unschedule <ID>                   (stop sending, keep the text)
//   remove <ID>
//   resolve SCHEDULE                  (show what would be saved; writes nothing)
//   now [--tz <Zone>]                 (current date/time in a zone)
//   tz [<Zone>]                       (show / save the confirmed default timezone)
//   due [--run <handle>]              (checker: select due occurrences, mark pending)
//   ack   <ID> <occurrence>           (checker: delivered -> complete / advance)
//   retry <ID> <occurrence>           (reconcile: was NOT delivered -> due again)
//   status [--json]                   (database path, migration stage, counts)
//   backup                            (write a labelled copy of the database to backups/)
//   recover                           (check the database after an interrupted writer)
//
// SCHEDULE:  [--tz <IANA zone>] --at "YYYY-MM-DD HH:MM"                          one-off
//            [--tz <IANA zone>] --rule every:N{m|h|d} [--at "YYYY-MM-DD HH:MM"]  exact duration
//            [--tz <IANA zone>] --rule daily@HH:MM | weekly:MO,WE@HH:MM | monthly:D@HH:MM
//                               [--from YYYY-MM-DD]                              calendar, local time kept
//
// Exit codes: 0 ok, 1 bad input or unusable database, 2 no such ID, 3 database busy,
//             4 ack/retry refused (that occurrence is not pending; nothing changed), 5 edit conflict.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setProjectRoot, dbLocation, project } from './lib/reminders/paths.mjs';
import { ReminderError, EXIT_CODES } from './lib/reminders/errors.mjs';
import { withDb } from './lib/reminders/db.mjs';
import * as ops from './lib/reminders/ops.mjs';

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
setProjectRoot(SELF_DIR);

const USAGE = `usage: reminders.sh list | add "<text>" [SCHEDULE] | modify <ID> "<text>" | schedule <ID> SCHEDULE | unschedule <ID> | remove <ID> | resolve SCHEDULE | now [--tz <Zone>] | tz [<Zone>] | due [--run <handle>] | ack <ID> <occurrence> | retry <ID> <occurrence> | status | backup | recover
SCHEDULE: [--tz <Zone>] --at "YYYY-MM-DD HH:MM" | [--tz <Zone>] --rule every:N{m|h|d} [--at ...] | [--tz <Zone>] --rule daily@HH:MM|weekly:MO,WE@HH:MM|monthly:D@HH:MM [--from YYYY-MM-DD]`;

const out = (line = '') => process.stdout.write(`${line}\n`);
const bad = (message) => {
  throw new ReminderError('invalid', message);
};

function parseSchedule(args) {
  const s = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (i + 1 >= args.length) bad(`option ${key} needs a value`);
    const value = args[i + 1];
    if (key === '--tz') s.tz = value;
    else if (key === '--at') s.at = value;
    else if (key === '--rule') s.rule = value;
    else if (key === '--from') s.from = value;
    else bad(`unknown option '${key}' (expected --tz, --at, --rule, --from)`);
  }
  return s;
}

function readText(raw) {
  return raw === '-' ? fs.readFileSync(0, 'utf8') : raw;
}

function scheduleLines(rec, note) {
  out(`Schedule: ${rec.ruleText}; next due ${rec.nextLocal} (${rec.tz}) = ${rec.nextDue}`);
  if (note) out(note);
}

const summary = (rec) => (rec.state === 'unscheduled' ? 'unscheduled' : `${rec.state}; rule ${rec.rule}; next due ${rec.nextLocal} (${rec.tz})`);

const commands = {
  list(args) {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) bad('usage: reminders.sh list [--json]');
    const data = ops.listReminders();
    if (args[0] === '--json') return out(JSON.stringify(data, null, 2));
    if (data.reminders.length === 0) return out('No reminders saved.');
    for (const r of data.reminders) {
      out(`${r.id}: ${r.text}`);
      if (r.state === 'unscheduled') continue;
      if (r.state === 'completed') out(`    completed (one-off delivered; occurrence ${r.lastDelivered ?? '-'})`);
      else out(`    active; next due ${r.nextLocal} (${r.tz}) = ${r.nextDue}; rule ${r.rule}`);
      if (r.pending && r.pending.uncertain) {
        out(`    DELIVERY UNCERTAIN for occurrence ${r.pending.occurrence} (marked ${r.pending.markedAt}, run ${r.pending.run}): not resent; reconcile with ack or retry`);
      } else if (r.pending) {
        out(`    delivery in progress for occurrence ${r.pending.occurrence} (marked ${r.pending.markedAt}, run ${r.pending.run})`);
      }
    }
  },

  add(args) {
    if (args.length < 1) bad('usage: reminders.sh add "<text>" [SCHEDULE]');
    const text = readText(args[0]);
    const schedule = args.length > 1 ? parseSchedule(args.slice(1)) : undefined;
    const { reminder, note } = ops.createReminder({ text, schedule });
    out(`Added ${reminder.id}: ${reminder.text}`);
    if (schedule) scheduleLines(reminder, note);
    else out('Unscheduled: it is stored as text and will never be sent.');
  },

  modify(args) {
    if (args.length !== 2) bad('usage: reminders.sh modify <ID> "<text>" (text only; use \'schedule\' to change the time)');
    const { reminder, previous } = ops.modifyText(args[0], readText(args[1]));
    out(`Modified ${reminder.id}: ${reminder.text}`);
    out(`(previous text: ${previous.text})`);
    if (reminder.state !== 'unscheduled') out(`Schedule unchanged: ${summary(reminder)}`);
  },

  schedule(args) {
    if (args.length < 3) bad('usage: reminders.sh schedule <ID> SCHEDULE');
    const { reminder, previous, note } = ops.setSchedule(args[0], parseSchedule(args.slice(1)));
    const notes = note ? note.split('\n') : [];
    for (const line of notes.filter((l) => l.includes('was being delivered'))) out(line);
    out(`Scheduled ${reminder.id}: ${reminder.text}`);
    scheduleLines(reminder, notes.filter((l) => !l.includes('was being delivered')).join('\n'));
    out(`(previous schedule: ${summary(previous)})`);
  },

  unschedule(args) {
    if (args.length !== 1) bad('usage: reminders.sh unschedule <ID>');
    const { reminder, previous, changed, note } = ops.unscheduleReminder(args[0]);
    if (!changed) return out(`${reminder.id} has no schedule. Nothing was changed.`);
    if (note) out(note);
    out(`Unscheduled ${reminder.id}: ${reminder.text}`);
    out(`(previous schedule: ${summary(previous)}). It is kept as text and will not be sent.`);
  },

  remove(args) {
    if (args.length !== 1) bad('usage: reminders.sh remove <ID>');
    const { removed, note } = ops.removeReminder(args[0]);
    if (note) out(note);
    out(`Removed ${removed.id}: ${removed.text}`);
    out(`Confirmed: ${removed.id} is no longer in the database. Its ID will not be reused. Nothing further will be sent for it.`);
  },

  resolve(args) {
    if (args.length < 2) bad('usage: reminders.sh resolve SCHEDULE');
    const s = ops.resolveSchedule(parseSchedule(args));
    out('Would save (nothing was written):');
    out(`Schedule: ${s.ruleText}; next due ${s.local} (${s.tz}) = ${s.next}`);
    if (s.note) out(s.note);
  },

  now(args) {
    const s = parseSchedule(args);
    const t = ops.currentTime(s.tz);
    out(`Now: ${t.local} (${t.tz}) = ${t.now}`);
  },

  tz(args) {
    if (args.length > 1) bad('usage: reminders.sh tz [<Zone>]');
    if (args.length === 0) {
      const z = ops.getDefaultTimezone();
      return out(z ? `Default timezone: ${z} (confirmed by the user)` : "Default timezone: not confirmed. Ask the user; never assume the host's timezone.");
    }
    const z = ops.setDefaultTimezone(args[0]);
    out(`Default timezone saved: ${z}. Existing reminders keep the timezone they were saved with.`);
  },

  due(args) {
    let run;
    if (args.length > 0) {
      if (args[0] !== '--run' || args.length !== 2) bad('usage: reminders.sh due [--run <handle>]');
      run = args[1];
    }
    const result = ops.selectDue({ run });
    if (result.items.length === 0) return out('NOTHING_DUE');
    out(`CHECK run=${result.run} now=${result.now}`);
    for (const item of result.items) {
      out(`${item.kind} ${item.id} ${item.occurrence}`);
      out(`MESSAGE ${item.message}`);
    }
    out(`END deliver=${result.items.filter((i) => i.kind === 'DELIVER').length} uncertain=${result.items.filter((i) => i.kind === 'UNCERTAIN').length}`);
  },

  ack(args) {
    if (args.length !== 2) bad('usage: reminders.sh ack <ID> <occurrence>');
    const { reminder, occurrence, already, note } = ops.acknowledge(args[0], args[1]);
    if (already) {
      return out(`Already acknowledged: ${reminder.id} occurrence ${occurrence} (state ${reminder.state}; next due ${reminder.nextLocal}). Nothing was changed.`);
    }
    if (reminder.rule === 'once') out(`Acknowledged ${reminder.id} occurrence ${occurrence}: one-off completed; it will not be sent again.`);
    else {
      out(`Acknowledged ${reminder.id} occurrence ${occurrence}: advanced to ${reminder.nextLocal} (${reminder.tz}) = ${reminder.nextDue}; rule ${reminder.rule}`);
      if (note) out(note);
    }
  },

  retry(args) {
    if (args.length !== 2) bad('usage: reminders.sh retry <ID> <occurrence>');
    const { reminder, occurrence } = ops.retryDelivery(args[0], args[1]);
    out(`Released ${reminder.id} occurrence ${occurrence}: marked not delivered; the next check will send it once (as a late catch-up).`);
  },

  status(args) {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) bad('usage: reminders.sh status [--json]');
    const s = ops.storeStatus();
    if (args[0] === '--json') return out(JSON.stringify(s, null, 2));
    out(`Database: ${s.databasePath}${s.isolated ? '  (ISOLATED TEST DATABASE, not the live store)' : '  (the live store)'}`);
    out(`Schema version: ${s.schemaVersion}; journal mode: ${s.journalMode}`);
    out(`Migration stage: ${s.migrationStage}${s.migrationBackup ? `; Markdown backup: ${s.migrationBackup}` : ''}`);
    out(`Reminders: ${s.counts.total} (active ${s.counts.active}, unscheduled ${s.counts.unscheduled}, completed ${s.counts.completed}; delivery pending ${s.counts.pending})`);
    out(`Next ID: ${s.nextId}; default timezone: ${s.defaultTimezone ?? 'not confirmed'}`);
  },

  backup(args) {
    if (args.length !== 0) bad('usage: reminders.sh backup');
    const loc = dbLocation();
    const dir = loc.isolated ? path.dirname(loc.path) : path.join(project().root, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const dest = path.join(dir, `reminders-backup-${stamp}.db`);
    ops.backupTo(dest);
    out(`Backup written: ${dest}`);
    out('It is a copy for recovery only. Never point the app or reminders.sh at it, and never copy it over the live database without first stopping the app and pausing the checker (reminders-guide.md "Recovery").');
  },

  recover(args) {
    if (args.length !== 0) bad('usage: reminders.sh recover');
    const loc = dbLocation();
    const result = withDb((db) => {
      const rows = db.prepare('PRAGMA integrity_check').all();
      db.exec('BEGIN IMMEDIATE');
      db.exec('ROLLBACK');
      return rows.map((r) => Object.values(r)[0]);
    });
    if (result.length !== 1 || result[0] !== 'ok') {
      throw new ReminderError('store', `integrity check of ${loc.path} failed: ${result.join('; ')}. Do not write to it; restore a backup (reminders-guide.md "Recovery").`);
    }
    out(`Database ${loc.path} opens, passes its integrity check and accepts a write lock.`);
    out('SQLite rolls an interrupted change back by itself: it was either fully saved or not saved at all. List, then repeat the request if it is missing.');
    out("A check interrupted between marking and acknowledging leaves a pending occurrence: see 'list' (it is never resent automatically).");
  },
};

function main() {
  const [command, ...args] = process.argv.slice(2);
  const handler = Object.hasOwn(commands, command ?? '') ? commands[command] : null;
  if (!handler) {
    process.stderr.write(`ERROR: ${USAGE}\n`);
    return 1;
  }
  try {
    if (dbLocation().isolated) process.stderr.write(`(isolated test database: ${dbLocation().path})\n`);
    handler(args);
    return 0;
  } catch (err) {
    if (err instanceof ReminderError) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      if (err.fields) for (const [field, message] of Object.entries(err.fields)) process.stderr.write(`  ${field}: ${message}\n`);
      return EXIT_CODES[err.code] ?? 1;
    }
    process.stderr.write(`ERROR: ${err && err.message ? err.message : err}\n`);
    return 1;
  }
}

process.exitCode = main();
