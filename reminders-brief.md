# Reminders brief (agreed behaviour)

What the chat reminder service is and must keep doing. How to operate it: [reminders-guide.md](reminders-guide.md). Built by factory task T-001 (text), extended by T-002 (scheduled and recurring reminders, checker) and by T-003 (SQLite database shared with a browser app: [browser-app-brief.md](browser-app-brief.md)); changes to anything here go through the active development queue in [FACTORY.md](FACTORY.md).

## Purpose and scope

- The user adds, lists, modifies and removes reminders in ordinary chat, in any conversation on this project, including fresh ones, and can do the same in the browser app.
- A reminder is unscheduled text, a one-off at a date and time, or recurring. Due reminders appear as readable chat messages, each naming its reminder ID, in one identified user-visible chat, and their saved state advances.
- One reminder checker, created through the harness's native scheduling and recorded in FACTORY.md "Reminder checker", delivers all due reminders. It is separate from the factory dispatcher. No per-reminder jobs, coded timers, launchers, polling daemons or external schedules; no notifications outside that chat. The browser app shows and changes reminders but never checks or sends them.
- Explicit loading: a fresh conversation is given the absolute project path and the starting request "Read FACTORY.md and reminders-guide.md in this project, then list my reminders."

## Storage (changed by T-003, verified 2026-10-13)

- The reminders live in one SQLite database, `C:\_Work\my-software-factory\data\reminders.db`. It is the sole writable store, shared by chat, browser and the checker. There is no Markdown store and no mirror.
- The former store `REMINDERS.md` was migrated with its `Next ID` (R-0007) and unconfirmed default timezone; it held no records at that moment. The import was compared value by value with the source before the switch; the same procedure is checked on a fixture with unscheduled, recurring, completed and pending records (`npm test`).
- The old file is kept only as a labelled historical backup in `backups\markdown-store-pre-sqlite\`. It is never read, written or imported again, and nothing requires `REMINDERS.md` to exist.

## Files

- `C:\_Work\my-software-factory\data\reminders.db`: the canonical database.
- `C:\_Work\my-software-factory\reminders.config.json`: names the database path, the app's port and its refresh interval.
- `C:\_Work\my-software-factory\lib\reminders\`: the shared operations (`ops.mjs`), database access (`db.mjs`), path (`paths.mjs`) and timezone calculations (`time.mjs`, named IANA zones from the data built into Node.js; holds no state).
- `C:\_Work\my-software-factory\reminders.sh` → `reminders-cli.mjs`: the chat and checker command.
- `C:\_Work\my-software-factory\reminders-guide.md`: operating instructions, reread by every service conversation and every checker tick.
- `C:\_Work\my-software-factory\reminders-brief.md`: this file. Browser app: `browser-app-brief.md`.

## Records

- Each reminder has a stable unique ID `R-NNNN` and its text (one line, at most 2000 characters). A scheduled reminder also has: state (active or completed), named IANA timezone, recurrence rule, resolved next due instant (UTC) and its local reading, the pending occurrence with the check's run handle and time, the last delivered occurrence and its acknowledgement time, and its delivery destination.
- A reminder without a schedule is unscheduled and is never due.
- Editing, scheduling or deleting one record never changes another record or any ID.
- IDs are never reused: the database's next-ID counter only increases, so an old request naming a removed ID cannot hit a different reminder.
- The database is the only source of truth. Cached conversation history, an open browser tab and old files are not the store; every request rereads the guide and the current records before answering or writing.

## Chat behaviour

- Add saves the requested text, and the schedule when one was asked for, and returns the ID, text and saved schedule.
- List rereads the database and shows current IDs and texts with their schedule state, or clearly states that it is empty.
- Modify identifies the record, preserves its ID and saves the requested change to its text, or to its date, time, timezone or recurrence.
- Remove deletes only the identified record with its schedule and confirms its absence. "Stop sending" keeps the text and drops the schedule.
- Every scheduling reply confirms the saved date, local time, timezone and recurrence.
- Timezone comes from the user's request or a default the user confirmed (saved in the database); otherwise the service asks. The host's timezone is never adopted.
- Relative dates are resolved against the current date in the reminder's timezone. Ambiguous dates, times or recurrence are asked about, not guessed. Times not in the future are refused.
- Targets may be named by ID or in ordinary language. When the target or the requested change is ambiguous, the service asks; it never rewrites several records to guess.

## Schedule semantics

- One-off: at a local date and time in its timezone. It becomes completed only after its occurrence is delivered and acknowledged.
- Calendar rules (daily, weekly on named weekdays, monthly on a day of the month, last day in shorter months) keep their local time in the named timezone across clock changes.
- Duration rules (every N minutes, hours or 24-hour days) advance by exactly that duration.
- The next occurrence is always calculated from the saved scheduled occurrence, never from the time the check happened to run.
- After downtime: one catch-up message per overdue reminder, labelled late. A recurring reminder then advances to its first future occurrence; missed occurrences are not replayed.
- Clock changes: a local time that does not exist is moved forward by the gap; a local time that happens twice fires at its first passage only. The service discloses this when it applies. Nothing is sent twice because of a clock change.
- Not supported (the service says so and offers the nearest rule): yearly, every-other-week/month calendar rules, nth-weekday-of-month, end dates or repeat counts, seconds.

## Delivery

- Destination: the chat recorded in FACTORY.md "Reminder checker". The checker's reply in that chat is the delivery; a file, log, command output, database row or browser page is not.
- Each check: select due occurrences in one write transaction and mark them pending (the recheck that the record exists, is active and is due is part of that step); write the messages; only then acknowledge each one, which rechecks in a write transaction that the record still exists, is active and still has that pending occurrence before completing or advancing it. Nothing due → the check stays silent.
- Edits and removals, from chat or browser, affect the next check; a superseded, stopped or removed occurrence is not sent, and an acknowledgement for one is refused.
- Overlapping checks cannot both send an occurrence.
- A pending occurrence that was never acknowledged is delivery-uncertain: reported once, never resent automatically, reconciled by acknowledging it (it was seen) or releasing it (it was not). Delivery is therefore at most once per occurrence automatically, not exactly once: an interruption between the message and the acknowledgement cannot be told apart from one before the message.
- Delivery happens only while the checker's owning session is open and idle; nothing is promised while it is busy, closed, expired, or the host is asleep or off. The browser app being open, closed or stopped makes no difference.

## Shared writes

- All writers (chat, browser, checker) go through the shared operations in `lib/reminders/ops.mjs`.
- Each write is one SQLite transaction started with `BEGIN IMMEDIATE`: the write lock is taken first, the latest record is re-read inside it, only the intended record is changed, and the change is committed atomically. A writer that finds the database locked waits up to 5 seconds, then fails without changing anything.
- A browser change names the revision it was based on and is refused when the record's text or schedule changed since; nothing is merged or overwritten silently.
- No lock is held while a chat message is written or while waiting; the acknowledgement opens a new transaction and re-reads.
- An interrupted writer cannot leave a half-written record: SQLite rolls the transaction back. `reminders.sh recover` checks the database afterwards.

## Routing

- Building or changing the service → the factory's active development queue.
- Ordinary reminder use → follow reminders-guide.md directly; no queue entry, no worker.
