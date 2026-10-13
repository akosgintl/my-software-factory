HISTORICAL BACKUP - NOT THE LIVE STORE

This folder holds the Markdown-era reminder store exactly as it was when the service moved to
SQLite. The live reminders are in the database named in reminders-guide.md ("Paths").

- REMINDERS.md              byte-for-byte copy of the old store (see SHA256 below)
- reminders.sh.markdown-era the old reader/writer for that file (if present)
- reminders-time.ps1        its timezone helper (if present)

Do not import this file again and do not copy it back into the project root: reminders added,
changed or removed since the migration exist only in the database, and a second writable store
would split the service. It is kept for audit and for the recovery route in reminders-guide.md.

SHA256 of REMINDERS.md: 41c9579999ea974021d1da8990b529509cb593cad48e497b31bb528e5cfadeb8
Backed up from: C:\_Work\my-software-factory\REMINDERS.md
