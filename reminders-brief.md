# Reminders brief (agreed behaviour)

What the chat reminder service is and must keep doing. How to operate it: [reminders-guide.md](reminders-guide.md). Built by factory task T-001; changes to anything here go through the active development queue in [FACTORY.md](FACTORY.md).

## Purpose and scope

- The user adds, lists, modifies and removes reminders in ordinary chat, in any conversation on this project, including fresh ones.
- Text only. No scheduling, no automatic delivery, no notifications, no browser app, no database. A request for timed delivery gets the explanation that the service stores text only and does not schedule a message.
- Plain project files with explicit loading. No engine instruction file (such as CLAUDE.md) is created or required: a fresh conversation is given the absolute project path and the starting request "Read FACTORY.md and reminders-guide.md in this project, then list my reminders."

## Files

- `C:\_Work\my-software-factory\REMINDERS.md` — canonical store.
- `C:\_Work\my-software-factory\reminders-guide.md` — operating instructions, reread by every service conversation.
- `C:\_Work\my-software-factory\reminders-brief.md` — this file.
- `C:\_Work\my-software-factory\reminders.sh` — the only reader/writer; implements the shared write protocol.

## Records

- One line per reminder: `- R-NNNN: <text>`. Each reminder has a stable unique ID and its text.
- Editing or deleting one record never changes another record or any ID.
- IDs are never reused: `Next ID` in the store only increases, so an old request naming a removed ID cannot hit a different reminder.
- The store on disk is the only source of truth. Cached conversation history is not the store; every request rereads the guide and the current records before answering or writing.

## Chat behaviour

- Add saves the requested text and returns its ID and text.
- List rereads the file and shows current IDs and texts, or clearly states that it is empty.
- Modify identifies the record, preserves its ID and saves the requested text change.
- Remove deletes only the identified record and confirms its absence.
- Targets may be named by ID or in ordinary language. When the target or the requested change is ambiguous, the service asks; it never rewrites several records to guess.

## Shared writes

- One shared write lock (`.reminders.lock`, created atomically with mkdir) used by every writer through `reminders.sh`.
- Under the lock: reread the latest records, change only the intended record, replace the file atomically (temp file + rename). Atomic replacement alone does not prevent lost updates; the lock does.
- The lock and temp file are released on success, failure and interruption. A writer killed before it can release leaves a lock that `reminders.sh recover` clears only after confirming the recorded owner process is gone; the store is then either fully updated or untouched.

## Routing

- Building or changing the service → the factory's active development queue.
- Ordinary reminder use → follow reminders-guide.md directly; no queue entry, no worker.
