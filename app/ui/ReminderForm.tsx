'use client';

// Create and edit form. Its state belongs to the user: a background refresh never overwrites it,
// a refused value stays in the field, and a change made elsewhere is announced, not merged.
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { emptyForm, formFromRecord, scheduleFromForm, scheduleKey, DAY_ORDER } from '@/lib/reminders/form.mjs';
import { RequestError, createReminder, previewSchedule, updateReminder, type SaveResult } from './client';
import { dueText } from './display';
import type { FormValues, Preview, Reminder } from './types';

const TEXT_MAX = 2000;
const DAY_NAMES: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
const KIND_OPTIONS: { value: FormValues['kind']; label: string }[] = [
  { value: 'none', label: 'No schedule (keep as a note, never sent)' },
  { value: 'once', label: 'Once, at a date and time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week, on chosen weekdays' },
  { value: 'monthly', label: 'Every month, on a day of the month' },
  { value: 'every', label: 'Every so many minutes, hours or days' },
];

type Props = {
  mode: 'create' | 'edit';
  /** The record being edited, from the latest refresh; null once it no longer exists. */
  record: Reminder | null;
  defaultTimezone: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSaved: (result: SaveResult, created: boolean) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** The save was refused because the record changed or vanished: fetch the latest now. */
  onStale: () => void;
};

/**
 * Why the last Save was refused, shown at the top of the form. 'fields' counts the marked values
 * that still need correcting, so it shrinks and goes as they are corrected. 'message' is a refusal
 * that belongs to no field; it describes the entries as they were sent, so it goes once they change.
 */
type Refusal = { kind: 'fields' } | { kind: 'message'; text: string };

type PreviewState = { kind: 'idle' } | { kind: 'unchanged' } | { kind: 'ok'; preview: Preview } | { kind: 'error'; message: string };

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Dates and times are typed in the form the whole app shows them in: YYYY-MM-DD and 24-hour HH:MM.
// The browser's own date and time controls are not used, because they display the browser's
// locale (03/04/2027, 02:30 PM), which is the two-way reading this service refuses to guess.
const DATE_HINT = 'YYYY-MM-DD, for example 2026-11-02.';
const TIME_HINT = '24-hour HH:MM, for example 09:00 or 17:30.';
const entry = { type: 'text', autoComplete: 'off', autoCapitalize: 'off', spellCheck: false } as const;

/** "9:05" or "0905" becomes "09:05" when the field is left; anything else is left for the form to explain. */
const tidyTime = (raw: string) => {
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(raw.trim());
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : raw.trim();
};
/** "2026-11-2" becomes "2026-11-02" when the field is left. A day-first or month-first date is never reordered. */
const tidyDate = (raw: string) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : raw.trim();
};

const describedBy = (id: string, error?: string, hint?: boolean) => [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

export function ReminderForm({ mode, record, defaultTimezone, headingRef, onSaved, onCancel, onDirtyChange, onStale }: Props) {
  const [opened] = useState(record); // the record as it was when the form opened
  const [values, setValues] = useState<FormValues>(() => (mode === 'edit' && record ? (formFromRecord(record, defaultTimezone ?? '') as FormValues) : (emptyForm(defaultTimezone ?? '') as FormValues)));
  const [base, setBase] = useState(() => ({ rev: record?.rev ?? 0, text: mode === 'edit' && record ? record.text : '', key: scheduleKey(mode === 'edit' && record ? formFromRecord(record, defaultTimezone ?? '') : emptyForm(defaultTimezone ?? '')) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveTz, setSaveTz] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' });
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const previewSeq = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryTick, setSummaryTick] = useState(0);

  const key = scheduleKey(values);
  const dirty = values.text !== base.text || key !== base.key;
  const removedElsewhere = mode === 'edit' && record === null;
  const changedElsewhere = mode === 'edit' && record !== null && record.rev !== base.rev;
  const id = opened?.id ?? '';

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    try {
      setBrowserTz(new Intl.DateTimeFormat().resolvedOptions().timeZone || null);
      setZones(['UTC', ...Intl.supportedValuesOf('timeZone')]);
    } catch {
      /* the field still accepts a typed name */
    }
  }, []);

  useEffect(() => {
    if (focusTick === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [focusTick]);

  // A refusal that belongs to no field (changed elsewhere, nothing to save, the app did not answer)
  // is shown at the top of the form while the user is at Save, at the bottom: bring it on screen.
  // When a field was refused, focus has already moved to that field and its own message.
  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.scrollIntoView({ block: 'nearest' });
  }, [summaryTick]);

  // Show how the schedule resolves (first occurrence, clock-change notes) before it is saved.
  useEffect(() => {
    if (values.kind === 'none') return setPreview({ kind: 'idle' });
    if (mode === 'edit' && key === base.key) return setPreview({ kind: 'unchanged' });
    const mine = ++previewSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const result = await previewSchedule(values);
        if (mine === previewSeq.current) setPreview(result.preview ? { kind: 'ok', preview: result.preview } : { kind: 'idle' });
      } catch (err) {
        if (mine !== previewSeq.current) return;
        if (err instanceof RequestError && !err.detail.incomplete && err.status === 422) setPreview({ kind: 'error', message: err.detail.message });
        else setPreview({ kind: 'idle' });
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, base.key, mode]);

  const set = <K extends keyof FormValues>(name: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setRefusal((r) => (r?.kind === 'message' ? null : r));
    setErrors((e) => {
      // another kind of schedule shows other fields: messages about the ones now hidden go with them
      if (name === 'kind') return 'text' in e ? { text: e.text } : Object.keys(e).length > 0 ? {} : e;
      if (!(name in e)) return e;
      const next = { ...e };
      delete next[name as string];
      return next;
    });
  };

  /** On leaving a date or time field: pad an unambiguous short entry; never touch anything else. */
  const tidy = (name: 'date' | 'time' | 'from', fix: (raw: string) => string) => {
    const fixed = fix(values[name]);
    if (fixed !== values[name]) setValues((v) => ({ ...v, [name]: fixed }));
  };

  const toggleDay = (day: string) => set('days', values.days.includes(day) ? values.days.filter((d) => d !== day) : [...values.days, day]);

  function showProblems(fields: Record<string, string>, message: string) {
    setErrors(fields);
    setRefusal(Object.keys(fields).length > 0 ? { kind: 'fields' } : { kind: 'message', text: message });
    setFocusTick((t) => t + 1);
    if (Object.keys(fields).length === 0) setSummaryTick((t) => t + 1);
  }

  /** A refusal that belongs to no field. */
  function refuse(message: string) {
    setRefusal({ kind: 'message', text: message });
    setSummaryTick((t) => t + 1);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found: Record<string, string> = {};
    const trimmed = values.text.trim();
    if (!trimmed) found.text = 'Write what you want to be reminded of.';
    else if ([...trimmed].length > TEXT_MAX) found.text = `This is ${[...trimmed].length} characters; the limit is ${TEXT_MAX}. Shorten it.`;
    try {
      scheduleFromForm(values);
    } catch (err) {
      const fields = (err as { fields?: Record<string, string> }).fields;
      if (fields) Object.assign(found, fields);
    }
    const count = Object.keys(found).length;
    if (count > 0) return showProblems(found, '');

    setSaving(true);
    setRefusal(null);
    try {
      if (mode === 'create' || removedElsewhere) {
        onSaved(await createReminder(values, saveTz), true);
        return;
      }
      const body: { expectedRev: number; text?: string; schedule?: FormValues | null; saveDefaultTimezone?: boolean } = { expectedRev: base.rev };
      if (values.text !== base.text) body.text = values.text;
      if (key !== base.key) {
        body.schedule = values.kind === 'none' ? null : values;
        body.saveDefaultTimezone = saveTz;
      }
      if (body.text === undefined && body.schedule === undefined) {
        refuse('Nothing has been changed, so there is nothing to save.');
        return;
      }
      onSaved(await updateReminder(id, body), false);
    } catch (err) {
      if (err instanceof RequestError) {
        if (err.detail.code === 'conflict' || err.status === 404) {
          // The banner above the form explains it once the next refresh brings the newer record.
          refuse(err.detail.message);
          setErrors({});
          onStale();
        } else {
          const fields = err.detail.fields ?? {};
          showProblems(fields, err.detail.message);
          if (values.kind !== 'none' && Object.keys(fields).some((f) => f !== 'text')) {
            previewSeq.current++;
            setPreview({ kind: 'error', message: 'correct the marked value above.' });
          }
        }
      } else {
        refuse('Saving failed unexpectedly. Your entries are still here; try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function loadLatest() {
    if (!record) return;
    const fresh = formFromRecord(record, defaultTimezone ?? '') as FormValues;
    setValues(fresh);
    setBase({ rev: record.rev, text: record.text, key: scheduleKey(fresh) });
    setErrors({});
    setRefusal(null);
    headingRef.current?.focus(); // the banner and its buttons are about to go
  }

  /**
   * Continue from the newer record without losing what was typed. What the user changed (the text,
   * the schedule, or both) stays as typed and is compared with the newer record from now on, so
   * Save sends it. A part the user did not change takes the newer record's value, in the fields
   * and as the baseline. Either way the form shows exactly what Save will leave stored.
   */
  function keepMine() {
    if (!record) return;
    const fresh = formFromRecord(record, defaultTimezone ?? '') as FormValues;
    const textMine = values.text !== base.text;
    const scheduleMine = key !== base.key;
    setValues((v) => ({ ...(scheduleMine ? v : fresh), text: textMine ? v.text : fresh.text }));
    setBase({ rev: record.rev, text: record.text, key: scheduleKey(fresh) });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([name]) => (name === 'text' ? textMine : scheduleMine))));
    setRefusal(null); // a refusal shown for the older revision no longer applies
    headingRef.current?.focus(); // the banner and its buttons are about to go
  }

  const marked = Object.keys(errors).length;
  const summary = refusal?.kind === 'message' ? refusal.text : refusal && marked > 0 ? `${marked === 1 ? 'One value needs' : 'Some values need'} correcting. Nothing was saved.` : null;
  const scheduled = values.kind !== 'none';
  const calendar = values.kind === 'daily' || values.kind === 'weekly' || values.kind === 'monthly';
  const textLength = useMemo(() => [...values.text].length, [values.text]);
  const latestDue = record ? dueText(record) : null;
  const title = mode === 'create' ? 'New reminder' : `Edit ${id}`;
  const tzHint = defaultTimezone
    ? `An IANA name such as Europe/Budapest. Your saved default is ${defaultTimezone}.`
    : 'An IANA name such as Europe/Budapest. No default is saved yet, so it has to be given here.';

  return (
    <form ref={formRef} className="card form" onSubmit={submit} noValidate aria-labelledby="form-title">
      <div className="card-head">
        <h2 id="form-title" ref={headingRef} tabIndex={-1}>
          {mode === 'create' ? title : (
            <>
              Edit <span className="callno-lg">{id}</span>
            </>
          )}
        </h2>
      </div>

      {removedElsewhere ? (
        <div className="banner banner-warn" role="alert">
          <p>
            <strong><span className="typed">{id}</span> was removed</strong> in chat or another window while you were editing. Your entries are still here.
          </p>
          <p>Saving now creates a new reminder with a new ID.</p>
        </div>
      ) : null}

      {changedElsewhere && record ? (
        <div className="banner banner-warn" role="alert">
          <p>
            <strong><span className="typed">{id}</span> was changed</strong> in chat or another window since you started editing. Your entries are untouched.
          </p>
          <p className="wrap">
            It now reads: “{record.text}”{record.state === 'unscheduled' ? ', not scheduled' : latestDue ? `, ${record.state === 'completed' ? 'delivered, was due' : 'next due'} ${latestDue.when} (${record.tz}), ${record.ruleLabel}` : ''}.
          </p>
          <p>“Keep my entries” keeps what you changed here and shows the latest value for anything you did not change. Nothing is saved until you press Save changes.</p>
          <div className="row">
            <button type="button" className="btn" onClick={keepMine}>
              Keep my entries
            </button>
            <button type="button" className="btn" onClick={loadLatest}>
              Load the latest values
            </button>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="banner banner-error" role="alert" id="form-summary" ref={summaryRef}>
          <p>{summary}</p>
        </div>
      ) : null}

      <Field id="f-text" label="Remind me to" error={errors.text} hint={`One line of text; line breaks become spaces. ${textLength} of ${TEXT_MAX} characters.`}>
        <textarea
          id="f-text"
          name="text"
          rows={3}
          value={values.text}
          onChange={(e) => set('text', e.target.value)}
          aria-invalid={errors.text ? true : undefined}
          aria-describedby={describedBy('f-text', errors.text, true)}
          aria-required="true"
        />
      </Field>

      <Field id="f-kind" label="When" error={errors.kind} hint="Yearly rules, “first Monday of the month”, end dates and repeat counts are not supported.">
        <select id="f-kind" name="kind" value={values.kind} onChange={(e) => set('kind', e.target.value as FormValues['kind'])} aria-invalid={errors.kind ? true : undefined} aria-describedby={describedBy('f-kind', errors.kind, true)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {values.kind === 'weekly' ? (
        <fieldset className={`field${errors.days ? ' field-invalid' : ''}`} aria-describedby={errors.days ? 'f-days-error' : undefined}>
          <legend>On these weekdays</legend>
          <div className="days">
            {DAY_ORDER.map((day: string, index: number) => (
              <label key={day} className="day">
                <input type="checkbox" name="days" value={day} checked={values.days.includes(day)} onChange={() => toggleDay(day)} aria-invalid={errors.days && index === 0 ? true : undefined} />
                <span>{DAY_NAMES[day]}</span>
              </label>
            ))}
          </div>
          {errors.days ? (
            <p className="field-error" id="f-days-error">
              {errors.days}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {values.kind === 'monthly' ? (
        <Field id="f-dom" label="Day of the month" error={errors.dayOfMonth} hint="1 to 31. In a shorter month, 29, 30 and 31 mean its last day.">
          <input id="f-dom" name="dayOfMonth" className="input-short" inputMode="numeric" autoComplete="off" value={values.dayOfMonth} onChange={(e) => set('dayOfMonth', e.target.value)} aria-invalid={errors.dayOfMonth ? true : undefined} aria-describedby={describedBy('f-dom', errors.dayOfMonth, true)} />
        </Field>
      ) : null}

      {values.kind === 'every' ? (
        <div className="pair">
          <Field id="f-every-n" label="Every" error={errors.everyN}>
            <input id="f-every-n" name="everyN" className="input-short" inputMode="numeric" autoComplete="off" value={values.everyN} onChange={(e) => set('everyN', e.target.value)} aria-invalid={errors.everyN ? true : undefined} aria-describedby={describedBy('f-every-n', errors.everyN)} />
          </Field>
          <Field id="f-every-unit" label="Unit" error={errors.everyUnit}>
            <select id="f-every-unit" name="everyUnit" value={values.everyUnit} onChange={(e) => set('everyUnit', e.target.value as FormValues['everyUnit'])} aria-invalid={errors.everyUnit ? true : undefined} aria-describedby={describedBy('f-every-unit', errors.everyUnit)}>
              <option value="m">minutes</option>
              <option value="h">hours</option>
              <option value="d">days (24 hours each)</option>
            </select>
          </Field>
        </div>
      ) : null}

      {values.kind === 'every' && values.everyUnit === 'd' ? (
        <p className="hint hint-block">Days are counted as exactly 24 hours, so the clock time moves by an hour when clocks change. For the same time every day, choose “Every day”.</p>
      ) : null}

      {values.kind === 'once' || values.kind === 'every' ? (
        <div className="pair">
          <Field id="f-date" label={values.kind === 'every' ? 'First time: date' : 'Date'} error={errors.date} hint={values.kind === 'every' ? `${DATE_HINT} Leave date and time empty to start one interval from now.` : DATE_HINT}>
            <input id="f-date" name="date" {...entry} value={values.date} onChange={(e) => set('date', e.target.value)} onBlur={() => tidy('date', tidyDate)} aria-invalid={errors.date ? true : undefined} aria-describedby={describedBy('f-date', errors.date, true)} />
          </Field>
          <Field id="f-time" label={values.kind === 'every' ? 'First time: time' : 'Time'} error={errors.time} hint={TIME_HINT}>
            <input id="f-time" name="time" {...entry} value={values.time} onChange={(e) => set('time', e.target.value)} onBlur={() => tidy('time', tidyTime)} aria-invalid={errors.time ? true : undefined} aria-describedby={describedBy('f-time', errors.time, true)} />
          </Field>
        </div>
      ) : null}

      {calendar ? (
        <div className="pair">
          <Field id="f-time" label="Time of day" error={errors.time} hint={TIME_HINT}>
            <input id="f-time" name="time" {...entry} value={values.time} onChange={(e) => set('time', e.target.value)} onBlur={() => tidy('time', tidyTime)} aria-invalid={errors.time ? true : undefined} aria-describedby={describedBy('f-time', errors.time, true)} />
          </Field>
          <Field id="f-from" label="Starting from (optional)" error={errors.from} hint="YYYY-MM-DD: the first date allowed. Empty means the next occurrence from now.">
            <input id="f-from" name="from" {...entry} value={values.from} onChange={(e) => set('from', e.target.value)} onBlur={() => tidy('from', tidyDate)} aria-invalid={errors.from ? true : undefined} aria-describedby={describedBy('f-from', errors.from, true)} />
          </Field>
        </div>
      ) : null}

      {scheduled ? (
        <>
          <Field id="f-tz" label="Timezone" error={errors.tz} hint={tzHint}>
            <input
              id="f-tz"
              name="tz"
              list="f-tz-list"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={values.tz}
              onChange={(e) => set('tz', e.target.value)}
              aria-invalid={errors.tz ? true : undefined}
              aria-describedby={describedBy('f-tz', errors.tz, true)}
            />
            <datalist id="f-tz-list">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </Field>
          {browserTz && values.tz.trim() === '' ? (
            <p className="hint-block">
              <button type="button" className="btn btn-quiet" onClick={() => { set('tz', browserTz); document.getElementById('f-tz')?.focus(); /* this button is about to go */ }}>
                Use {browserTz}, this browser’s timezone
              </button>
            </p>
          ) : null}
          {values.tz.trim() !== '' && values.tz.trim() !== (defaultTimezone ?? '') ? (
            <label className="check">
              <input type="checkbox" checked={saveTz} onChange={(e) => setSaveTz(e.target.checked)} />
              <span>Also make {values.tz.trim()} my default timezone for new reminders</span>
            </label>
          ) : null}

          <div className="preview" aria-live="polite">
            {preview.kind === 'ok' ? (
              <>
                <p>
                  <strong>First sent:</strong> <span className="nowrap">{preview.preview.local}</span> <span className="nowrap">({preview.preview.tz})</span>
                </p>
                {preview.preview.note ? <p className="preview-note">{preview.preview.note.replace(/^NOTE: /, '').replace(/^./, (c) => c.toUpperCase())}</p> : null}
              </>
            ) : null}
            {preview.kind === 'unchanged' ? <p>The schedule is unchanged and will be kept as it is.</p> : null}
            {preview.kind === 'error' ? <p className="preview-problem">This cannot be saved yet: {preview.message}</p> : null}
            {preview.kind === 'idle' ? <p className="preview-idle">The first date and time will be shown here once the schedule is complete.</p> : null}
          </div>
        </>
      ) : (
        <p className="hint hint-block">Without a schedule the reminder is kept as text and is never sent. You can give it a time later.</p>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary" aria-disabled={saving || undefined}>
          {saving ? 'Saving…' : mode === 'create' || removedElsewhere ? 'Save reminder' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
