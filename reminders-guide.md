# Reminders guide (operating instructions)

How any conversation operates the chat reminder service. Agreed behaviour: [reminders-brief.md](reminders-brief.md). Factory rules: [FACTORY.md](FACTORY.md).

Fresh service conversation: give it the absolute project path `C:\_Work\my-software-factory` and this starting request:

> Read FACTORY.md and reminders-guide.md in this project, then list my reminders.

## Paths

- Canonical store: `C:\_Work\my-software-factory\REMINDERS.md` — the only place reminders live.
- Reader/writer: `C:\_Work\my-software-factory\reminders.sh` (run with Git Bash: `bash "C:/_Work/my-software-factory/reminders.sh" <command>`).
- Write lock: `C:\_Work\my-software-factory\.reminders.lock` (a directory; exists only while a write is in progress).

## Rules for every service conversation

1. Before answering or writing any reminder request, reread this guide and the current records from disk (`reminders.sh list` or read REMINDERS.md). Do this for every request, not once per conversation.
2. Conversation history, memory and earlier tool output are not the store. Never answer "what are my reminders" from them, and never pick a target from them without relisting.
3. This service stores text only. It does not schedule, notify or send anything. If asked for timed delivery ("remind me at 5", "ping me tomorrow"), say that this service stores text only and does not schedule a message; offer to save the text (the time may be kept as part of the text) and save it only if the user agrees or asked for it to be saved anyway. Do not create a scheduled job, cron entry or timer for a reminder.
4. Using reminders is ordinary application use: do it directly, here, without the factory queue. A request to build or change the service itself (format, script, guide, new features) is development: route it through the active development queue in FACTORY.md and do not edit these files directly.
5. Do not edit TODO.md, the State section of FACTORY.md or any scheduled job while using reminders.

## Operations

Reply with the script's actual output, not with what you expect it to be.

| Request | Do | Reply |
|---|---|---|
| Add ("add a reminder to call the dentist") | `reminders.sh add "<text>"` | the new ID and the saved text |
| List ("list my reminders") | `reminders.sh list` | every current ID and text, or clearly "No reminders saved." |
| Modify ("change R-0002 to …", "the dentist one should say Tuesday") | list, identify exactly one record, `reminders.sh modify <ID> "<full new text>"` | the unchanged ID and the new text |
| Remove ("delete R-0002", "drop the dentist one") | list, identify exactly one record, `reminders.sh remove <ID>`, then list again | which record was removed and that it is no longer in the store |

- Save the user's wording as the text; one reminder is one line (line breaks become spaces). Do not add several reminders from one request unless the user clearly asked for several.
- `modify` replaces the whole text. For a partial change ("make it Tuesday instead of Monday") read the current text from the fresh list, apply the change and pass the full new text.
- For text containing quotes, `$`, backticks or backslashes, pass `-` as the text and feed it on stdin with a quoted heredoc so the shell does not alter it:

      bash "C:/_Work/my-software-factory/reminders.sh" add - <<'EOF'
      Ask "Sam" about the $50 invoice
      EOF

## Identifying the target

- An ID (`R-0003`, `r-3`, `3`) names the record directly. If that ID is not in the fresh list, say so and change nothing — it may have been removed; removed IDs are never given out again, so never substitute another record.
- Ordinary language ("the dentist one") is matched against the fresh list. Proceed only when exactly one record matches; state its ID in the reply.
- If zero or several records match, or it is unclear what the new text should be, ask the user (show the candidate IDs and texts) and change nothing until they answer.
- Never modify or remove several records to guess a target. "Remove all of them" needs an explicit request, then one `remove` per ID from the fresh list.

## Shared writes (all writers, no exceptions)

Every change to REMINDERS.md goes through `reminders.sh`. Do not use an editor, the Edit/Write tools, or shell redirection on REMINDERS.md, and do not write your own variant of the protocol — a writer that skips the lock can silently lose someone else's update (atomic replacement alone does not prevent that).

What the script does for each `add` / `modify` / `remove`:

1. Acquires the single lock by `mkdir .reminders.lock` (atomic; waits up to 60 s) and records the owner (host, process id, start time, operation) inside it.
2. Rereads the latest REMINDERS.md from disk while holding the lock.
3. Builds the new content in `REMINDERS.md.tmp.<pid>`, changing only the intended record; refuses to continue if any other record would differ.
4. Replaces REMINDERS.md by renaming the temp file over it (atomic where the filesystem supports it), then rereads the file to confirm the result.
5. Releases the lock and removes the temp file on success, on failure and on interruption.

IDs: `Next ID` in the store only goes up, and the script also never issues an ID at or below the highest existing one. Editing or removing a record never changes any other ID.

## Recovery

- Exit 3, "write lock … is still held": nothing was changed. Another writer may be working; wait and retry once. Do not delete the lock directory by hand.
- If it stays held, the writer was probably interrupted (closed window, killed process). Run `bash "C:/_Work/my-software-factory/reminders.sh" recover`. It clears the lock only if the recorded owner process on this host is no longer running (or the lock has no owner record and is older than 60 s), removes leftover temp files and checks the store. If it refuses, the owner is alive or on another host: tell the user and change nothing.
- Because the file is replaced in one step, an interrupted change is either fully saved or not saved at all. After recovery, list, tell the user which it was, and repeat the request only if the change is missing.
- Exit 2, "no reminder with ID": nothing was changed; relist and ask.
- Exit 1 with a store error (missing file, no `Next ID` line): report it to the user. Do not recreate or hand-repair REMINDERS.md as part of ordinary use — that is a development request.

## Examples

    User: Add a reminder: renew the car insurance
    Reply: Added R-0004: renew the car insurance

    User: List my reminders
    Reply: R-0002: call the dentist / R-0004: renew the car insurance      (or: No reminders saved.)

    User: Change R-0004 to "renew the car insurance before March"
    Reply: Modified R-0004: renew the car insurance before March

    User: Remove the dentist one
    Reply: Removed R-0002: call the dentist — confirmed it is no longer in the store.

    User: Remind me at 17:00 to call Anna
    Reply: This service stores text only and does not schedule or send messages. I can save "call Anna at 17:00" as a reminder text — shall I?
