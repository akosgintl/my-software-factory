# Reminders guide (operating instructions)

How any conversation operates the chat reminder service, and how the reminder checker delivers due reminders. Agreed behaviour: [reminders-brief.md](reminders-brief.md). Factory rules and the checker's controls: [FACTORY.md](FACTORY.md) ("Reminder service", "Reminder checker").

Fresh service conversation: give it the absolute project path `C:\_Work\my-software-factory` and this starting request:

> Read FACTORY.md and reminders-guide.md in this project, then list my reminders.

## Paths

- Canonical store: `C:\_Work\my-software-factory\REMINDERS.md` — the only place reminders and their schedule state live.
- Reader/writer: `C:\_Work\my-software-factory\reminders.sh` (run with Git Bash: `bash "C:/_Work/my-software-factory/reminders.sh" <command>`).
- Timezone helper: `C:\_Work\my-software-factory\reminders-time.ps1` (called by the script; never run or edited during ordinary use).
- Write lock: `C:\_Work\my-software-factory\.reminders.lock` (a directory; exists only while a command is writing).

## Rules for every service conversation

1. Before answering or writing any reminder request, reread this guide and the current records from disk (`reminders.sh list` or read REMINDERS.md). Do this for every request, not once per conversation.
2. Conversation history, memory and earlier tool output are not the store. Never answer "what are my reminders" from them, and never pick a target from them without relisting.
3. A reminder is either unscheduled (stored text, never due, never sent) or scheduled (one-off or recurring). Scheduled reminders are delivered only by the single reminder checker recorded in FACTORY.md "Reminder checker", as a chat message in that section's destination. Never create a scheduled job, cron entry, timer or loop for a reminder, and never send a due reminder yourself outside "Checker tick" below.
4. When you confirm a scheduled reminder, say where and when it arrives: in the destination chat named in FACTORY.md "Reminder checker", only while that checker is running, possibly late (see "What delivery does and does not promise"). If that section records `Checker job: none`, say that the reminder is saved but nothing will be sent until the checker is restarted.
5. Using reminders is ordinary application use: do it directly, here, without the factory queue. A request to build or change the service itself (format, script, guide, rules, new features) is development: route it through the active development queue in FACTORY.md and do not edit these files directly.
6. Do not edit TODO.md, the State section of FACTORY.md or any scheduled job while using reminders.

## Timezone, dates and times

- Every scheduled reminder carries a named IANA timezone (`Europe/Budapest`, `America/New_York`, `UTC`). Take it, in this order, from: the user's request ("9am New York time"); the saved default (`reminders.sh tz` prints it); otherwise **ask the user**. Never take it from the host: not from the machine clock or its settings, not from `date`, not from an offset shown in environment information. The host may be remote and is not evidence of where the user is.
- Save a default only after the user has confirmed their timezone in this conversation: `reminders.sh tz <Zone>`. Map a city or abbreviation to an IANA name and say which name you saved ("CET" → ask which city; "Budapest" → `Europe/Budapest`). A different default later does not change existing reminders.
- Relative dates and times ("tomorrow", "next Friday", "in two hours", "tonight") are resolved against the current date and time **in the reminder's timezone**: run `reminders.sh now --tz <Zone>` and calculate from its output, not from your own idea of today. "In N minutes/hours" becomes a one-off at that local time, rounded up to the next whole minute.
- Ask, and save nothing until answered, when: no time of day was given; a 12-hour time has no am/pm ("at 5"); a numeric date could be read two ways (03/04); the weekday reference is unclear ("next Friday" said on a Friday or Thursday); the time has already passed today (today is impossible — tomorrow?); a recurrence lacks its day or time ("every month", "weekly"); or the wording could be a calendar rule or an exact duration ("every day" = each day at the same local time, or every 24 hours?).
- The script refuses a time that is not in the future and a timezone it does not know (exit 1, nothing saved): ask the user, do not guess a nearby value.
- `reminders.sh resolve <SCHEDULE>` shows exactly what would be saved without writing. Use it whenever you are unsure, or to show the user a clock-change note before saving.
- After saving, confirm from the script's actual output: ID, text, local date and time with UTC offset, timezone, recurrence, and any `NOTE:` line.

## Schedules supported

| Kind | SCHEDULE arguments | Meaning |
|---|---|---|
| One-off | `[--tz Z] --at "YYYY-MM-DD HH:MM"` | once, at that local time in Z; then completed |
| Daily | `[--tz Z] --rule daily@HH:MM [--from YYYY-MM-DD]` | every day at that local time |
| Weekly | `[--tz Z] --rule weekly:MO,WE,FR@HH:MM [--from …]` | listed weekdays (MO TU WE TH FR SA SU) at that local time; "every weekday" = `weekly:MO,TU,WE,TH,FR` |
| Monthly | `[--tz Z] --rule monthly:D@HH:MM [--from …]` | day D (1–31) of each month; in a shorter month, its last day. Say so when D is 29–31 |
| Duration | `[--tz Z] --rule every:N{m\|h\|d} [--at "YYYY-MM-DD HH:MM"]` | every N minutes / hours / 24-hour days exactly, counted from the first occurrence (`--at`; without it, one duration from now) |

- Times are 24-hour local times in the reminder's timezone. `--tz` may be omitted only when a confirmed default is saved. `--from` is the first local date allowed (default: the first occurrence after now).
- Calendar rules (daily/weekly/monthly) keep their local time when clocks change. Duration rules advance by the exact duration, so `every:1d` or `every:14d` lands one hour earlier or later on the local clock after a clock change — tell the user and offer a calendar rule if they meant "same time each day".
- Smallest duration is one minute, the checker's cadence. Whole numbers only.
- **Not supported — say so and offer the nearest supported rule, do not approximate silently:** yearly; "every other week/month" as a calendar rule (only as an exact duration such as `every:14d`); "last Friday / first Monday of the month"; several times in one rule (use several reminders); end dates or a number of repeats (the user removes or unschedules it); seconds.

### Clock changes

- A local time that does not exist that day (clocks go forward, e.g. 02:30 on 2027-03-28 in Europe/Budapest) is moved forward by the gap: it fires at 03:30 that day, and at 02:30 again on normal days.
- A local time that happens twice (clocks go back, e.g. 02:30 on 2026-10-25) fires at its first (earlier) passage only; the second passage is never a separate occurrence, so nothing is sent twice.
- The script prints a `NOTE:` line whenever a saved or advanced occurrence was affected. Relay it.
- Timezone rules come from Windows' own timezone data through `reminders-time.ps1`; a government changing its rules is reflected only after Windows is updated.

## Operations

Reply with the script's actual output, not with what you expect it to be.

| Request | Do | Reply |
|---|---|---|
| Add, no time ("add a reminder to call the dentist") | `reminders.sh add "<text>"` | the new ID and text; say it is unscheduled and will not be sent |
| Add with a time ("remind me tomorrow at 9 to call the dentist") | settle timezone/date/time/recurrence as above, then `reminders.sh add "<text>" <SCHEDULE>` | ID, text, saved local date/time, offset, timezone, recurrence, where it will arrive |
| List ("list my reminders") | `reminders.sh list` | every ID and text with its schedule line (active / completed, next due, rule, any delivery in progress or uncertain), or clearly "No reminders saved." |
| Modify text ("change R-0002 to …") | list, identify exactly one record, `reminders.sh modify <ID> "<full new text>"` | unchanged ID, new text, unchanged schedule |
| Modify time, timezone or recurrence ("move R-0002 to Friday 10:00", "make it weekly") | list, identify one record, `reminders.sh schedule <ID> <SCHEDULE>` | ID, the complete new schedule, the previous one |
| Stop sending but keep the text | `reminders.sh unschedule <ID>` | that it is now unscheduled text |
| Remove ("delete R-0002", "drop the dentist one") | list, identify exactly one record, `reminders.sh remove <ID>`, then list again | which record was removed, that it is gone and nothing more will be sent for it |

- Save the user's wording as the text, without the date/time phrase when a schedule was saved; one reminder is one line (line breaks become spaces). Do not add several reminders from one request unless the user clearly asked for several.
- `modify` replaces the whole text and never touches the schedule. For a partial change ("make it Tuesday instead of Monday" in the *text*) read the current text from the fresh list, apply the change and pass the full new text.
- `schedule` replaces the whole schedule: restate everything (timezone, rule, time), taking unchanged parts from the fresh list. It also reactivates a completed one-off. A change to both text and time is two commands.
- Edits and removals take effect at the next check: a superseded time and a removed reminder are not sent. If the script prints a `NOTE:` that an occurrence was being delivered while you changed it, tell the user it may already have appeared.
- A completed one-off stays listed as completed until the user removes or reschedules it.
- For text containing quotes, `$`, backticks or backslashes, pass `-` as the text and feed it on stdin with a quoted heredoc so the shell does not alter it:

      bash "C:/_Work/my-software-factory/reminders.sh" add - --tz Europe/Budapest --at "2026-11-02 09:00" <<'EOF'
      Ask "Sam" about the $50 invoice
      EOF

## Identifying the target

- An ID (`R-0003`, `r-3`, `3`) names the record directly. If that ID is not in the fresh list, say so and change nothing — it may have been removed; removed IDs are never given out again, so never substitute another record.
- Ordinary language ("the dentist one") is matched against the fresh list. Proceed only when exactly one record matches; state its ID in the reply.
- If zero or several records match, or it is unclear what the new text or schedule should be, ask the user (show the candidate IDs, texts and schedules) and change nothing until they answer.
- Never modify or remove several records to guess a target. "Remove all of them" needs an explicit request, then one `remove` per ID from the fresh list.

## Store format

    - R-0007: call the dentist
      ~ R-0007 | state=active | tz=Europe/Budapest | rule=weekly:MO@09:00 | next=2026-10-19T07:00:00Z | local=Mon 2026-10-19 09:00 +02:00 | pending=- | prun=- | pmarked=- | pnote=- | last=- | acked=-

- The first line is the reminder (ID and text), exactly as before scheduling existed. A reminder with no `~` line is unscheduled and never due.
- `state`: `active`, or `completed` (a one-off whose occurrence was delivered and acknowledged).
- `tz`: IANA timezone. `rule`: `once`, `daily@HH:MM`, `weekly:DAYS@HH:MM`, `monthly:D@HH:MM` or `every:N{m|h|d}`.
- `next`: the next due instant in UTC (`-` when completed). `local`: the same instant on the local clock of `tz`, for people.
- `pending`: the occurrence a check has selected and not yet acknowledged, with `prun` (that check's run handle), `pmarked` (when it was selected) and `pnote` (`yes` once it has been reported as delivery-uncertain).
- `last` / `acked`: the last delivered occurrence and when it was acknowledged.

## Checker tick (the reminder checker's whole job)

A checker tick is one invocation of the scheduled checker prompt recorded in FACTORY.md "Reminder checker". The reply you write in this chat **is** the delivery; a command's output, a file or a log is not.

1. Run once: `bash "C:/_Work/my-software-factory/reminders.sh" due`
   Under the shared lock it rereads the store, selects every active reminder whose `next` instant has arrived, marks that occurrence pending and prints what to deliver. Selecting and rechecking are one step, so a reminder edited or removed before this moment is not selected.
2. Output is exactly `NOTHING_DUE`: end the turn and write nothing — no summary, no "nothing due".
3. Otherwise, write the reply text **first**: every `MESSAGE` line, one per paragraph, unchanged apart from dropping the word `MESSAGE` (each already starts with `Reminder R-NNNN:` and carries the due time, timezone and any `LATE … catch-up` label). Add nothing that could be mistaken for another reminder.
4. Only after that text is written, for each `DELIVER <ID> <occurrence>` line run `reminders.sh ack <ID> <occurrence>`. Never acknowledge before the message is written, and never acknowledge a message you did not write.
   - Exit 0: a one-off is now completed; a recurring reminder advanced to its first future occurrence. Relay any `NOTE:` line.
   - Exit 4 (refused: edited, rescheduled or removed while the message was being written): tell the user that the reminder just shown was changed or removed at the same moment and that its new state applies. Do nothing else.
   - Exit 3 (lock busy): retry the ack once. If it still fails, say so; the occurrence stays pending and is reconciled as below.
5. For each `UNCERTAIN <ID> <occurrence>` line (an earlier check selected it but never acknowledged it — it may or may not have been shown): write its `MESSAGE` text, and do **not** resend the reminder as if new. Then reconcile, see next section.
6. `due` failing: exit 3 → end silently, the next tick retries. Exit 1 → report the error text once; do not repeat it on later ticks while it is already the checker's latest message here.
7. Do nothing else in a tick: no other reminder commands, no edits to TODO.md, FACTORY.md or any scheduled job, no scheduling tools.

### Reconciling an uncertain delivery

An occurrence is uncertain when its `pending` mark is older than two minutes and unacknowledged. It is reported once (then only `list` shows it) and is never resent automatically; a recurring reminder does not advance while it is pending.

- This conversation visibly contains the delivered `Reminder R-NNNN: …` message for that occurrence (same ID and due time), or the user says they saw it → `reminders.sh ack <ID> <occurrence>`.
- The user says they did not get it → `reminders.sh retry <ID> <occurrence>`; the next check sends it once, labelled late.
- Otherwise ask the user which it was and leave it pending. Never `retry` on a guess: that is how a duplicate would be sent.

### What delivery does and does not promise

- Checks run about once a minute while the owning session is open **and idle**. A reminder due while the session is busy (for example while a factory worker runs), closed, or while the machine sleeps or is off is delivered at the first check afterwards, once, labelled `LATE … catch-up`. Punctual delivery while stopped is not possible.
- After downtime each overdue reminder sends one message, however many occurrences were missed; a recurring reminder then advances to its first future occurrence, calculated from its saved scheduled occurrence (a calendar rule stays on its local time, a duration rule stays on its original grid).
- Overlapping checks cannot send the same occurrence twice: the pending mark is set under the lock, and a second check skips it.
- Not exactly-once. If a check is interrupted after `due` and before `ack`, the store cannot know whether the message appeared. That occurrence is held as uncertain rather than resent, so the automatic behaviour is at most once per occurrence; a message can be missed until it is reconciled, and a duplicate can only result from a mistaken `retry`.
- An edit or removal that lands in the few seconds between `due` and the reply being written cannot stop that message; the acknowledgement is then refused and the user is told (step 4).

## Shared writes (all writers, no exceptions)

Every change to REMINDERS.md goes through `reminders.sh` — chat operations and the checker alike. Do not use an editor, the Edit/Write tools, or shell redirection on REMINDERS.md, and do not write your own variant of the protocol — a writer that skips the lock can silently lose someone else's update (atomic replacement alone does not prevent that).

What the script does for every writing command (`add`, `modify`, `schedule`, `unschedule`, `remove`, `tz`, `due`, `ack`, `retry`):

1. Acquires the single lock by `mkdir .reminders.lock` (atomic; waits up to 60 s) and records the owner (host, process id, start time, operation) inside it.
2. Rereads the latest REMINDERS.md from disk while holding the lock.
3. Builds the new content in `REMINDERS.md.tmp.<pid>`, changing only the intended record (for `due`, only schedule lines); refuses to continue if anything else would differ.
4. Replaces REMINDERS.md by renaming the temp file over it (atomic where the filesystem supports it).
5. Releases the lock and removes the temp files on success, on failure and on interruption. The lock is never held while a message is being written or while waiting for a later check.

IDs: `Next ID` in the store only goes up, and the script also never issues an ID at or below the highest existing one. Editing, scheduling or removing a record never changes any other record or ID.

## Recovery

- Exit 3, "write lock … is still held": nothing was changed. Another writer may be working; wait and retry once. Do not delete the lock directory by hand.
- If it stays held, the writer was probably interrupted (closed window, killed process). Run `bash "C:/_Work/my-software-factory/reminders.sh" recover`. It clears the lock only if the recorded owner process on this host is no longer running (or the lock has no owner record and is older than 60 s), removes leftover temp files and checks the store. If it refuses, the owner is alive or on another host: tell the user and change nothing.
- Because the file is replaced in one step, an interrupted change is either fully saved or not saved at all. After recovery, list, tell the user which it was, and repeat the request only if the change is missing. A pending occurrence left by an interrupted check is reconciled as above, never by repeating the delivery.
- Exit 2, "no reminder with ID": nothing was changed; relist and ask.
- Exit 1 with a store error (missing file, no `Next ID` line) or "timezone helper" error: report it to the user. Do not recreate or hand-repair REMINDERS.md or the scripts as part of ordinary use — that is a development request.
- Checker not running, expired or paused: FACTORY.md "Reminder checker".

## Test clock (development only)

`REMINDERS_TEST_NOW=<YYYY-MM-DDTHH:MM:SSZ>` replaces the current time for isolated tests. The script refuses it (exit 1) unless `REMINDERS_DIR` points at a scratch copy of the store in another directory, so it cannot move the clock of the canonical store. Never set either variable during ordinary use or in a checker tick.

## Examples

    User: Add a reminder: renew the car insurance
    Reply: Added R-0004: renew the car insurance — unscheduled, so it is stored but will not be sent.

    User: Remind me tomorrow at 9 to call Anna            (no default timezone saved)
    Reply: Which timezone should I use for 09:00? (for example Europe/Budapest)
    User: Budapest. Use that from now on.
    Do:    reminders.sh tz Europe/Budapest ; reminders.sh now --tz Europe/Budapest ; reminders.sh add "call Anna" --at "2026-10-14 09:00"
    Reply: Added R-0005: call Anna — one-off, Wed 2026-10-14 09:00 (+02:00, Europe/Budapest). It will arrive in the factory chat while the reminder checker is running. I saved Europe/Budapest as your default timezone.

    User: Remind me every Monday at 8:30 to send the report
    Do:    reminders.sh add "send the report" --rule weekly:MO@08:30
    Reply: Added R-0006: send the report — every Monday at 08:30 Europe/Budapest, first on Mon 2026-10-19.

    User: Remind me at 5 to stretch
    Reply: 05:00 or 17:00? And today or tomorrow?

    User: List my reminders
    Reply: R-0004: renew the car insurance (unscheduled) / R-0005: call Anna — active, next Wed 2026-10-14 09:00 Europe/Budapest, one-off / …      (or: No reminders saved.)

    User: Move R-0005 to Thursday 10:30
    Do:    reminders.sh schedule R-0005 --tz Europe/Budapest --at "2026-10-15 10:30"
    Reply: Scheduled R-0005: call Anna — now Thu 2026-10-15 10:30 (+02:00, Europe/Budapest), one-off; the earlier time will not be sent.

    User: Remove the report one
    Reply: Removed R-0006: send the report — confirmed it is no longer in the store; nothing more will be sent for it.

    Checker tick, something due:
    Reply: Reminder R-0005: call Anna  (due Thu 2026-10-15 10:30 +02:00 Europe/Budapest; one-off)
    Then:  reminders.sh ack R-0005 2026-10-15T08:30:00Z
