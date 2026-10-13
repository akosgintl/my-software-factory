// Checks of the shared reminder operations, the chat/checker command and the Markdown migration.
// Everything runs against scratch databases (REMINDERS_DB) with a test clock; the live database is
// never opened.   Run:  npm test   (node --test tests/unit/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setProjectRoot, dbLocation } from '../../lib/reminders/paths.mjs';
import { openDatabase } from '../../lib/reminders/db.mjs';
import * as ops from '../../lib/reminders/ops.mjs';
import { ReminderError } from '../../lib/reminders/errors.mjs';
import { emptyForm, formFromRecord, scheduleFromForm, scheduleKey } from '../../lib/reminders/form.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
setProjectRoot(ROOT);
const CLI = path.join(ROOT, 'reminders-cli.mjs');
const MIGRATE = path.join(ROOT, 'scripts', 'migrate-from-markdown.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reminders-unit-'));
let counter = 0;

before(() => {
  delete process.env.REMINDERS_PENDING_GRACE;
});
after(() => {
  delete process.env.REMINDERS_DB;
  delete process.env.REMINDERS_TEST_NOW;
  fs.rmSync(TMP, { recursive: true, force: true });
});

/** A fresh scratch database with the clock at `now`. */
function fresh(now = '2026-10-13T10:00:00Z', { tz = 'Europe/Budapest' } = {}) {
  const file = path.join(TMP, `t${++counter}.db`);
  process.env.REMINDERS_DB = file;
  process.env.REMINDERS_TEST_NOW = now;
  openDatabase({ create: true }).close();
  if (tz) ops.setDefaultTimezone(tz);
  return file;
}
const at = (iso) => {
  process.env.REMINDERS_TEST_NOW = iso;
};
const cli = (...args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: process.env });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const cliAsync = (...args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) => resolve({ code, out, err }));
  });
const refuses = (fn, code, pattern, field) =>
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ReminderError, `expected a ReminderError, got ${err}`);
    assert.equal(err.code, code);
    if (pattern) assert.match(err.message, pattern);
    if (field) assert.equal(err.field, field);
    return true;
  });
const ids = () => ops.listReminders().reminders.map((r) => r.id);

test('isolation: tests use a scratch database and the test clock is refused for the live one', () => {
  fresh();
  assert.equal(dbLocation().isolated, true);
  const saved = process.env.REMINDERS_DB;
  delete process.env.REMINDERS_DB;
  try {
    assert.equal(dbLocation().isolated, false);
    assert.equal(dbLocation().path, path.join(ROOT, 'data', 'reminders.db'));
    refuses(() => ops.nowEpoch(), 'invalid', /test clock and is refused for the canonical database/);
  } finally {
    process.env.REMINDERS_DB = saved;
  }
});

test('a missing database is an error, never silently recreated', () => {
  process.env.REMINDERS_DB = path.join(TMP, 'does-not-exist.db');
  refuses(() => ops.listReminders(), 'store', /is missing\. It is not recreated automatically/);
  assert.equal(fs.existsSync(process.env.REMINDERS_DB), false);
});

test('create: IDs only go up and a removed ID is never reused', () => {
  fresh();
  const a = ops.createReminder({ text: 'SYNTHETIC a' }).reminder;
  const b = ops.createReminder({ text: 'SYNTHETIC b' }).reminder;
  assert.deepEqual([a.id, b.id], ['R-0001', 'R-0002']);
  assert.equal(a.state, 'unscheduled');
  ops.removeReminder(b.id);
  assert.equal(ops.createReminder({ text: 'SYNTHETIC c' }).reminder.id, 'R-0003');
  assert.deepEqual(ids(), ['R-0001', 'R-0003']);
  refuses(() => ops.removeReminder('R-0002'), 'not_found', /no reminder with ID R-0002/);
  assert.equal(ops.getReminder('r-1').id, 'R-0001');
  assert.equal(ops.getReminder('3').id, 'R-0003');
  refuses(() => ops.getReminder('abc'), 'invalid', /not a reminder ID/);
});

test('text: one line, trimmed; empty and over-long text is refused and nothing is saved', () => {
  fresh();
  assert.equal(ops.createReminder({ text: '  SYNTHETIC  line one\r\n\tline two  ' }).reminder.text, 'SYNTHETIC line one line two');
  const odd = 'SYNTHETIC "Sam" owes $50 `x` \\n árvíztűrő tükörfúrógép <b>&amp;</b>';
  assert.equal(ops.createReminder({ text: odd }).reminder.text, odd);
  refuses(() => ops.createReminder({ text: ' \n\t ' }), 'invalid', /text is empty/, 'text');
  refuses(() => ops.createReminder({ text: 'x'.repeat(2001) }), 'invalid', /limit is 2000/, 'text');
  refuses(() => ops.modifyText('R-0001', ''), 'invalid', /text is empty/, 'text');
  assert.equal(ops.listReminders().reminders.length, 2);
  assert.equal(ops.createReminder({ text: 'x'.repeat(2000) }).reminder.text.length, 2000);
});

test('schedule validation: every refusal names its field and saves nothing', () => {
  fresh('2026-10-13T10:00:00Z', { tz: null });
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { at: '2026-10-14 09:00' } }), 'invalid', /no timezone/, 'tz');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz: 'Mars/Olympus', at: '2026-10-14 09:00' } }), 'invalid', /unknown timezone/, 'tz');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz: 'CET', at: '2026-10-14 09:00' } }), 'invalid', /not an IANA timezone name/, 'tz');
  const tz = 'Europe/Budapest';
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, at: '2026-10-13 11:59' } }), 'invalid', /not in the future/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, at: '14/10/2026 9am' } }), 'invalid', /YYYY-MM-DD HH:MM/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, at: '2027-02-30 09:00' } }), 'invalid', /not a real calendar date/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, at: '2026-10-14 24:00' } }), 'invalid', /not a time/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz } }), 'invalid', /one-off needs a date and time/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, rule: 'yearly@09:00' } }), 'invalid', /unsupported rule/, 'rule');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, rule: 'weekly:XX@09:00' } }), 'invalid', /calendar rule must be/, 'rule');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, rule: 'every:0m' } }), 'invalid', /duration rule must be/, 'rule');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, rule: 'every:30s' } }), 'invalid', /duration rule must be/, 'rule');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, rule: 'daily@09:00', at: '2026-10-14 09:00' } }), 'invalid', /take their time from the rule/, 'at');
  refuses(() => ops.createReminder({ text: 'SYNTHETIC', schedule: { tz, at: '2026-10-14 09:00', from: '2026-10-14' } }), 'invalid', /only for daily\/weekly\/monthly/, 'from');
  assert.equal(ops.listReminders().reminders.length, 0);
  assert.equal(ops.listReminders().nextId, 'R-0001', 'a refused create does not consume an ID');
  assert.equal(ops.createReminder({ text: 'SYNTHETIC', schedule: { tz: 'europe/budapest', at: '2026-10-14 09:00' } }).reminder.tz, 'Europe/Budapest');
});

test('timezones: saved with the reminder, shown with offset; a default applies only when none is given', () => {
  fresh();
  const a = ops.createReminder({ text: 'SYNTHETIC', schedule: { at: '2026-10-14 09:00' } }).reminder;
  assert.deepEqual([a.tz, a.nextDue, a.nextLocal, a.rule, a.state], ['Europe/Budapest', '2026-10-14T07:00:00Z', 'Wed 2026-10-14 09:00 +02:00', 'once', 'active']);
  const b = ops.createReminder({ text: 'SYNTHETIC', schedule: { tz: 'America/New_York', at: '2026-10-14 09:00' } }).reminder;
  assert.deepEqual([b.tz, b.nextDue, b.nextLocal], ['America/New_York', '2026-10-14T13:00:00Z', 'Wed 2026-10-14 09:00 -04:00']);
  ops.setDefaultTimezone('Asia/Tokyo');
  assert.equal(ops.getReminder(a.id).tz, 'Europe/Budapest', 'a new default does not change existing reminders');
  refuses(() => ops.setDefaultTimezone('Nowhere/Land'), 'invalid', /unknown timezone/, 'tz');
  assert.equal(ops.getDefaultTimezone(), 'Asia/Tokyo');
});

test('clock changes: a missing local time moves forward, a repeated one uses its first passage, both are disclosed', () => {
  fresh();
  const gap = ops.resolveSchedule({ at: '2027-03-28 02:30' });
  assert.deepEqual([gap.next, gap.local, gap.flag], ['2027-03-28T01:30:00Z', 'Sun 2027-03-28 03:30 +02:00', 'missing']);
  assert.match(gap.note, /does not exist on that date in Europe\/Budapest/);
  const twice = ops.createReminder({ text: 'SYNTHETIC', schedule: { at: '2026-10-25 02:30' } });
  assert.deepEqual([twice.reminder.nextDue, twice.reminder.nextLocal], ['2026-10-25T00:30:00Z', 'Sun 2026-10-25 02:30 +02:00']);
  assert.match(twice.note, /happens twice/);
  assert.equal(ops.listReminders().reminders.length, 1, 'resolve writes nothing');
});

test('modify: text and schedule change independently; other records and IDs are untouched', () => {
  fresh();
  const keep = ops.createReminder({ text: 'SYNTHETIC untouched', schedule: { rule: 'daily@07:00' } }).reminder;
  const r = ops.createReminder({ text: 'SYNTHETIC first', schedule: { rule: 'weekly:MO@08:30' } }).reminder;
  const renamed = ops.modifyText(r.id, 'SYNTHETIC second');
  assert.equal(renamed.reminder.text, 'SYNTHETIC second');
  assert.deepEqual([renamed.reminder.rule, renamed.reminder.nextDue, renamed.reminder.id], [r.rule, r.nextDue, r.id]);
  assert.equal(renamed.previous.text, 'SYNTHETIC first');
  const moved = ops.setSchedule(r.id, { tz: 'America/New_York', rule: 'monthly:31@08:00' }).reminder;
  assert.deepEqual([moved.text, moved.tz, moved.rule, moved.nextLocal], ['SYNTHETIC second', 'America/New_York', 'monthly:31@08:00', 'Sat 2026-10-31 08:00 -04:00']);
  const both = ops.updateReminder(r.id, { text: 'SYNTHETIC third', schedule: { at: '2026-10-20 10:00' } }).reminder;
  assert.deepEqual([both.text, both.rule, both.tz, both.nextDue], ['SYNTHETIC third', 'once', 'Europe/Budapest', '2026-10-20T08:00:00Z']);
  refuses(() => ops.updateReminder(r.id, { text: 'SYNTHETIC fourth', schedule: { at: '2020-01-01 10:00' } }), 'invalid', /not in the future/);
  assert.equal(ops.getReminder(r.id).text, 'SYNTHETIC third', 'a refused change saves no part of it');
  assert.deepEqual(ops.getReminder(keep.id), keep);
});

test('stop sending (unschedule) keeps the text and drops the schedule; remove deletes', () => {
  fresh();
  const r = ops.createReminder({ text: 'SYNTHETIC', schedule: { rule: 'daily@07:00' } }).reminder;
  const stopped = ops.unscheduleReminder(r.id);
  assert.equal(stopped.changed, true);
  assert.deepEqual([stopped.reminder.state, stopped.reminder.rule, stopped.reminder.tz, stopped.reminder.nextDue, stopped.reminder.text], ['unscheduled', null, null, null, 'SYNTHETIC']);
  assert.equal(ops.unscheduleReminder(r.id).changed, false);
  at('2026-10-20T10:00:00Z');
  assert.deepEqual(ops.selectDue().items, [], 'an unscheduled reminder is never due');
  assert.equal(ops.removeReminder(r.id).removed.id, r.id);
  assert.deepEqual(ids(), []);
});

test('lost edits are prevented: a change based on an old revision is refused and nothing is written', () => {
  fresh();
  const r = ops.createReminder({ text: 'SYNTHETIC original', schedule: { rule: 'daily@07:00' } }).reminder;
  assert.equal(r.rev, 1);
  const chat = ops.modifyText(r.id, 'SYNTHETIC changed in chat').reminder; // chat does not pass a revision
  assert.equal(chat.rev, 2);
  refuses(() => ops.updateReminder(r.id, { text: 'SYNTHETIC browser overwrite' }, { expectedRev: 1 }), 'conflict', /changed somewhere else/);
  refuses(() => ops.removeReminder(r.id, { expectedRev: 1 }), 'conflict');
  refuses(() => ops.unscheduleReminder(r.id, { expectedRev: 1 }), 'conflict');
  try {
    ops.updateReminder(r.id, { text: 'x' }, { expectedRev: 1 });
  } catch (err) {
    assert.equal(err.current.text, 'SYNTHETIC changed in chat', 'the refusal carries the current record');
  }
  assert.deepEqual(ops.getReminder(r.id), chat);
  assert.equal(ops.updateReminder(r.id, { text: 'SYNTHETIC browser, based on rev 2' }, { expectedRev: 2 }).reminder.rev, 3);
  // delivery progress alone does not invalidate an edit in progress
  at('2026-10-14T05:00:10Z');
  const due = ops.selectDue({ run: 't' });
  ops.acknowledge(r.id, due.items[0].occurrence);
  assert.equal(ops.getReminder(r.id).rev, 3);
  assert.equal(ops.updateReminder(r.id, { text: 'SYNTHETIC after a delivery' }, { expectedRev: 3 }).reminder.text, 'SYNTHETIC after a delivery');
});

test('one-off delivery: selected once, completed only after the acknowledgement, never sent again', () => {
  fresh();
  const r = ops.createReminder({ text: 'SYNTHETIC one-off', schedule: { at: '2026-10-13 12:30' } }).reminder;
  assert.deepEqual(ops.selectDue().items, [], 'not due yet');
  at('2026-10-13T10:30:20Z');
  const due = ops.selectDue({ run: 'run one' });
  assert.equal(due.run, 'run_one');
  assert.deepEqual(due.items, [{ kind: 'DELIVER', id: r.id, occurrence: '2026-10-13T10:30:00Z', message: `Reminder ${r.id}: SYNTHETIC one-off  (due Tue 2026-10-13 12:30 +02:00 Europe/Budapest; one-off)` }]);
  const pending = ops.getReminder(r.id);
  assert.deepEqual([pending.state, pending.pending.occurrence, pending.pending.uncertain], ['active', '2026-10-13T10:30:00Z', false]);
  assert.deepEqual(ops.selectDue({ run: 'overlap' }).items, [], 'a second check cannot select the same occurrence');
  const ack = ops.acknowledge(r.id, '2026-10-13T10:30:00Z');
  assert.deepEqual([ack.reminder.state, ack.reminder.nextDue, ack.reminder.pending, ack.reminder.lastDelivered, ack.already], ['completed', null, null, '2026-10-13T10:30:00Z', false]);
  assert.equal(ops.acknowledge(r.id, '2026-10-13T10:30:00Z').already, true, 'a repeated acknowledgement changes nothing');
  at('2026-10-20T10:00:00Z');
  assert.deepEqual(ops.selectDue().items, []);
  const again = ops.setSchedule(r.id, { at: '2026-10-21 09:00' }).reminder;
  assert.deepEqual([again.state, again.lastDelivered], ['active', '2026-10-13T10:30:00Z'], 'rescheduling reactivates a completed one-off');
});

test('uncertain delivery: reported once, never resent automatically, reconciled by ack or retry', () => {
  fresh();
  const r = ops.createReminder({ text: 'SYNTHETIC uncertain', schedule: { rule: 'every:1h', at: '2026-10-13 12:30' } }).reminder;
  at('2026-10-13T10:30:05Z');
  assert.equal(ops.selectDue({ run: 'crashed' }).items[0].kind, 'DELIVER');
  at('2026-10-13T10:31:00Z');
  assert.deepEqual(ops.selectDue().items, [], 'inside the grace period it is simply in progress');
  at('2026-10-13T10:32:05Z');
  const report = ops.selectDue({ run: 'later' });
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].kind, 'UNCERTAIN');
  assert.match(report.items[0].message, /Delivery uncertain for reminder R-0001: "SYNTHETIC uncertain".*It has NOT been resent\./);
  assert.equal(ops.getReminder(r.id).pending.uncertain, true);
  at('2026-10-13T12:00:00Z');
  assert.deepEqual(ops.selectDue().items, [], 'reported once only; a recurring reminder does not advance while pending');
  refuses(() => ops.retryDelivery(r.id, '2026-10-13T11:30:00Z'), 'refused', /is not pending/);
  ops.retryDelivery(r.id, '2026-10-13T10:30:00Z');
  const resend = ops.selectDue({ run: 'retry' });
  assert.match(resend.items[0].message, /LATE by 1h 30m - catch-up/);
  const ack = ops.acknowledge(r.id, '2026-10-13T10:30:00Z');
  assert.equal(ack.reminder.nextDue, '2026-10-13T12:30:00Z', 'the duration rule stays on its original grid after catch-up');
});

test('recurrence: calendar rules keep local time across a clock change; next is computed from the saved occurrence', () => {
  fresh('2026-10-23T10:00:00Z');
  const r = ops.createReminder({ text: 'SYNTHETIC daily', schedule: { rule: 'daily@08:00' } }).reminder;
  assert.equal(r.nextDue, '2026-10-24T06:00:00Z');
  at('2026-10-24T06:00:30Z');
  ops.selectDue();
  assert.equal(ops.acknowledge(r.id, '2026-10-24T06:00:00Z').reminder.nextDue, '2026-10-25T07:00:00Z', '08:00 local after clocks went back is 07:00Z');
  at('2026-10-27T12:00:00Z'); // two occurrences missed during downtime
  const late = ops.selectDue();
  assert.equal(late.items.length, 1, 'one catch-up message however many occurrences were missed');
  assert.match(late.items[0].message, /LATE by 2d 5h 0m - catch-up/);
  const next = ops.acknowledge(r.id, '2026-10-25T07:00:00Z').reminder;
  assert.deepEqual([next.nextDue, next.nextLocal], ['2026-10-28T07:00:00Z', 'Wed 2026-10-28 08:00 +01:00']);
});

test('recurrence: weekly, monthly (last day of shorter months) and exact durations', () => {
  fresh('2027-01-30T10:00:00Z');
  const monthly = ops.createReminder({ text: 'SYNTHETIC monthly', schedule: { rule: 'monthly:31@08:00' } }).reminder;
  assert.equal(monthly.nextLocal, 'Sun 2027-01-31 08:00 +01:00');
  at('2027-01-31T07:00:10Z');
  ops.selectDue();
  assert.equal(ops.acknowledge(monthly.id, '2027-01-31T07:00:00Z').reminder.nextLocal, 'Sun 2027-02-28 08:00 +01:00');

  const weekly = ops.createReminder({ text: 'SYNTHETIC weekly', schedule: { tz: 'America/New_York', rule: 'weekly:MO,FR@08:30', from: '2027-03-01' } }).reminder;
  assert.equal(weekly.nextLocal, 'Mon 2027-03-01 08:30 -05:00');
  at('2027-03-01T13:30:05Z');
  ops.selectDue();
  assert.equal(ops.acknowledge(weekly.id, '2027-03-01T13:30:00Z').reminder.nextLocal, 'Fri 2027-03-05 08:30 -05:00');

  const every = ops.createReminder({ text: 'SYNTHETIC every', schedule: { rule: 'every:90m' } }).reminder;
  assert.equal(every.nextDue, '2027-03-01T15:00:05Z', 'without a first time, one duration from now');
  at('2027-03-01T18:10:00Z'); // two periods missed
  const due = ops.selectDue().items.find((i) => i.id === every.id);
  assert.equal(ops.acknowledge(every.id, due.occurrence).reminder.nextDue, '2027-03-01T19:30:05Z', 'advances by whole durations from the saved occurrence');
});

test('edits and removals during a delivery: the acknowledgement is refused and the new state applies', () => {
  fresh();
  const a = ops.createReminder({ text: 'SYNTHETIC rescheduled', schedule: { at: '2026-10-13 12:30' } }).reminder;
  const b = ops.createReminder({ text: 'SYNTHETIC removed', schedule: { at: '2026-10-13 12:30' } }).reminder;
  const c = ops.createReminder({ text: 'SYNTHETIC stopped', schedule: { at: '2026-10-13 12:30' } }).reminder;
  const d = ops.createReminder({ text: 'SYNTHETIC renamed', schedule: { at: '2026-10-13 12:30' } }).reminder;
  at('2026-10-13T10:30:05Z');
  assert.equal(ops.selectDue().items.length, 4);
  const occ = '2026-10-13T10:30:00Z';
  assert.match(ops.setSchedule(a.id, { at: '2026-10-14 09:00' }).note, /was being delivered when this change was saved/);
  assert.match(ops.removeReminder(b.id).note, /was being delivered/);
  assert.match(ops.unscheduleReminder(c.id).note, /was being delivered/);
  ops.modifyText(d.id, 'SYNTHETIC renamed during delivery');
  refuses(() => ops.acknowledge(a.id, occ), 'refused', /is not pending/);
  refuses(() => ops.acknowledge(b.id, occ), 'refused', /no longer exists/);
  refuses(() => ops.acknowledge(c.id, occ), 'refused', /has no schedule any more/);
  assert.equal(ops.acknowledge(d.id, occ).reminder.state, 'completed', 'a text edit does not disturb the delivery');
  assert.equal(ops.getReminder(a.id).nextDue, '2026-10-14T07:00:00Z');
  refuses(() => ops.acknowledge(a.id, 'yesterday'), 'invalid', /not an occurrence instant/);
});

test('cancelled before sending: a removed or stopped reminder is never selected', () => {
  fresh();
  const active = ops.createReminder({ text: 'SYNTHETIC active', schedule: { at: '2026-10-13 12:30' } }).reminder;
  const removed = ops.createReminder({ text: 'SYNTHETIC removed before due', schedule: { at: '2026-10-13 12:30' } }).reminder;
  const stopped = ops.createReminder({ text: 'SYNTHETIC stopped before due', schedule: { at: '2026-10-13 12:30' } }).reminder;
  ops.removeReminder(removed.id);
  ops.unscheduleReminder(stopped.id);
  at('2026-10-13T10:31:00Z');
  assert.deepEqual(ops.selectDue().items.map((i) => i.id), [active.id]);
});

test('browser form: field checks, mapping to the shared schedule, and prefill round trip', () => {
  assert.equal(scheduleFromForm({ ...emptyForm(), kind: 'none' }), null);
  assert.deepEqual(scheduleFromForm({ ...emptyForm('Europe/Budapest'), kind: 'once', date: '2026-10-14', time: '09:00' }), { tz: 'Europe/Budapest', at: '2026-10-14 09:00' });
  assert.deepEqual(scheduleFromForm({ ...emptyForm('UTC'), kind: 'weekly', days: ['FR', 'MO'], time: '08:30', from: '2026-11-01' }), { tz: 'UTC', rule: 'weekly:MO,FR@08:30', from: '2026-11-01' });
  assert.deepEqual(scheduleFromForm({ ...emptyForm('UTC'), kind: 'monthly', dayOfMonth: '31', time: '08:00' }), { tz: 'UTC', rule: 'monthly:31@08:00' });
  assert.deepEqual(scheduleFromForm({ ...emptyForm('UTC'), kind: 'every', everyN: '90', everyUnit: 'm' }), { tz: 'UTC', rule: 'every:90m' });
  const bad = (form, fields) =>
    assert.throws(() => scheduleFromForm(form), (err) => {
      assert.deepEqual(Object.keys(err.fields).sort(), fields.sort());
      return true;
    });
  bad({ ...emptyForm(''), kind: 'once' }, ['tz', 'date', 'time']);
  bad({ ...emptyForm('UTC'), kind: 'weekly', time: '9am' }, ['days', 'time']);
  bad({ ...emptyForm('UTC'), kind: 'monthly', dayOfMonth: '32', time: '08:00' }, ['dayOfMonth']);
  bad({ ...emptyForm('UTC'), kind: 'every', everyN: '1.5', everyUnit: 'h', date: '2026-10-14' }, ['everyN', 'time']);
  bad({ ...emptyForm('UTC'), kind: 'yearly' }, ['kind']);

  fresh();
  for (const schedule of [{ at: '2026-10-14 09:00' }, { rule: 'daily@07:15' }, { rule: 'weekly:MO,TH@08:30' }, { tz: 'America/New_York', rule: 'monthly:31@08:00' }, { rule: 'every:6h', at: '2026-10-13 13:00' }]) {
    const rec = ops.createReminder({ text: 'SYNTHETIC round trip', schedule }).reminder;
    const form = formFromRecord(rec, 'Europe/Budapest');
    const back = ops.resolveSchedule(scheduleFromForm(form));
    assert.deepEqual([back.tz, back.rule, back.next], [rec.tz, rec.rule, rec.nextDue], `prefill of ${rec.rule} resolves to the saved schedule`);
    assert.equal(scheduleKey(form), scheduleKey(formFromRecord(rec, 'Asia/Tokyo')), 'the key ignores the default timezone for a scheduled record');
  }
});

test('chat command: output wording, exit codes, quoting and non-ASCII text', () => {
  fresh();
  assert.equal(cli('list').out, 'No reminders saved.\n');
  const added = cli('add', 'SYNTHETIC "Sam" owes $50 `x` \\n árvíztűrő', '--at', '2026-10-14 09:00');
  assert.equal(added.out, 'Added R-0001: SYNTHETIC "Sam" owes $50 `x` \\n árvíztűrő\nSchedule: one-off; next due Wed 2026-10-14 09:00 +02:00 (Europe/Budapest) = 2026-10-14T07:00:00Z\n');
  const piped = spawnSync(process.execPath, [CLI, 'add', '-'], { encoding: 'utf8', env: process.env, input: '/SYNTHETIC starts with a slash\nand has two lines\n' });
  assert.equal(piped.stdout, 'Added R-0002: /SYNTHETIC starts with a slash and has two lines\nUnscheduled: it is stored as text and will never be sent.\n');
  assert.equal(cli('list').out, 'R-0001: SYNTHETIC "Sam" owes $50 `x` \\n árvíztűrő\n    active; next due Wed 2026-10-14 09:00 +02:00 (Europe/Budapest) = 2026-10-14T07:00:00Z; rule once\nR-0002: /SYNTHETIC starts with a slash and has two lines\n');
  assert.equal(cli('due').out, 'NOTHING_DUE\n');
  assert.equal(cli('remove', 'R-0009').code, 2);
  assert.equal(cli('add', '').code, 1);
  assert.equal(cli('add', 'SYNTHETIC', '--at', '2020-01-01 00:00').code, 1);
  assert.equal(cli('nonsense').code, 1);
  assert.equal(cli('ack', 'R-0001', '2026-10-14T07:00:00Z').code, 4);
  at('2026-10-14T07:00:30Z');
  const due = cli('due', '--run', 'unit');
  assert.equal(due.out, 'CHECK run=unit now=2026-10-14T07:00:30Z\nDELIVER R-0001 2026-10-14T07:00:00Z\nMESSAGE Reminder R-0001: SYNTHETIC "Sam" owes $50 `x` \\n árvíztűrő  (due Wed 2026-10-14 09:00 +02:00 Europe/Budapest; one-off)\nEND deliver=1 uncertain=0\n');
  assert.equal(cli('ack', 'R-0001', '2026-10-14T07:00:00Z').out, 'Acknowledged R-0001 occurrence 2026-10-14T07:00:00Z: one-off completed; it will not be sent again.\n');
  assert.match(cli('list').out, /R-0001: .*\n    completed \(one-off delivered; occurrence 2026-10-14T07:00:00Z\)\n/);
  assert.match(cli('status').out, /ISOLATED TEST DATABASE/);
  assert.match(cli('recover').out, /passes its integrity check/);
});

test('concurrent writers: parallel adds get distinct IDs and none is lost; parallel checks deliver once', async () => {
  fresh();
  const n = 12;
  const results = await Promise.all(Array.from({ length: n }, (_, i) => cliAsync('add', `SYNTHETIC parallel ${i}`, '--at', '2026-10-13 12:30')));
  assert.deepEqual(results.map((r) => r.code), Array(n).fill(0), results.map((r) => r.err).join(''));
  const got = results.map((r) => /Added (R-\d{4})/.exec(r.out)[1]).sort();
  assert.equal(new Set(got).size, n, 'every writer got its own ID');
  const saved = ops.listReminders();
  assert.deepEqual(saved.reminders.map((r) => r.id), got);
  assert.equal(saved.nextId, 'R-0013');
  at('2026-10-13T10:30:10Z');
  const checks = await Promise.all(Array.from({ length: 4 }, (_, i) => cliAsync('due', '--run', `c${i}`)));
  const delivered = checks.flatMap((c) => c.out.split('\n').filter((l) => l.startsWith('DELIVER ')));
  assert.equal(delivered.length, n, 'each occurrence is handed to exactly one check');
  assert.equal(new Set(delivered).size, n);
});

test('a writer that cannot get the lock fails cleanly with "busy" and changes nothing', () => {
  const file = fresh();
  ops.createReminder({ text: 'SYNTHETIC' });
  const holder = openDatabase();
  holder.exec('BEGIN IMMEDIATE');
  process.env.REMINDERS_BUSY_MS = '150';
  try {
    refuses(() => ops.createReminder({ text: 'SYNTHETIC blocked' }), 'busy', /stayed locked/);
    assert.equal(cli('add', 'SYNTHETIC blocked too').code, 3);
  } finally {
    delete process.env.REMINDERS_BUSY_MS;
    holder.exec('ROLLBACK');
    holder.close();
  }
  assert.equal(ops.listReminders().reminders.length, 1);
  assert.ok(fs.existsSync(file));
});

test('migration: values preserved, retry-safe, and never re-imported over the live database', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'mig-'));
  const source = path.join(dir, 'REMINDERS.md');
  const backupDir = path.join(dir, 'backup');
  fs.writeFileSync(
    source,
    [
      '# REMINDERS',
      '',
      'Next ID: R-0012',
      'Default timezone: Europe/Budapest',
      '',
      '## Records',
      '',
      '- R-0002: SYNTHETIC plain text with "quotes", $dollar | pipes and árvíztűrő',
      '- R-0005: SYNTHETIC weekly report',
      '  ~ R-0005 | state=active | tz=Europe/Budapest | rule=weekly:MO@08:30 | next=2026-10-19T06:30:00Z | local=Mon 2026-10-19 08:30 +02:00 | pending=- | prun=- | pmarked=- | pnote=- | last=2026-10-12T06:30:00Z | acked=2026-10-12T06:30:41Z',
      '- R-0007: SYNTHETIC done one-off',
      '  ~ R-0007 | state=completed | tz=America/New_York | rule=once | next=- | local=Fri 2026-10-09 09:00 -04:00 | pending=- | prun=- | pmarked=- | pnote=- | last=2026-10-09T13:00:00Z | acked=2026-10-09T13:00:20Z',
      '- R-0009: SYNTHETIC pending one',
      '  ~ R-0009 | state=active | tz=UTC | rule=every:90m | next=2026-10-13T10:30:00Z | local=Tue 2026-10-13 10:30 +00:00 | pending=2026-10-13T10:30:00Z | prun=chk-1 | pmarked=2026-10-13T10:30:05Z | pnote=yes | last=- | acked=-',
      '',
    ].join('\r\n'),
  );
  process.env.REMINDERS_DB = path.join(dir, 'migrated.db');
  process.env.REMINDERS_TEST_NOW = '2026-10-13T12:00:00Z';
  const run = (...args) => {
    const r = spawnSync(process.execPath, [MIGRATE, ...args, '--source', source, '--backup-dir', backupDir], { encoding: 'utf8', env: process.env });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  assert.equal(run('import').code, 1, 'import is refused before a backup exists');
  assert.equal(fs.existsSync(process.env.REMINDERS_DB), false);
  assert.equal(run('backup').code, 0);
  assert.deepEqual(fs.readFileSync(path.join(backupDir, 'REMINDERS.md')), fs.readFileSync(source), 'the backup is byte-identical');
  assert.match(run('import').out, /4 inserted, 0 already present/);
  assert.match(run('import').out, /0 inserted, 4 already present and identical \(no duplicates\)/);
  const verify = run('verify');
  assert.equal(verify.code, 0, verify.out);
  assert.match(verify.out, /VERIFIED/);

  const data = ops.listReminders();
  assert.equal(data.nextId, 'R-0012');
  assert.equal(data.defaultTimezone, 'Europe/Budapest');
  const pick = (r) => [r.id, r.text, r.state, r.tz, r.rule, r.nextDue, r.nextLocal, r.pending?.occurrence ?? null, r.pending?.uncertain ?? null, r.lastDelivered, r.ackedAt, r.destination];
  assert.deepEqual(data.reminders.map(pick), [
    ['R-0002', 'SYNTHETIC plain text with "quotes", $dollar | pipes and árvíztűrő', 'unscheduled', null, null, null, null, null, null, null, null, 'checker-chat'],
    ['R-0005', 'SYNTHETIC weekly report', 'active', 'Europe/Budapest', 'weekly:MO@08:30', '2026-10-19T06:30:00Z', 'Mon 2026-10-19 08:30 +02:00', null, null, '2026-10-12T06:30:00Z', '2026-10-12T06:30:41Z', 'checker-chat'],
    ['R-0007', 'SYNTHETIC done one-off', 'completed', 'America/New_York', 'once', null, 'Fri 2026-10-09 09:00 -04:00', null, null, '2026-10-09T13:00:00Z', '2026-10-09T13:00:20Z', 'checker-chat'],
    ['R-0009', 'SYNTHETIC pending one', 'active', 'UTC', 'every:90m', '2026-10-13T10:30:00Z', 'Tue 2026-10-13 10:30 +00:00', '2026-10-13T10:30:00Z', true, null, null, 'checker-chat'],
  ]);
  assert.deepEqual(ops.selectDue().items, [], 'the migrated pending occurrence is not selected again');

  // a difference blocks the switch
  ops.modifyText('R-0002', 'SYNTHETIC edited between import and verify');
  assert.equal(run('verify').code, 1);
  assert.equal(run('switch').code, 1);
  assert.ok(fs.existsSync(source), 'the source stays until the import verifies');
  assert.match(run('import').out, /already exist in the database with different values; nothing was imported/);
  ops.modifyText('R-0002', 'SYNTHETIC plain text with "quotes", $dollar | pipes and árvíztűrő');

  assert.equal(run('switch').code, 0);
  assert.equal(fs.existsSync(source), false, 'the old file is retired from its live location');
  assert.ok(fs.existsSync(path.join(backupDir, 'REMINDERS.md')));
  assert.match(fs.readFileSync(path.join(backupDir, 'README.md'), 'utf8'), /HISTORICAL BACKUP - NOT THE LIVE STORE/);
  assert.equal(ops.storeStatus().migrationStage, 'switched');

  // after the switch: live edits, then every route back to the old file is refused
  ops.removeReminder('R-0005');
  const fresh12 = ops.createReminder({ text: 'SYNTHETIC created after the switch' }).reminder;
  assert.equal(fresh12.id, 'R-0012');
  assert.equal(run('import').code, 1, 'no source at the live location');
  fs.copyFileSync(path.join(backupDir, 'REMINDERS.md'), source); // someone puts the old file back
  const again = run('import');
  assert.equal(again.code, 1);
  assert.match(again.out, /Importing the historical Markdown file again is refused/);
  assert.equal(run('verify').code, 1);
  assert.deepEqual(ids(), ['R-0002', 'R-0007', 'R-0009', 'R-0012'], 'newer deletions and additions are intact');
  assert.equal(run('switch').code, 0, 'a retried switch only retires the identical leftover file');
  assert.equal(fs.existsSync(source), false);
  assert.equal(run('complete', '--checker-job', 'test-job').code, 0);
  assert.equal(ops.storeStatus().migrationStage, 'complete');
  assert.equal(cli('list').code, 0, 'the service works with no REMINDERS.md anywhere');
});

test('migration: a store it does not fully understand is refused, not partly imported', () => {
  const dir = fs.mkdtempSync(path.join(TMP, 'mig-bad-'));
  const source = path.join(dir, 'REMINDERS.md');
  fs.writeFileSync(source, '# REMINDERS\n\nNext ID: R-0003\n\n## Records\n\n- R-0001: SYNTHETIC ok\n  ~ R-0001 | state=paused | tz=Europe/Budapest | rule=once | next=soon | local=x | pending=- | prun=- | pmarked=- | pnote=- | last=- | acked=-\nstray line\n');
  process.env.REMINDERS_DB = path.join(dir, 'migrated.db');
  const r = spawnSync(process.execPath, [MIGRATE, 'inspect', '--source', source, '--backup-dir', path.join(dir, 'b')], { encoding: 'utf8', env: process.env });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown state 'paused'/);
  assert.match(r.stderr, /next='soon' is not a UTC instant/);
  assert.match(r.stderr, /unrecognised line under "## Records": stray line/);
  assert.equal(fs.existsSync(process.env.REMINDERS_DB), false);
});
