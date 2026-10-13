# REMINDERS

Canonical store of the chat reminder service. Rules: [reminders-guide.md](reminders-guide.md).
Text only: nothing in this file is ever sent or scheduled automatically.

Format: one line per reminder under "Records": `- R-NNNN: <text on one line>`.
`Next ID` only ever goes up; the ID of a removed reminder is never given out again.
Change this file only with `bash reminders.sh` (shared write lock), never by hand.

Next ID: R-0003

## Records

