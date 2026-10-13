# Reminders guide (operating instructions)

How any conversation operates the reminder service, how the reminder checker delivers due reminders, and how the browser app fits in. Agreed behaviour: [reminders-brief.md](reminders-brief.md) and [browser-app-brief.md](browser-app-brief.md). Factory rules, the checker's controls and the app's controls: [FACTORY.md](FACTORY.md) ("Reminder service", "Reminder checker", "Reminders browser app").

Fresh service conversation: give it the absolute project path `C:\_Work\my-software-factory` and this starting request:

> Read FACTORY.md and reminders-guide.md in this project, then list my reminders.

## Paths

- Canonical store: the SQLite database `C:\_Work\my-software-factory\data\reminders.db`. It is the only place reminders and their schedule state live. Chat, the browser app and the reminder checker all use this one file; the path is recorded in `reminders.config.json` and resolved only by `lib\reminders\paths.mjs`.
- Chat and checker command: `C:\_Work\my-software-factory\reminders.sh` (run with Git Bash: `bash "C:/_Work/my-software-factory/reminders.sh" <command>`). It starts `reminders-cli.mjs` with Node.js (found at `C:\Program Files\nodejs` even when it is not on the PATH) and needs nothing else.
- Shared operations: `C:\_Work\my-software-factory\lib\reminders\ops.mjs`. Never run, import or edit them during ordinary use.
- Browser app: `http://localhost:3210` on this PC (see "Browser app" below).
- There is no Markdown store. `REMINDERS.md` does not exist and must not be recreated; its last content is a historical backup (see "Migration").

Check which database a command uses: `bash "C:/_Work/my-software-factory/reminders.sh" status`.

## Rules for every service conversation

1. Before answering or writing any reminder request, reread this guide and the current records from the database (`reminders.sh list`). Do this for every request, not once per conversation.
2. Conversation history, memory, earlier tool output and anything seen in a browser are not the store. Never answer "what are my reminders" from them, and never pick a target from them without relisting. The user may have changed reminders in the browser since your last command.
3. A reminder is either unscheduled (stored text, never due, never sent) or scheduled (one-off or recurring). Scheduled reminders are delivered only by the single reminder checker recorded in FACTORY.md "Reminder checker", as a chat message in that section's destination. Never create a scheduled job, cron entry, timer or loop for a reminder, and never send a due reminder yourself outside "Checker tick" below.
4. When you confirm a scheduled reminder, say where and when it arrives: in the destination chat named in FACTORY.md "Reminder checker", only while that checker is running, possibly late (see "What delivery does and does not promise"). If that section records `Checker job: none`, say that the reminder is saved but nothing will be sent until the checker is restarted.
5. Using reminders is ordinary application use: do it directly, here, without the factory queue. A request to build or change the service itself (database, commands, app, guide, rules, new features) is development: route it through the active development queue in FACTORY.md and do not edit these files directly.
6. Do not edit TODO.md, the State section of FACTORY.md or any scheduled job while using reminders.
7. Read and write reminders only with `reminders.sh`. Never open the database with another tool, never copy it to work on a copy, and never write reminders to a Markdown or other file.

## Timezone, dates and times

- Every scheduled reminder carries a named IANA timezone (`Europe/Budapest`, `America/New_York`, `UTC`). Take it, in this order, from: the user's request ("9am New York time"); the saved default (`reminders.sh tz` prints it); otherwise **ask the user**. Never take it from the host: not from the machine clock or its settings, not from `date`, not from an offset shown in environment information. The host may be remote and is not evidence of where the user is.
- Save a default only after the user has confirmed their timezone in this conversation: `reminders.sh tz <Zone>`. Map a city or abbreviation to an IANA name and say which name you saved ("CET" → ask which city; "Budapest" → `Europe/Budapest`). A different default later does not change existing reminders. The user can also set it in the browser app.
- Relative dates and times ("tomorrow", "next Friday", "in two hours", "tonight") are resolved against the current date and time **in the reminder's timezone**: run `reminders.sh now --tz <Zone>` and calculate from its output, not from your own idea of today. "In N minutes/hours" becomes a one-off at that local time, rounded up to the next whole minute.
- Ask, and save nothing until answered, when: no time of day was given; a 12-hour time has no am/pm ("at 5"); a numeric date could be read two ways (03/04); the weekday reference is unclear ("next Friday" said on a Friday or Thursday); the time has already passed today (today is impossible; tomorrow?); a recurrence lacks its day or time ("every month", "weekly"); or the wording could be a calendar rule or an exact duration ("every day" = each day at the same local time, or every 24 hours?).
- The command refuses a time that is not in the future and a timezone it does not know (exit 1, nothing saved): ask the user, do not guess a nearby value.
- `reminders.sh resolve <SCHEDULE>` shows exactly what would be saved without writing. Use it whenever you are unsure, or to show the user a clock-change note before saving.
- After saving, confirm from the command's actual output: ID, text, local date and time with UTC offset, timezone, recurrence, and any `NOTE:` line.

## Schedules supported

| Kind | SCHEDULE arguments | Meaning |
|---|---|---|
| One-off | `[--tz Z] --at "YYYY-MM-DD HH:MM"` | once, at that local time in Z; then completed |
| Daily | `[--tz Z] --rule daily@HH:MM [--from YYYY-MM-DD]` | every day at that local time |
| Weekly | `[--tz Z] --rule weekly:MO,WE,FR@HH:MM [--from …]` | listed weekdays (MO TU WE TH FR SA SU) at that local time; "every weekday" = `weekly:MO,TU,WE,TH,FR` |
| Monthly | `[--tz Z] --rule monthly:D@HH:MM [--from …]` | day D (1–31) of each month; in a shorter month, its last day. Say so when D is 29–31 |
| Duration | `[--tz Z] --rule every:N{m\|h\|d} [--at "YYYY-MM-DD HH:MM"]` | every N minutes / hours / 24-hour days exactly, counted from the first occurrence (`--at`; without it, one duration from now) |

- Times are 24-hour local times in the reminder's timezone. `--tz` may be omitted only when a confirmed default is saved. `--from` is the first local date allowed (default: the first occurrence after now).
- Calendar rules (daily/weekly/monthly) keep their local time when clocks change. Duration rules advance by the exact duration, so `every:1d` or `every:14d` lands one hour earlier or later on the local clock after a clock change. Tell the user and offer a calendar rule if they meant "same time each day".
- Smallest duration is one minute, the checker's cadence. Whole numbers only.
- **Not supported. Say so and offer the nearest supported rule, do not approximate silently:** yearly; "every other week/month" as a calendar rule (only as an exact duration such as `every:14d`); "last Friday / first Monday of the month"; several times in one rule (use several reminders); end dates or a number of repeats (the user removes or stops it); seconds.

### Clock changes

- A local time that does not exist that day (clocks go forward, e.g. 02:30 on 2027-03-28 in Europe/Budapest) is moved forward by the gap: it fires at 03:30 that day, and at 02:30 again on normal days.
- A local time that happens twice (clocks go back, e.g. 02:30 on 2026-10-25) fires at its first (earlier) passage only; the second passage is never a separate occurrence, so nothing is sent twice.
- The command prints a `NOTE:` line whenever a saved or advanced occurrence was affected. Relay it.
- Timezone rules come from the timezone data built into Node.js; a government changing its rules is reflected only after Node.js is updated.

## Operations

Reply with the command's actual output, not with what you expect it to be.

| Request | Do | Reply |
|---|---|---|
| Add, no time ("add a reminder to call the dentist") | `reminders.sh add "<text>"` | the new ID and text; say it is unscheduled and will not be sent |
| Add with a time ("remind me tomorrow at 9 to call the dentist") | settle timezone/date/time/recurrence as above, then `reminders.sh add "<text>" <SCHEDULE>` | ID, text, saved local date/time, offset, timezone, recurrence, where it will arrive |
| List ("list my reminders") | `reminders.sh list` | every ID and text with its schedule line (active / completed, next due, rule, any delivery in progress or uncertain), or clearly "No reminders saved." |
| Modify text ("change R-0002 to …") | list, identify exactly one record, `reminders.sh modify <ID> "<full new text>"` | unchanged ID, new text, unchanged schedule |
| Modify time, timezone or recurrence ("move R-0002 to Friday 10:00", "make it weekly") | list, identify one record, `reminders.sh schedule <ID> <SCHEDULE>` | ID, the complete new schedule, the previous one |
| Stop sending but keep the text | `reminders.sh unschedule <ID>` | that it is now unscheduled text |
| Remove ("delete R-0002", "drop the dentist one") | list, identify exactly one record, `reminders.sh remove <ID>`, then list again | which record was removed, that it is gone and nothing more will be sent for it |

- Save the user's wording as the text, without the date/time phrase when a schedule was saved; one reminder is one line (line breaks become spaces) of at most 2000 characters. Do not add several reminders from one request unless the user clearly asked for several.
- `modify` replaces the whole text and never touches the schedule. For a partial change ("make it Tuesday instead of Monday" in the *text*) read the current text from the fresh list, apply the change and pass the full new text.
- `schedule` replaces the whole schedule: restate everything (timezone, rule, time), taking unchanged parts from the fresh list. It also reactivates a completed one-off. A change to both text and time is two commands.
- Edits and removals take effect at the next check: a superseded time, a stopped and a removed reminder are not sent. If the command prints a `NOTE:` that an occurrence was being delivered while you changed it, tell the user it may already have appeared.
- A completed one-off stays listed as completed until the user removes or reschedules it.
- For text containing quotes, `$`, backticks or backslashes, pass `-` as the text and feed it on stdin with a quoted heredoc so the shell does not alter it:

      bash "C:/_Work/my-software-factory/reminders.sh" add - --tz Europe/Budapest --at "2026-11-02 09:00" <<'EOF'
      Ask "Sam" about the $50 invoice
      EOF

## Identifying the target

- An ID (`R-0003`, `r-3`, `3`) names the record directly. If that ID is not in the fresh list, say so and change nothing. It may have been removed, in chat or in the browser; removed IDs are never given out again, so never substitute another record.
- Ordinary language ("the dentist one") is matched against the fresh list. Proceed only when exactly one record matches; state its ID in the reply.
- If zero or several records match, or it is unclear what the new text or schedule should be, ask the user (show the candidate IDs, texts and schedules) and change nothing until they answer.
- Never modify or remove several records to guess a target. "Remove all of them" needs an explicit request, then one `remove` per ID from the fresh list.

## Browser app

- Address: `http://localhost:3210` (also `http://127.0.0.1:3210`), reachable only from this PC. It needs the app process to be running: FACTORY.md "Reminders browser app" has status, start, restart and stop. Chat and the checker work whether or not the app is running.
- It shows the same records as `reminders.sh list`, grouped as: needs your attention (delivery uncertain), scheduled, not scheduled, delivered. It can create, edit text and schedule, stop sending, remove, and set the default timezone, through the same operations as chat, so the same values are refused and the same notes appear.
- Refresh interval: the page rereads the database every **5 seconds** while its tab is visible, when the tab or window regains focus, after every change made in it, and on its Refresh button. A change made in chat or by the checker can therefore take up to 5 seconds to show there; a change made in the browser is visible to the very next `reminders.sh` command. Nothing is cached. If the user says the page shows something else, relist and trust the database.
- The page never sends reminders and does not reconcile uncertain deliveries; that stays in chat ("Reconciling an uncertain delivery").
- If the page reports that it could not reread the list, the app process has stopped or the database is unavailable: check `bash "C:/_Work/my-software-factory/app.sh" status`.

## Store format

`reminders.sh list` prints each reminder as

    R-0007: call the dentist
        active; next due Mon 2026-10-19 09:00 +02:00 (Europe/Budapest) = 2026-10-19T07:00:00Z; rule weekly:MO@09:00

- A reminder printed without a second line is unscheduled and never due.
- State: `active`, or `completed` (a one-off whose occurrence was delivered and acknowledged).
- Timezone: IANA name. Rule: `once`, `daily@HH:MM`, `weekly:DAYS@HH:MM`, `monthly:D@HH:MM` or `every:N{m|h|d}`.
- Next due: the local reading in the reminder's timezone, then the same instant in UTC.
- `delivery in progress for occurrence …`: a check has selected that occurrence and not yet acknowledged it. `DELIVERY UNCERTAIN …`: it stayed unacknowledged and was reported.
- In the database these are the columns of the `reminders` table (`n`, `text`, `state`, `tz`, `rule`, `next_due`, `next_local`, `pending`, `prun`, `pmarked`, `pnote`, `last`, `acked`, `destination`, `rev`); the next ID and the default timezone are rows of the `meta` table. `reminders.sh list --json` prints the same records for tools.

## Checker tick (the reminder checker's whole job)

A checker tick is one invocation of the scheduled checker prompt recorded in FACTORY.md "Reminder checker". The reply you write in this chat **is** the delivery; a command's output, a database row, a browser page or a log is not.

1. Run once: `bash "C:/_Work/my-software-factory/reminders.sh" due`
   In one database write transaction it rereads the records, selects every active reminder whose next due instant has arrived, marks that occurrence pending and prints what to deliver. Selecting and rechecking are one step, so a reminder edited, stopped or removed before this moment, in chat or in the browser, is not selected.
2. Output is exactly `NOTHING_DUE`: end the turn and write nothing. No summary, no "nothing due".
3. Otherwise, write the reply text **first**: every `MESSAGE` line, one per paragraph, unchanged apart from dropping the word `MESSAGE` (each already starts with `Reminder R-NNNN:` and carries the due time, timezone and any `LATE … catch-up` label). Add nothing that could be mistaken for another reminder.
4. Only after that text is written, for each `DELIVER <ID> <occurrence>` line run `reminders.sh ack <ID> <occurrence>`. Never acknowledge before the message is written, and never acknowledge a message you did not write.
   - Exit 0: a one-off is now completed; a recurring reminder advanced to its first future occurrence. Relay any `NOTE:` line.
   - Exit 4 (refused: edited, rescheduled, stopped or removed while the message was being written): tell the user that the reminder just shown was changed or removed at the same moment and that its new state applies. Do nothing else.
   - Exit 3 (database busy): retry the ack once. If it still fails, say so; the occurrence stays pending and is reconciled as below.
5. For each `UNCERTAIN <ID> <occurrence>` line (an earlier check selected it but never acknowledged it; it may or may not have been shown): write its `MESSAGE` text, and do **not** resend the reminder as if new. Then reconcile, see next section.
6. `due` failing: exit 3 → end silently, the next tick retries. Exit 1 → report the error text once; do not repeat it on later ticks while it is already the checker's latest message here.
7. Do nothing else in a tick: no other reminder commands, no edits to TODO.md, FACTORY.md or any scheduled job, no scheduling tools, no browser.

### Reconciling an uncertain delivery

An occurrence is uncertain when its pending mark is older than two minutes and unacknowledged. It is reported once (then `list` and the browser show it) and is never resent automatically; a recurring reminder does not advance while it is pending.

- This conversation visibly contains the delivered `Reminder R-NNNN: …` message for that occurrence (same ID and due time), or the user says they saw it → `reminders.sh ack <ID> <occurrence>`.
- The user says they did not get it → `reminders.sh retry <ID> <occurrence>`; the next check sends it once, labelled late.
- Otherwise ask the user which it was and leave it pending. Never `retry` on a guess: that is how a duplicate would be sent.

### What delivery does and does not promise

- Checks run about once a minute while the owning session is open **and idle**. A reminder due while the session is busy (for example while a factory worker runs), closed, or while the machine sleeps or is off is delivered at the first check afterwards, once, labelled `LATE … catch-up`. Punctual delivery while stopped is not possible. Whether the browser app is open, closed or stopped makes no difference to delivery.
- After downtime each overdue reminder sends one message, however many occurrences were missed; a recurring reminder then advances to its first future occurrence, calculated from its saved scheduled occurrence (a calendar rule stays on its local time, a duration rule stays on its original grid).
- Overlapping checks cannot send the same occurrence twice: the pending mark is set inside the write transaction, and a second check skips it.
- Not exactly-once. If a check is interrupted after `due` and before `ack`, the database cannot know whether the message appeared. That occurrence is held as uncertain rather than resent, so the automatic behaviour is at most once per occurrence; a message can be missed until it is reconciled, and a duplicate can only result from a mistaken `retry`.
- An edit or removal that lands in the few seconds between `due` and the reply being written cannot stop that message; the acknowledgement is then refused and the user is told (step 4).

## Shared writes (all writers, no exceptions)

Every change goes through the shared operations: `reminders.sh` for chat and the checker, the app's own API for the browser. Do not use `sqlite3`, a database editor, a script of your own or a copy of the file. A writer that skips the shared operations skips validation, the never-reuse rule for IDs and the delivery checks.

What every writing command (`add`, `modify`, `schedule`, `unschedule`, `remove`, `tz`, `due`, `ack`, `retry`) and every browser change does:

1. Opens the one database and starts a write transaction (`BEGIN IMMEDIATE`), which takes SQLite's write lock. If another writer holds it, it waits up to 5 seconds.
2. Rereads the record inside the transaction.
3. Checks it (exists, expected state; for a browser edit, still the revision the user was looking at) and changes only that record.
4. Commits. SQLite makes the change all-or-nothing; a failure or an interruption rolls it back.
5. Reads the committed record back and reports from it. No lock is held while a message is being written or while waiting for a later check.

A browser edit that was based on an older version of the record is refused (the page shows the current values and keeps what the user typed); chat commands apply to the record as it is at that moment, which is why rule 1 requires relisting first.

IDs: the next-ID counter only goes up, and an ID at or below the highest existing one is never issued. Editing, scheduling or removing a record never changes any other record or ID.

## Migration (Markdown → SQLite)

- Stage: **complete** on 2026-10-13 by task T-003: backup taken, records imported and verified against the source, `REMINDERS.md` retired, `reminders.sh`, the browser app and the reminder checker job on the database. The checker job is recorded in FACTORY.md "Reminder checker" and the stage as `Migration stage` in `reminders.sh status`.
- Verified live database: `C:\_Work\my-software-factory\data\reminders.db`. At the switch it held no records, next ID R-0007 and no confirmed default timezone, the same as the source.
- Historical backup (labelled, never live): `C:\_Work\my-software-factory\backups\markdown-store-pre-sqlite\` with the byte-identical old `REMINDERS.md` (SHA-256 `41c9579999ea974021d1da8990b529509cb593cad48e497b31bb528e5cfadeb8`), the old `reminders.sh` (as `reminders.sh.markdown-era`) and `reminders-time.ps1`.
- After the switch SQLite is the live store. Never import the backup again and never copy it back to the project root: it would undo newer edits and removals. `scripts\migrate-from-markdown.mjs import` refuses once the stage is `switched` or `complete`.
- Inspect the stage: `"C:\Program Files\nodejs\node.exe" scripts\migrate-from-markdown.mjs status`. An incomplete migration (stage `imported`) is continued with `verify` then `switch`; these are development steps, not ordinary use.

## Recovery

- Exit 3, "database stayed locked": nothing was changed. Another writer was working; wait a moment and retry once.
- If it stays locked, or after a crash or power loss: run `bash "C:/_Work/my-software-factory/reminders.sh" recover`. It checks the database's integrity and that a write lock can be taken. SQLite rolls back an interrupted change by itself, so the change was either fully saved or not saved at all: list, tell the user which it was, and repeat the request only if the change is missing. A pending occurrence left by an interrupted check is reconciled as above, never by repeating the delivery.
- Exit 2, "no reminder with ID": nothing was changed; relist and ask.
- Exit 5, "changed somewhere else": only browser edits use it; nothing was changed.
- Exit 1 with "database … is missing" or "not a reminder database", or `recover` reporting an integrity failure: report it to the user and stop. Do not create a new database, do not point anything at another file and do not rebuild from the Markdown backup as part of ordinary use. The recovery route is a development or controller action:
  1. Stop the app (`bash app.sh stop`) and pause the reminder checker (FACTORY.md "Reminder checker").
  2. Keep the damaged file aside (rename it, do not delete it).
  3. Copy the newest good backup `backups\reminders-backup-<time>.db` to `data\reminders.db`. Changes made after that backup are lost; say so.
  4. `reminders.sh recover`, `reminders.sh list`, then start the app and resume the checker.
- Backups: `bash "C:/_Work/my-software-factory/reminders.sh" backup` writes a consistent copy to `backups\reminders-backup-<time>.db`. A backup is for recovery only; never point the app or `reminders.sh` at it.
- Only if no database backup exists and the user accepts losing everything saved since 2026-10-13: the Markdown-era files in `backups\markdown-store-pre-sqlite\` are the last resort, restored by a development task, never by ordinary use.
- Checker not running, expired or paused: FACTORY.md "Reminder checker". App not running: FACTORY.md "Reminders browser app".

## Test clock and test database (development only)

`REMINDERS_DB=<path to a scratch database>` makes the command and the app use that file instead of the canonical one; their output is then labelled as test data. `REMINDERS_TEST_NOW=<YYYY-MM-DDTHH:MM:SSZ>` replaces the current time and is refused (exit 1) unless `REMINDERS_DB` points at a scratch database, so it cannot move the clock of the canonical store. Never set either variable during ordinary use or in a checker tick.

## Examples

    User: Add a reminder: renew the car insurance
    Reply: Added R-0007: renew the car insurance (unscheduled, so it is stored but will not be sent).

    User: Remind me tomorrow at 9 to call Anna            (no default timezone saved)
    Reply: Which timezone should I use for 09:00? (for example Europe/Budapest)
    User: Budapest. Use that from now on.
    Do:    reminders.sh tz Europe/Budapest ; reminders.sh now --tz Europe/Budapest ; reminders.sh add "call Anna" --at "2026-10-14 09:00"
    Reply: Added R-0008: call Anna. One-off, Wed 2026-10-14 09:00 (+02:00, Europe/Budapest). It will arrive in the factory chat while the reminder checker is running. I saved Europe/Budapest as your default timezone.

    User: Remind me every Monday at 8:30 to send the report
    Do:    reminders.sh add "send the report" --rule weekly:MO@08:30
    Reply: Added R-0009: send the report. Every Monday at 08:30 Europe/Budapest, first on Mon 2026-10-19.

    User: Remind me at 5 to stretch
    Reply: 05:00 or 17:00? And today or tomorrow?

    User: List my reminders
    Reply: R-0007: renew the car insurance (unscheduled) / R-0008: call Anna, active, next Wed 2026-10-14 09:00 Europe/Budapest, one-off / …      (or: No reminders saved.)

    User: Move R-0008 to Thursday 10:30
    Do:    reminders.sh schedule R-0008 --tz Europe/Budapest --at "2026-10-15 10:30"
    Reply: Scheduled R-0008: call Anna. Now Thu 2026-10-15 10:30 (+02:00, Europe/Budapest), one-off; the earlier time will not be sent.

    User: Remove the report one
    Reply: Removed R-0009: send the report. Confirmed it is no longer saved; nothing more will be sent for it.

    Checker tick, something due:
    Reply: Reminder R-0008: call Anna  (due Thu 2026-10-15 10:30 +02:00 Europe/Budapest; one-off)
    Then:  reminders.sh ack R-0008 2026-10-15T08:30:00Z
