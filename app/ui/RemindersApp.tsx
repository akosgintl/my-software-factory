'use client';

// The whole screen: a list to scan, and a panel for details, editing and creating.
//
// Freshness: values come from the database when the page is opened, after every change made here,
// every `pollSeconds` while the tab is visible, when the tab or window regains focus, and on the
// Refresh button. Nothing is cached. A refresh only replaces the list and the read-only details;
// an open form keeps what was typed (see ReminderForm).
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { RequestError, fetchSnapshot, removeReminder, saveDefaultTimezone, updateReminder, type SaveResult } from './client';
import { GROUPS, dueText, grouped, noteSentences, relativeTime, savedSentence, statusOf, type GroupKey } from './display';
import { ChevronIcon, PlusIcon, RefreshIcon, RepeatIcon } from './icons';
import { ReminderDetail, StatusMark } from './ReminderDetail';
import { ReminderForm } from './ReminderForm';
import type { Reminder, Snapshot } from './types';

type Panel = { mode: 'none' } | { mode: 'detail'; id: string } | { mode: 'edit'; id: string } | { mode: 'create' };
/**
 * The result of the last change. `about` names the record a notice describes and what it says
 * about it, so that the notice can go as soon as a reread shows something else (see below).
 * A notice about a removal describes no record: it stays true.
 */
type Notice = { tone: 'ok' | 'warn'; text: string; about?: { id: string; rev: number; says: string } };
const aboutRecord = (rec: Reminder) => ({ id: rec.id, rev: rec.rev, says: savedSentence(rec) });

const panelKey = (p: Panel) => (p.mode === 'detail' || p.mode === 'edit' ? `${p.mode}:${p.id}` : p.mode);
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

export function RemindersApp({ initial, initialError, initialSelected }: { initial: Snapshot | null; initialError: string | null; initialSelected: string | null }) {
  const [snap, setSnap] = useState<Snapshot | null>(initial);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<{ message: string; at: number | null } | null>(initialError ? { message: initialError, at: null } : null);
  const [refreshing, setRefreshing] = useState(false);
  const [panel, setPanel] = useState<Panel>(initialSelected ? { mode: 'detail', id: initialSelected } : { mode: 'none' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [guardFor, setGuardFor] = useState<Panel | null>(null);
  const [formDirty, setFormDirty] = useState(false);

  const seq = useRef(0);
  const applied = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const guardRef = useRef<HTMLButtonElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const tryNowRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const guardOpener = useRef<HTMLElement | null>(null);
  const focusRefresh = useRef(false);
  const focusAfter = useRef<string | null>(null);
  const firstRender = useRef(true);

  const pollSeconds = snap?.pollSeconds ?? 5;
  const nowMs = snap ? Date.parse(snap.now) : 0;
  const reminders = useMemo(() => snap?.reminders ?? [], [snap]);
  const groups = useMemo(() => grouped(reminders), [reminders]);
  const byId = useMemo(() => new Map(reminders.map((r) => [r.id, r])), [reminders]);

  // ---------- reading ----------

  const refresh = useCallback(async (manual = false) => {
    const mine = ++seq.current;
    if (manual) setRefreshing(true);
    try {
      const data = await fetchSnapshot();
      if (mine > applied.current) {
        applied.current = mine;
        // The failure banner is about to go; if its "Try now" holds focus, hand it on (see below).
        if (tryNowRef.current && document.activeElement === tryNowRef.current) focusRefresh.current = true;
        setSnap(data);
        setLoadedAt(Date.now());
        setRefreshError(null);
      }
    } catch (err) {
      if (mine > applied.current) setRefreshError({ message: err instanceof Error ? err.message : 'The list could not be reread.', at: Date.now() });
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initial) setLoadedAt(Date.now());
    else void refresh();
  }, [initial, refresh]);

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible';
    const timer = window.setInterval(() => {
      if (visible()) void refresh();
    }, pollSeconds * 1000);
    const onVisible = () => {
      if (visible()) void refresh();
    };
    const onFocus = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [pollSeconds, refresh]);

  // A failure banner that goes away takes its focused "Try now" with it: Refresh is the same action.
  useEffect(() => {
    if (refreshError || !focusRefresh.current) return;
    focusRefresh.current = false;
    refreshButtonRef.current?.focus();
  }, [refreshError]);

  // Two measurements the stylesheet cannot make by itself (see `--stuck` and `--pane-room` in
  // globals.css).
  // 1. The failed-reread message stays at the top of the window however far the page is scrolled,
  //    so the layout has to know how much room it takes there: the card beside the list starts
  //    below it, and whatever takes keyboard focus is scrolled to below it.
  // 2. The card beside the list is given exactly the part of the window that the workspace
  //    occupies right now: the whole height in the middle of a long list, less at the top of the
  //    page (the header is in view) and at its end (the footer is). A card that fits that room is
  //    wholly on screen at every scroll position, and a longer one scrolls inside its pane.
  const failing = refreshError !== null;
  useEffect(() => {
    const space = workspaceRef.current;
    if (!space) return;
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const message = failureRef.current;
      const stuck = message ? Math.ceil(message.getBoundingClientRect().height + (parseFloat(getComputedStyle(message).top) || 0)) : 0;
      root.style.setProperty('--stuck', `${stuck}px`);
      const box = space.getBoundingClientRect();
      const margin = parseFloat(getComputedStyle(space).paddingTop) || 0;
      const room = Math.min(root.clientHeight, box.bottom) - Math.max(stuck, box.top) - 2 * margin;
      space.style.setProperty('--pane-room', `${Math.max(Math.floor(room), 160)}px`);
    };
    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(queue);
    observer.observe(space);
    if (failureRef.current) observer.observe(failureRef.current);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      root.style.removeProperty('--stuck');
      space.style.removeProperty('--pane-room');
    };
  }, [failing]);

  /** After a change made here: drop any older read still in flight, show the committed record, reread. */
  const committed = useCallback(
    (update: (reminders: Reminder[]) => Reminder[], defaultTimezone?: string | null) => {
      applied.current = ++seq.current;
      setSnap((s) => (s ? { ...s, reminders: update(s.reminders), defaultTimezone: defaultTimezone === undefined ? s.defaultTimezone : defaultTimezone } : s));
      void refresh();
    },
    [refresh],
  );

  // ---------- navigation ----------

  useEffect(() => {
    const id = panel.mode === 'detail' || panel.mode === 'edit' ? panel.id : null;
    const url = id ? `?r=${encodeURIComponent(id)}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [panel]);

  const key = panelKey(panel);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (panel.mode !== 'none') headingRef.current?.focus();
    else {
      const target = focusAfter.current ? document.getElementById(`row-${focusAfter.current}`) : null;
      (target ?? newButtonRef.current)?.focus();
      focusAfter.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!formDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formDirty]);

  useEffect(() => {
    if (guardFor) guardRef.current?.focus();
  }, [guardFor]);

  // The prompt says the form has unsaved entries. Once that stops being true (the entries were put
  // back, or the latest values were loaded), the prompt goes; the form stays as it is.
  useEffect(() => {
    if (guardFor && !formDirty) setGuardFor(null);
  }, [guardFor, formDirty]);

  // A new result notice is brought on screen wherever the page is scrolled: it sits above the pane
  // in view, but focus has just moved to a heading or a row below it. Declared after the focus
  // effects above so that it runs after them.
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [notice]);

  const show = useCallback((next: Panel) => {
    setGuardFor(null);
    setFormDirty(false);
    setPanel((current) => {
      if (next.mode === 'none' && (current.mode === 'detail' || current.mode === 'edit')) focusAfter.current = current.id;
      return next;
    });
  }, []);

  /** Go somewhere else, unless a form holds unsaved entries: then ask first. */
  const go = useCallback(
    (next: Panel) => {
      const inForm = panel.mode === 'edit' || panel.mode === 'create';
      if (inForm && formDirty && panelKey(next) !== panelKey(panel)) {
        // remember what asked, so that "Keep editing" can give focus back to it
        const from = document.activeElement;
        if (from instanceof HTMLElement && from !== document.body && !from.closest('.guard')) guardOpener.current = from;
        setGuardFor(next);
      } else show(next);
    },
    [formDirty, panel, show],
  );

  /** Focus the first of these that takes it. */
  const focusFirst = (candidates: (HTMLElement | null)[]) => {
    for (const el of candidates) {
      if (!el || !el.isConnected) continue;
      el.focus(); // does nothing for an element in a hidden pane, so check that it took
      if (document.activeElement === el) return;
    }
  };

  /** "Keep editing" removes the prompt and its focused button: back to what opened it, or to the form. */
  const keepEditing = () => {
    setGuardFor(null);
    focusFirst([guardOpener.current, headingRef.current]);
    guardOpener.current = null;
  };

  /**
   * Dismissing the result notice removes the focused button: hand focus to the nearest thing still
   * there. A narrow window hides the list while a card is open, so the card's heading comes next
   * after the open reminder's row.
   */
  const focusNearNotice = () => {
    const selectedNow = panel.mode === 'detail' || panel.mode === 'edit' ? panel.id : null;
    focusFirst([selectedNow ? document.getElementById(`row-${selectedNow}`) : null, panel.mode !== 'none' ? headingRef.current : null, document.querySelector<HTMLElement>('.row-link'), newButtonRef.current]);
  };

  const dismissNotice = () => {
    setNotice(null);
    focusNearNotice();
  };

  // A result notice speaks in the present tense about one record ("R-0015 is saved. Next due …").
  // It goes as soon as a reread shows that record changed (in chat, in another window, by the
  // checker advancing it) or gone: the page must not state two different things about one record.
  // If its Dismiss button holds keyboard focus at that moment, focus is handed on as Dismiss does.
  useEffect(() => {
    const about = notice?.about;
    if (!about || !snap) return;
    const now = byId.get(about.id);
    if (now && now.rev === about.rev && savedSentence(now) === about.says) return;
    if (noticeRef.current?.contains(document.activeElement)) focusNearNotice();
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId, notice]);

  const openRow = (event: MouseEvent, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setNotice(null);
    go({ mode: 'detail', id });
  };

  // ---------- changes ----------

  const onSaved = useCallback(
    (result: SaveResult, created: boolean) => {
      const rec = result.reminder;
      committed((list) => (list.some((r) => r.id === rec.id) ? list.map((r) => (r.id === rec.id ? rec : r)) : [...list, rec]), result.defaultTimezone);
      const note = result.note ? ` ${noteSentences(result.note)}` : '';
      setNotice({ tone: result.note ? 'warn' : 'ok', text: `${created ? 'Created. ' : result.changed === false ? 'Nothing needed changing. ' : 'Changes saved. '}${savedSentence(rec)}${note}`, about: aboutRecord(rec) });
      show({ mode: 'detail', id: rec.id });
    },
    [committed, show],
  );

  const explain = (err: unknown, id: string) => {
    if (err instanceof RequestError) {
      if (err.detail.code === 'conflict') return `${id} was changed in chat or another window just now, so nothing was done. The latest values are shown; check them and try again.`;
      return err.detail.message;
    }
    return 'That did not work. Nothing was changed; try again.';
  };

  const stopSending = async (rec: Reminder): Promise<string | null> => {
    try {
      const result = await updateReminder(rec.id, { expectedRev: rec.rev, schedule: null });
      committed((list) => list.map((r) => (r.id === rec.id ? result.reminder : r)));
      const note = result.note ? ` ${noteSentences(result.note)}` : '';
      setNotice({ tone: result.note ? 'warn' : 'ok', text: `Stopped. ${savedSentence(result.reminder)}${note}`, about: aboutRecord(result.reminder) });
      return null;
    } catch (err) {
      void refresh();
      return explain(err, rec.id);
    }
  };

  const remove = async (rec: Reminder): Promise<string | null> => {
    try {
      const result = await removeReminder(rec.id, rec.rev);
      committed((list) => list.filter((r) => r.id !== rec.id));
      const note = result.note ? ` ${noteSentences(result.note)}` : '';
      setNotice({ tone: result.note ? 'warn' : 'ok', text: `Removed ${result.removed.id}. Nothing more will be sent for it, and its ID will not be reused.${note}` });
      show({ mode: 'none' });
      return null;
    } catch (err) {
      void refresh();
      if (err instanceof RequestError && err.status === 404) {
        setNotice({ tone: 'warn', text: `${rec.id} had already been removed in chat or another window.` });
        show({ mode: 'none' });
        return null;
      }
      return explain(err, rec.id);
    }
  };

  // ---------- render ----------

  const selectedId = panel.mode === 'detail' || panel.mode === 'edit' ? panel.id : null;
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const panelOpen = panel.mode !== 'none';

  return (
    <div className="app">
      <header className="shell">
        <div className="shell-inner">
          <h1>Reminders</h1>
          {snap?.isolated ? <span className="test-flag">Test data, not your reminders</span> : null}
          <p className="shell-status">
            {loadedAt ? (
              <>
                Reread at <time dateTime={new Date(loadedAt).toISOString()}>{clock(loadedAt)}</time>
              </>
            ) : snap ? (
              'Read just now'
            ) : (
              'Not read yet'
            )}
            <span className="shell-status-more"> · rereads every {pollSeconds} seconds</span>
          </p>
          <div className="shell-actions">
            <button type="button" className="btn btn-shell" ref={refreshButtonRef} onClick={() => void refresh(true)} aria-disabled={refreshing || undefined}>
              <span className={refreshing ? 'spin' : undefined}>
                <RefreshIcon />
              </span>
              Refresh
            </button>
            <button type="button" className="btn btn-shell-primary" ref={newButtonRef} onClick={() => { setNotice(null); go({ mode: 'create' }); }}>
              <PlusIcon />
              New reminder
            </button>
          </div>
        </div>
      </header>

      {refreshError ? (
        <div className="banner banner-error page-banner" role="alert" ref={failureRef}>
          <p>
            <strong>The list could not be reread{refreshError.at ? ` at ${clock(refreshError.at)}` : ''}.</strong> {refreshError.message}{' '}
            {snap ? `You are looking at the values from ${loadedAt ? clock(loadedAt) : 'when the page was opened'}; they may be out of date.` : 'Nothing can be shown until it works.'} It is tried again every {pollSeconds} seconds.
          </p>
          <button type="button" className="btn" ref={tryNowRef} onClick={() => void refresh(true)}>
            Try now
          </button>
        </div>
      ) : null}

      <main className="workspace" ref={workspaceRef} data-panel={panelOpen ? 'open' : 'closed'}>
        {/* The result of the last change. It belongs to the workspace, not to the list, so it stays
            on screen when a narrow window shows only the card. The region is always present, so
            what appears in it is announced. */}
        <div className="notice-region" role="status" ref={noticeRef}>
          {notice ? (
            <div className={`banner ${notice.tone === 'ok' ? 'banner-ok' : 'banner-warn'} list-notice`}>
              <p className="wrap">{notice.text}</p>
              <button type="button" className="btn btn-quiet" onClick={dismissNotice}>
                Dismiss
              </button>
            </div>
          ) : null}
        </div>

        <section className="list-pane" aria-labelledby="list-title">
          <h2 id="list-title" className="visually-hidden">
            All reminders
          </h2>

          {snap && reminders.length === 0 ? (
            <div className="empty">
              <h3>No reminders yet</h3>
              <p>Create one here, or tell the chat something like “Remind me tomorrow at 9 to call Anna”. Either way it appears in this list.</p>
              <p>A reminder with a time is sent as a chat message by the reminder checker. One without a time is just kept as a note.</p>
              <button type="button" className="btn btn-primary" onClick={() => { setNotice(null); go({ mode: 'create' }); }}>
                <PlusIcon />
                New reminder
              </button>
            </div>
          ) : null}

          {!snap && !refreshError ? <p className="loading">Reading the reminders…</p> : null}

          {GROUPS.map((group) => {
            const items = groups[group.key];
            if (items.length === 0) return null;
            return (
              <section key={group.key} className={`group group-${group.key}`} aria-labelledby={`group-${group.key}`}>
                <h3 id={`group-${group.key}`} className="tab">
                  {group.title} <span className="tab-count">{items.length}</span>
                </h3>
                <ul className="rows">
                  {items.map((rec) => (
                    <Row key={rec.id} rec={rec} group={group.key} nowMs={nowMs} current={rec.id === selectedId} onOpen={openRow} />
                  ))}
                </ul>
              </section>
            );
          })}
        </section>

        <section className="panel-pane" aria-label={panel.mode === 'create' ? 'New reminder' : panel.mode === 'edit' ? 'Edit reminder' : 'Reminder details'}>
          {guardFor ? (
            <div className="banner banner-warn guard" role="alertdialog" aria-labelledby="guard-text">
              <p id="guard-text">This form has entries that are not saved. Leave it and lose them?</p>
              <div className="row">
                <button type="button" className="btn btn-primary" ref={guardRef} onClick={keepEditing}>
                  Keep editing
                </button>
                <button type="button" className="btn" onClick={() => show(guardFor)}>
                  Discard entries
                </button>
              </div>
            </div>
          ) : null}

          {panel.mode === 'none' ? <Welcome pollSeconds={pollSeconds} empty={Boolean(snap) && reminders.length === 0} /> : null}

          {panel.mode === 'detail' && selected ? (
            <ReminderDetail key={selected.id} record={selected} nowMs={nowMs} headingRef={headingRef} onBack={() => show({ mode: 'none' })} onEdit={() => { setNotice(null); /* the form speaks for the record from here on */ go({ mode: 'edit', id: selected.id }); }} onStop={() => stopSending(selected)} onRemove={() => remove(selected)} />
          ) : null}

          {panel.mode === 'detail' && !selected ? (
            <div className="card">
              <h2 ref={headingRef} tabIndex={-1}>
                {snap ? `${panel.id} is not saved` : panel.id}
              </h2>
              <p>{snap ? 'There is no reminder with this ID. It may have been removed in chat or another window; removed IDs are never reused.' : 'Its details appear once the reminders can be read.'}</p>
              <button type="button" className="btn" onClick={() => show({ mode: 'none' })}>
                Back to all reminders
              </button>
            </div>
          ) : null}

          {panel.mode === 'edit' ? (
            <ReminderForm
              key={`edit:${panel.id}`}
              mode="edit"
              record={selected}
              defaultTimezone={snap?.defaultTimezone ?? null}
              headingRef={headingRef}
              onSaved={onSaved}
              onCancel={() => go(selected ? { mode: 'detail', id: panel.id } : { mode: 'none' })}
              onDirtyChange={setFormDirty}
              onStale={() => void refresh()}
            />
          ) : null}

          {panel.mode === 'create' ? (
            <ReminderForm key="create" mode="create" record={null} defaultTimezone={snap?.defaultTimezone ?? null} headingRef={headingRef} onSaved={onSaved} onCancel={() => go({ mode: 'none' })} onDirtyChange={setFormDirty} onStale={() => void refresh()} />
          ) : null}
        </section>
      </main>

      <footer className="foot">
        <DefaultTimezone value={snap?.defaultTimezone ?? null} disabled={!snap} onSaved={(zone) => committed((list) => list, zone)} />
        <p>
          This page rereads the database every {pollSeconds} seconds while it is visible, when you come back to it, and when you press Refresh. A change made in chat or by the reminder checker can take up to {pollSeconds} seconds to show here. Reminders are sent in the chat by the reminder checker, not by this page.
        </p>
      </footer>
    </div>
  );
}

function Row({ rec, group, nowMs, current, onOpen }: { rec: Reminder; group: GroupKey; nowMs: number; current: boolean; onOpen: (event: MouseEvent, id: string) => void }) {
  const status = statusOf(rec, nowMs);
  const due = dueText(rec);
  const recurring = rec.rule !== null && rec.rule !== 'once';
  return (
    <li>
      <a id={`row-${rec.id}`} className="row-link" href={`?r=${rec.id}`} aria-current={current ? 'true' : undefined} onClick={(e) => onOpen(e, rec.id)}>
        <span className="callno">{rec.id}</span>
        <span className="row-main">
          <span className="row-text">{rec.text}</span>
          <span className="row-meta">
            {group === 'scheduled' || group === 'attention' ? (
              <>
                <span className="row-line">
                  {due ? <span className="when">{due.when}</span> : null}
                  <span>{rec.tz}</span>
                  {status.key === 'scheduled' ? <span className="relative">{relativeTime(rec.nextDue, nowMs)}</span> : null}
                </span>
                <span className="row-line">
                  {status.key !== 'scheduled' ? <StatusMark status={status} /> : null}
                  <span className="rule">
                    {recurring ? <RepeatIcon /> : null}
                    {rec.ruleLabel}
                  </span>
                </span>
              </>
            ) : null}
            {group === 'unscheduled' ? <span className="row-line">No time set. Never sent.</span> : null}
            {group === 'delivered' ? (
              <span className="row-line">
                <StatusMark status={status} />
                {due ? (
                  <span>
                    was due <span className="when">{due.when}</span>
                  </span>
                ) : null}
                <span>{rec.tz}</span>
              </span>
            ) : null}
          </span>
        </span>
        <span className="row-go">
          <ChevronIcon />
        </span>
      </a>
    </li>
  );
}

function Welcome({ pollSeconds, empty }: { pollSeconds: number; empty: boolean }) {
  return (
    <div className="card welcome">
      <h2>{empty ? 'How reminders work here' : 'Choose a reminder to see its details'}</h2>
      <p>{empty ? 'Once something is saved, the list shows what is scheduled and when, what is kept as a note, and which one-offs were already delivered.' : 'The list shows what is saved right now: what is scheduled and when, what is kept as a note, and which one-offs were already delivered.'}</p>
      <dl className="facts">
        <div>
          <dt>Where reminders arrive</dt>
          <dd>In the reminder checker’s chat (the factory chat in VS Code), as a message starting with “Reminder R-…”. Only while that checker is running.</dd>
        </div>
        <div>
          <dt>Chat and this page</dt>
          <dd>Both read and write the same database. A change made in one shows in the other; here within {pollSeconds} seconds.</dd>
        </div>
        <div>
          <dt>Times</dt>
          <dd>Every time is shown in the reminder’s own timezone, with its UTC offset.</dd>
        </div>
      </dl>
    </div>
  );
}

function DefaultTimezone({ value, disabled, onSaved }: { value: string | null; disabled: boolean; onSaved: (zone: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  const wasEditing = useRef(false);

  // Opening puts focus in the field. Closing, saved or cancelled, removes the form and its focused
  // button, so focus goes back to the button that opened it.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (wasEditing.current) changeRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (draft.trim() === '') return setError('Enter a timezone, for example Europe/Budapest.');
    setSaving(true);
    try {
      const result = await saveDefaultTimezone(draft.trim());
      onSaved(result.defaultTimezone);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The timezone could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <p className="tz-default">
        <span>
          Default timezone for new reminders: <strong>{value ?? 'none saved yet'}</strong>
        </span>
        <button type="button" className="btn btn-quiet" ref={changeRef} aria-disabled={disabled || undefined} onClick={() => { if (!disabled) { setDraft(value ?? ''); setError(null); setEditing(true); } }}>
          {value ? 'Change' : 'Set one'}
        </button>
      </p>
    );
  }
  return (
    <form className="tz-default tz-form" onSubmit={submit} noValidate>
      <div className={`field${error ? ' field-invalid' : ''}`}>
        <label htmlFor="default-tz">Default timezone for new reminders</label>
        <input id="default-tz" ref={inputRef} value={draft} onChange={(e) => { setDraft(e.target.value); setError(null); }} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? 'default-tz-error default-tz-hint' : 'default-tz-hint'} />
        <p className="hint" id="default-tz-hint">
          An IANA name such as Europe/Budapest. Existing reminders keep the timezone they were saved with.
        </p>
        {error ? (
          <p className="field-error" id="default-tz-error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" aria-disabled={saving || undefined}>
          {saving ? 'Saving…' : 'Save default'}
        </button>
        <button type="button" className="btn" onClick={() => { setEditing(false); setError(null); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
