# Session summary — part 3: scheduled and recurring reminders (in progress)

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

This covers everything from the "Queue one task titled Add Scheduled and Recurring Reminders" request to the request for this summary. Earlier parts are the previous versions of this file in git.

## Status

**T-002 is not complete.** It is claimed and in its last phase: live delivery checks in this chat. The worker's files and isolated checks are done, the reminder checker job exists, and four disposable test reminders were set up. When this summary was requested, no test reminder had come due yet, so no live delivery has been observed.

## State at the start

- Factory enabled: dispatcher job `35e2fcfd`, every minute, pickup enabled, no active assignment.
- Queue: T-001 checked, nothing unchecked.
- Text-only reminder service from T-001 in place; store empty, next ID `R-0003`.
- Two idle dispatcher ticks fired between the part 2 summary and the intake request.

## What was asked

1. **Intake request.** Queue one task, "Add Scheduled and Recurring Reminders", with the supplied brief. Intake only.
2. **This summary.**

## What was done, in order

### Intake

1. Reread `FACTORY.md` and `TODO.md`: TODO intake open, no GitHub route, no active claim, no unfinished or matching entry. The prerequisite service files exist.
2. Saved the brief to a scratch file without the tags and intake instructions, with one added first line: `Project path: C:\_Work\my-software-factory`.
3. Under the queue lock, rechecked intake and duplicates, then inserted `T-002: Add Scheduled and Recurring Reminders` at the end of the unchecked entries, above the checked T-001 (`TODO.md` line 13, brief on lines 14–61; T-001 moved down to line 63, unchanged).
4. Diffed the saved entry against the brief: identical.
5. Reported "queued" with the reference and stopped. Pickup and the dispatcher job were not touched.

### Dispatch

6. The next scheduled tick fired by itself. Under the lock the controller confirmed pickup was enabled and nothing was claimed, took T-002 and wrote the active-assignment pointer. Host clock at that point: 12:42 local (+02:00), Windows zone "Central Europe Standard Time".
7. Reported "picked up" and "worker starting", and said the controller would create the checker and run the delivery checks itself afterwards.
8. Launched one fresh foreground worker (agent id `a45fd1ae952df36d6`). Its prompt gave the project path, told it to read `FACTORY.md` and the full T-002 entry from `TODO.md`, and split the work:
   - worker: store format, script, brief, guide, `FACTORY.md` documentation, and every check that needs no real scheduled run or chat delivery;
   - controller: create the checker job, live checks 1–3, the one-dispatcher/one-checker verification, cleanup.
   - The worker was told not to call any scheduling tool, not to commit, and not to adopt the host timezone silently.
9. The worker ran for about 17 minutes (30 tool calls). No tick fired during that time.

### What the worker built

- `reminders.sh` — extended. New commands: `schedule`, `unschedule`, `resolve`, `now`, `tz`, `due`, `ack`, `retry`; `add` accepts a schedule.
- `reminders-time.ps1` — new. Timezone maths helper called by the script; holds no state.
- `REMINDERS.md` — header rewritten: new format description and `Default timezone: (not confirmed)`. No records were added and no real ID was used.
- `reminders-guide.md`, `reminders-brief.md` — rewritten for scheduling, the checker tick, reconciliation and limits.
- `FACTORY.md` — "Reminder service" extended, a new "Reminder checker" section added (identity, saved prompt, paths, destination, cadence, lifetime, controls, recovery), and one sentence added to the dispatcher's renewal bullet.

**Record format.** The original line is unchanged; a scheduled reminder has one extra line beneath it:

    - R-0007: call the dentist
      ~ R-0007 | state=active | tz=Europe/Budapest | rule=weekly:MO@09:00 | next=2026-10-19T07:00:00Z | local=... | pending=- | prun=- | pmarked=- | pnote=- | last=- | acked=-

A record without the `~` line is unscheduled and never due.

**Schedules supported.** One-off (`--at`), duration (`every:N` minutes, hours or days) and calendar (`daily@HH:MM`, `weekly:MO,WE@HH:MM`, `monthly:D@HH:MM`). Refused: past times, unknown zones, seconds, yearly, nth-weekday, end dates or counts.

**Timezone.** Every scheduled reminder carries an IANA zone. The service must ask the user unless a confirmed default is saved; none is. The host's timezone is never used. Git Bash on this host has no timezone database, so the helper uses Windows PowerShell 5.1 with Windows' own zone data.

**Delivery flow.**
1. `due`, under the shared lock, selects each active record whose time has arrived, marks that occurrence pending and prints the messages. Nothing due prints exactly `NOTHING_DUE`.
2. The controller writes the messages in chat. That reply is the delivery.
3. `ack <ID> <occurrence>`, under the lock, confirms the record still has that pending occurrence, then completes a one-off or advances a recurring reminder to its first future occurrence, calculated from the saved occurrence.

**Semantics.**
- Catch-up: one message per overdue reminder, labelled late when 5 minutes or more overdue; no replay of missed occurrences.
- Calendar rules keep their local time across clock changes. Duration rules advance by exact duration, so `every:1d` shifts an hour on the local clock.
- A local time that does not exist (spring) moves forward by the gap. A repeated local time (autumn) fires at its first passage only.
- An occurrence left pending for over two minutes is reported once as "delivery uncertain" and never resent automatically. It is settled with `ack` or, on the user's word, `retry`.
- An edit or removal clears a pending mark; a later `ack` is refused.

### Worker's checks (as it reported them, all on scratch copies with an injected clock)

- **Overdue catch-up — passed.** After a four-day jump, one `due` printed one message each for three overdue records. A second `due` before any ack printed `NOTHING_DUE`. After ack, the one-off was completed and both recurring records advanced to the correct first future occurrence.
- **Clock changes, Europe/Budapest — passed.** `daily@02:30` fired once on the autumn change day and moved to 03:30 on the spring change day; `daily@09:00` kept its local time; `monthly:31` clamped to shorter months.
- **Edit and remove, isolated — passed.** A rescheduled one-off and a removed one did not appear at the old time.
- **Uncertain delivery — passed.** Silent at 60 s, reported once at 150 s, silent after; `retry` released it for one late send.
- **Overlap and write protection — passed.** Eight simultaneous `due` runs over six due records delivered each occurrence exactly once. Concurrent acks, adds, a modify and a remove lost nothing. A live lock blocked `due` and `ack` without changing the store.
- **Backwards compatibility — passed.** Unscheduled records kept their IDs and were never selected.
- **Real clock on a scratch copy — passed.** An `every:1m` record was delivered and advanced by 60 s.

The test clock variable works only on a scratch directory; it is refused against the real store.

### Controller steps after the handoff

10. Inspected the result: files present, `FACTORY.md` State section intact, checker section complete with placeholders, real store empty with next ID `R-0003`, `due` on the real store gave `NOTHING_DUE`, no leftover locks.
11. Created the reminder checker with CronCreate: job `6ffb2e2a`, cron `* * * * *`, using the worker's saved prompt.
12. Filled the placeholders in `FACTORY.md`: `Checker job: 6ffb2e2a (created 2026-10-13, expires 2026-10-20)`.
13. Updated the active-assignment pointer to "controller live delivery checks".
14. At 13:00 local, added the disposable test reminders, zone named as Europe/Budapest for the tests only:
    - `R-0003` T002-LIVE-ONEOFF, one-off, due 13:03.
    - `R-0004` T002-LIVE-RECUR, every 2 minutes, first due 13:02:38.
    - `R-0005` T002-LIVE-EDIT, one-off at 13:04, then rescheduled to 13:08.
    - `R-0006` T002-LIVE-REMOVE, one-off at 13:04, then removed.
15. Reported "waiting" and ended the turn so ticks could fire.
16. Two dispatcher ticks fired (13:00:59, 13:01:10). Each found T-002 still claimed and launched nothing. CronList showed exactly two jobs: `35e2fcfd` and `6ffb2e2a`.
17. The first checker tick fired by itself at 13:01:19, read the store, ran `due`, got `NOTHING_DUE` and stayed quiet.
18. The summary request arrived before any test reminder was due. This file was written, replacing the part 2 text.

## Files

| File | State |
|---|---|
| `reminders.sh` | Modified. |
| `reminders-time.ps1` | New, untracked. |
| `REMINDERS.md` | Modified: new header, three test records present. |
| `reminders-guide.md`, `reminders-brief.md` | Modified. |
| `FACTORY.md` | Modified: checker section, checker id, active-assignment pointer. |
| `TODO.md` | Modified: T-002 added, still unchecked. |
| `SUMMARY.md` | Modified: this file. |

Nothing was committed in this part.

## Current state

- Pickup: enabled. Dispatcher job `35e2fcfd`. Checker job `6ffb2e2a`. Both every minute, both expire 2026-10-20.
- Active assignment: T-002, controller live checks.
- Store: `R-0003`, `R-0004`, `R-0005` are test records; `R-0006` is removed. Next ID `R-0007`.
- Default timezone: not confirmed.

## Still to do for T-002

1. Observe the one-off message for `R-0003`, its completed state, and no resend.
2. Observe two deliveries of `R-0004`, each advancing by 120 s.
3. Confirm nothing arrived for the old 13:04 time of `R-0005` or for `R-0006`; only `R-0005` at its new time.
4. Remove the test records, confirm exactly one dispatcher and one checker, check T-002 off, clear the pointer.

Writing this summary kept the session busy, so the first test messages will arrive late and may be labelled as catch-up. That delays the checks but does not invalidate them.

## Not yet verified

- Any live delivery in this chat (checks 1–3).
- The fresh-conversation path for scheduled reminders.
- From earlier parts: a tick coming due during a run, and behaviour across expiry, sleep and restart.

## Things to know

- Not exactly-once. A tick interrupted between writing the message and `ack` leaves the occurrence uncertain; it is held, not resent.
- The checker shares this session with the dispatcher and fires only while the session is idle. While a worker runs, or the session is closed, or the machine sleeps, nothing is delivered; each overdue reminder arrives once afterwards.
- Both jobs are session-only and expire after seven days. Restart with the factory starting request.
- Every checker tick is a model turn, including when nothing is due. With two jobs, idle ticks now arrive twice a minute.
- PowerShell on this host intermittently starts in a restricted mode and fails; the script retries up to five times and exits without writing if it still fails.
- Git warns that line endings will be converted to CRLF. A CRLF checkout of `reminders.sh` would break it under bash.
