// The browser form's view of a schedule, and its translation to the shared schedule request
// ({ tz, at, rule, from } — the same parts chat passes). Runs in the browser (to prefill and to
// tell whether the schedule was edited) and on the server (which is the authority on validity).
import { ReminderError } from './errors.mjs';
import { splitLocal } from './format.mjs';

export const KINDS = ['none', 'once', 'daily', 'weekly', 'monthly', 'every'];
export const DAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** An empty form. `tz` is prefilled by the caller with the saved default, when there is one. */
export function emptyForm(tz = '') {
  return { text: '', kind: 'none', date: '', time: '', days: [], dayOfMonth: '', everyN: '', everyUnit: 'h', from: '', tz };
}

/** The form that shows a saved reminder. */
export function formFromRecord(rec, defaultTz = '') {
  const form = emptyForm(rec.tz ?? defaultTz ?? '');
  form.text = rec.text;
  const rule = rec.rule;
  if (!rule) return form;
  const local = splitLocal(rec.nextLocal);
  let m;
  if (rule === 'once') {
    form.kind = 'once';
    form.date = local?.date ?? '';
    form.time = local?.time ?? '';
  } else if ((m = /^daily@(.+)$/.exec(rule))) {
    form.kind = 'daily';
    form.time = m[1];
  } else if ((m = /^weekly:(.+)@(.+)$/.exec(rule))) {
    form.kind = 'weekly';
    form.days = m[1].split(',');
    form.time = m[2];
  } else if ((m = /^monthly:(\d+)@(.+)$/.exec(rule))) {
    form.kind = 'monthly';
    form.dayOfMonth = m[1];
    form.time = m[2];
  } else if ((m = /^every:(\d+)([mhd])$/.exec(rule))) {
    form.kind = 'every';
    form.everyN = m[1];
    form.everyUnit = m[2];
    form.date = local?.date ?? '';
    form.time = local?.time ?? '';
  }
  return form;
}

/** The schedule part of a form as one comparable string (to tell whether it was edited). */
export function scheduleKey(form) {
  const f = form ?? {};
  const days = DAY_ORDER.filter((d) => (f.days ?? []).includes(d)).join(',');
  switch (f.kind) {
    case 'once':
      return `once|${f.date}|${f.time}|${f.tz}`;
    case 'daily':
      return `daily|${f.time}|${f.from}|${f.tz}`;
    case 'weekly':
      return `weekly|${days}|${f.time}|${f.from}|${f.tz}`;
    case 'monthly':
      return `monthly|${f.dayOfMonth}|${f.time}|${f.from}|${f.tz}`;
    case 'every':
      return `every|${f.everyN}|${f.everyUnit}|${f.date}|${f.time}|${f.tz}`;
    default:
      return 'none';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates the schedule fields of a form and returns the schedule request, or null for
 * "no schedule". Collects every field problem and throws them together, so the form can mark all
 * of them at once. Whether the time is in the future, real, or affected by a clock change is
 * decided later by the shared operation.
 */
export function scheduleFromForm(form) {
  const f = form ?? {};
  const fields = {};
  const kind = KINDS.includes(f.kind) ? f.kind : null;
  if (!kind) fields.kind = 'Choose how often this reminder should be sent.';
  if (kind === 'none') return null;

  const tz = String(f.tz ?? '').trim();
  if (kind && !tz) fields.tz = 'Enter the timezone this time is in, for example Europe/Budapest.';

  const time = String(f.time ?? '').trim();
  const date = String(f.date ?? '').trim();
  const from = String(f.from ?? '').trim();
  const needTime = (label) => {
    if (!time) fields.time = `Enter ${label}, for example 09:00.`;
    else if (!TIME_RE.test(time)) fields.time = `"${time}" is not a time. Use 24-hour hours and minutes, for example 09:00 or 17:30.`;
  };
  const checkFrom = () => {
    if (from && !DATE_RE.test(from)) fields.from = `"${from}" is not a date. Use the form YYYY-MM-DD, for example 2026-11-02.`;
  };

  const schedule = { tz };
  if (kind === 'once') {
    if (!date) fields.date = 'Choose the date.';
    else if (!DATE_RE.test(date)) fields.date = `"${date}" is not a date. Use the form YYYY-MM-DD, for example 2026-11-02.`;
    needTime('the time');
    schedule.at = `${date} ${time}`;
  } else if (kind === 'daily') {
    needTime('the time of day');
    checkFrom();
    schedule.rule = `daily@${time}`;
    if (from) schedule.from = from;
  } else if (kind === 'weekly') {
    const days = DAY_ORDER.filter((d) => Array.isArray(f.days) && f.days.includes(d));
    if (days.length === 0) fields.days = 'Choose at least one weekday.';
    needTime('the time of day');
    checkFrom();
    schedule.rule = `weekly:${days.join(',')}@${time}`;
    if (from) schedule.from = from;
  } else if (kind === 'monthly') {
    const raw = String(f.dayOfMonth ?? '').trim();
    if (!/^\d{1,2}$/.test(raw) || Number(raw) < 1 || Number(raw) > 31) fields.dayOfMonth = 'Enter a day of the month from 1 to 31.';
    needTime('the time of day');
    checkFrom();
    schedule.rule = `monthly:${Number(raw)}@${time}`;
    if (from) schedule.from = from;
  } else if (kind === 'every') {
    const raw = String(f.everyN ?? '').trim();
    if (!/^\d{1,5}$/.test(raw) || Number(raw) < 1) fields.everyN = 'Enter a whole number from 1 to 99999.';
    if (!['m', 'h', 'd'].includes(f.everyUnit)) fields.everyUnit = 'Choose minutes, hours or days.';
    if (date || time) {
      if (!date) fields.date = 'Choose the date of the first time, or clear the time to start one interval from now.';
      else if (!DATE_RE.test(date)) fields.date = `"${date}" is not a date. Use the form YYYY-MM-DD, for example 2026-11-02.`;
      if (!time) fields.time = 'Enter the time of the first time, or clear the date to start one interval from now.';
      else if (!TIME_RE.test(time)) fields.time = `"${time}" is not a time. Use 24-hour hours and minutes, for example 09:00 or 17:30.`;
      schedule.at = `${date} ${time}`;
    }
    schedule.rule = `every:${Number(raw)}${f.everyUnit}`;
  }

  if (Object.keys(fields).length > 0) {
    throw new ReminderError('invalid', 'Some values need correcting. Nothing was saved.', { fields });
  }
  return schedule;
}

/** Maps a field named by the shared operation to the form control that holds it. */
export function formFieldFor(field, kind) {
  if (field === 'at') return kind === 'every' || kind === 'once' ? 'date' : 'time';
  if (field === 'rule') return kind === 'weekly' ? 'days' : kind === 'monthly' ? 'dayOfMonth' : kind === 'every' ? 'everyN' : 'time';
  if (field === 'from' || field === 'tz' || field === 'text') return field;
  return null;
}
