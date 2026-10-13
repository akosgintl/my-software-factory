# REMINDERS

Canonical store of the chat reminder service. Rules: [reminders-guide.md](reminders-guide.md).
Change this file only with `bash reminders.sh` (shared write lock), never by hand.

Format, under "Records":
* `- R-NNNN: <text on one line>` is one reminder. On its own it is unscheduled: stored text, never due, never sent.
* `  ~ R-NNNN | state=... | tz=... | rule=... | next=... | ...` directly under a reminder is its schedule line
  (state active/completed, IANA timezone, recurrence rule, next due instant in UTC, pending and last
  delivered occurrence). Field meanings: "Store format" in reminders-guide.md.
`Next ID` only ever goes up; the ID of a removed reminder is never given out again.
`Default timezone` is set only after the user has confirmed it (`reminders.sh tz <Zone>`); the host's timezone is never used.

Next ID: R-0007
Default timezone: (not confirmed)

## Records

- R-0003: T002-LIVE-ONEOFF
  ~ R-0003 | state=completed | tz=Europe/Budapest | rule=once | next=- | local=Tue 2026-10-13 13:03 +02:00 | pending=- | prun=- | pmarked=- | pnote=- | last=2026-10-13T11:03:00Z | acked=2026-10-13T11:03:21Z
- R-0005: T002-LIVE-EDIT
  ~ R-0005 | state=active | tz=Europe/Budapest | rule=once | next=2026-10-13T11:08:00Z | local=Tue 2026-10-13 13:08 +02:00 | pending=- | prun=- | pmarked=- | pnote=- | last=- | acked=-
