'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { dueText, relativeTime, statusOf, utcText, type StatusKey } from './display';
import { AlertIcon, BackIcon, CheckIcon, ClockIcon, NoteIcon, SendingIcon } from './icons';
import type { Reminder } from './types';

export function StatusMark({ status }: { status: { key: StatusKey; label: string } }) {
  const icon = { uncertain: <AlertIcon />, sending: <SendingIcon />, waiting: <ClockIcon />, scheduled: <ClockIcon />, unscheduled: <NoteIcon />, delivered: <CheckIcon /> }[status.key];
  return (
    <span className={`status status-${status.key}`}>
      {icon}
      {status.label}
    </span>
  );
}

type Props = {
  record: Reminder;
  nowMs: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onEdit: () => void;
  /** Resolve to an error message to show here, or null when the change was committed. */
  onStop: () => Promise<string | null>;
  onRemove: () => Promise<string | null>;
};

export function ReminderDetail({ record, nowMs, headingRef, onBack, onEdit, onStop, onRemove }: Props) {
  const [confirm, setConfirm] = useState<null | 'stop' | 'remove'>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  // Where keyboard focus goes when a confirmation closes; without this it would fall to the page.
  const focusNext = useRef<null | 'stop' | 'remove' | 'heading'>(null);
  const status = statusOf(record, nowMs);
  const due = dueText(record);
  const scheduled = record.state !== 'unscheduled';

  useEffect(() => {
    if (confirm) {
      confirmRef.current?.focus();
      return;
    }
    const next = focusNext.current;
    focusNext.current = null;
    if (!next) return;
    // The button that opened the confirmation, or the record's heading when that button is gone
    // (after "Stop sending" succeeded there is no schedule left to stop).
    const opener = next === 'stop' ? stopRef.current : next === 'remove' ? removeRef.current : null;
    (opener ?? headingRef.current)?.focus();
  }, [confirm, headingRef]);

  // "Stop sending R-…?" asks about a schedule. If a reread shows there is none left (stopped in
  // chat, or the one-off was delivered meanwhile), the question no longer applies and goes; its
  // focused button goes with it, so the record's heading takes focus.
  useEffect(() => {
    if (confirm !== 'stop' || record.state === 'active' || busy) return;
    focusNext.current = 'heading';
    setConfirm(null);
  }, [confirm, record.state, busy]);

  /** Open a confirmation. The explanation of an earlier refused attempt goes: this is a new attempt. */
  function ask(which: 'stop' | 'remove') {
    setProblem(null);
    setConfirm(which);
  }

  function cancel() {
    focusNext.current = confirm;
    setConfirm(null);
  }

  async function run(action: () => Promise<string | null>) {
    if (busy) return;
    const which = confirm;
    setBusy(true);
    setProblem(null);
    const message = await action();
    setBusy(false);
    // Refused: back to the button that was pressed, with the reason shown just above it. Done: a stopped
    // reminder stays open, so its heading takes focus; a removed one closes this card (the list
    // then takes focus, see RemindersApp).
    focusNext.current = message ? which : which === 'stop' ? 'heading' : null;
    setConfirm(null);
    if (message) setProblem(message);
  }

  return (
    <article className="card detail" aria-labelledby="detail-title">
      <button type="button" className="btn btn-quiet back" onClick={onBack}>
        <BackIcon />
        All reminders
      </button>

      <div className="card-head">
        <h2 id="detail-title" ref={headingRef} tabIndex={-1} className="callno callno-lg">
          {record.id}
        </h2>
        <StatusMark status={status} />
      </div>

      <p className="detail-text wrap">{record.text}</p>

      <dl className="facts">
        <div>
          <dt>Status</dt>
          <dd>
            {status.label}. {status.explain}
          </dd>
        </div>
        {scheduled && due ? (
          <div>
            <dt>{record.state === 'completed' ? 'Was due' : 'Next due'}</dt>
            <dd>
              <span className="when">{due.when}</span> <span className="nowrap">({due.offset})</span>
              {record.state === 'active' && record.nextDue ? <span className="relative"> · {relativeTime(record.nextDue, nowMs)}</span> : null}
            </dd>
          </div>
        ) : null}
        {scheduled ? (
          <div>
            <dt>Timezone</dt>
            <dd>{record.tz}</dd>
          </div>
        ) : null}
        <div>
          <dt>Repeats</dt>
          <dd>{record.ruleDetail}</dd>
        </div>
        {scheduled ? (
          <div>
            <dt>Arrives in</dt>
            <dd>{record.destinationText}, only while the reminder checker is running there.</dd>
          </div>
        ) : null}
        {record.pending ? (
          <div>
            <dt>Occurrence in delivery</dt>
            <dd className="typed">
              <span className="nowrap">{utcText(record.pending.occurrence)}</span>
              {record.pending.markedAt ? (
                <>
                  , selected <span className="nowrap">{utcText(record.pending.markedAt)}</span>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {record.lastDelivered ? (
          <div>
            <dt>Last delivered</dt>
            <dd className="typed">
              <span className="nowrap">{utcText(record.lastDelivered)}</span>
              {record.ackedAt ? (
                <>
                  , acknowledged <span className="nowrap">{utcText(record.ackedAt)}</span>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {record.nextDue ? (
          <div>
            <dt>Exact instant</dt>
            <dd className="typed">{utcText(record.nextDue)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Reminder ID</dt>
          <dd>
            <span className="typed">{record.id}</span> (stable: it is never given to another reminder)
          </dd>
        </div>
      </dl>

      {/* A refused change is explained directly above the buttons, where focus returns: higher up
          it is off screen on a long card in a narrow window. */}
      {problem ? (
        <div className="banner banner-error" role="alert">
          <p>{problem}</p>
        </div>
      ) : null}

      {confirm === 'stop' ? (
        <div className="confirm" role="group" aria-label={`Stop sending ${record.id}`}>
          <p>
            Stop sending {record.id}? The text is kept; its schedule is dropped and nothing more is sent for it.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" ref={confirmRef} onClick={() => run(onStop)} aria-disabled={busy || undefined}>
              {busy ? 'Stopping…' : 'Stop sending'}
            </button>
            <button type="button" className="btn" onClick={cancel}>
              Keep the schedule
            </button>
          </div>
        </div>
      ) : null}

      {confirm === 'remove' ? (
        <div className="confirm confirm-danger" role="group" aria-label={`Remove ${record.id}`}>
          <p>
            Remove {record.id} for good? Its text and schedule are deleted, nothing more is sent for it, and the ID is not reused.
          </p>
          <div className="row">
            <button type="button" className="btn btn-danger" ref={confirmRef} onClick={() => run(onRemove)} aria-disabled={busy || undefined}>
              {busy ? 'Removing…' : 'Remove reminder'}
            </button>
            <button type="button" className="btn" onClick={cancel}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {confirm === null ? (
        <div className="actions actions-split">
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              Edit
            </button>
            {record.state === 'active' ? (
              <button type="button" className="btn" ref={stopRef} onClick={() => ask('stop')}>
                Stop sending
              </button>
            ) : null}
          </div>
          <button type="button" className="btn btn-danger-quiet" ref={removeRef} onClick={() => ask('remove')}>
            Remove
          </button>
        </div>
      ) : null}
    </article>
  );
}
