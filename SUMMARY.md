# Session summary — part 2: chat reminder service

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

This covers everything from the "Queue one task titled Create a Chat Reminder Service" request to the request for this summary. Part 1 (factory bootstrap) is the previous version of this file, in commit `4dd5155`.

## Outcome

The factory took its first real task through the full route: queued in chat, picked up by a scheduled tick, built by a fresh worker, inspected by the controller, checked off. The result is a chat reminder service backed by `REMINDERS.md`. It stores text only and does not send or schedule reminders.

## State at the start

- Factory enabled: dispatcher job `35e2fcfd`, every minute, pickup enabled, no active assignment, queue empty.
- Part 1 files (`FACTORY.md`, `TODO.md`, `SUMMARY.md`) had been committed by the user as `4dd5155 part-01 -> 01-factory-todo`.
- Between the part 1 summary and the intake request, four dispatcher ticks fired and found nothing to do.

## What was asked

1. **Intake request.** Queue one task, "Create a Chat Reminder Service", with the supplied brief. Intake only: save the brief, return its reference, stop. Do not implement, dispatch or change automations.
2. **This summary.**

## What was done, in order

### Intake

1. Reread `FACTORY.md` and `TODO.md`: TODO intake open, no GitHub route, no active claim, queue empty, no reminder files, so no equivalent work existed.
2. Saved the brief to a scratch file, without the tags and intake instructions, with one added first line: `Project path: C:\_Work\my-software-factory`.
3. Under the queue lock (`.todo.lock`): rechecked that intake was open and that no entry had the same title, then appended one unchecked entry, `T-001: Create a Chat Reminder Service`, with the brief indented beneath it (`TODO.md` lines 13–56).
4. Read the saved entry back and diffed it against the brief: identical.
5. Reported "queued" with the reference `TODO.md:13` and stopped. Pickup state and the dispatcher job were not touched.

### Dispatch

6. The next scheduled tick fired by itself. Under the lock the controller confirmed pickup was enabled and nothing was claimed, took the first unchecked entry (T-001) and wrote the active-assignment pointer into `FACTORY.md`. Reported "picked up" and "worker starting".
7. Launched one fresh foreground worker (agent id `acf19b53d3942aee4`) with the project path, the instruction to read `FACTORY.md`, the full brief, the "already assigned" role line, and the limits: no edits to `TODO.md`, the State section or the scheduled job; no git commits.
8. The worker ran for about 4 minutes 40 seconds (16 tool calls). No tick fired during that time.

### What the worker built

- `REMINDERS.md` — the canonical store. One line per reminder: `- R-NNNN: <text>`. A `Next ID` counter only goes up, so removed IDs are never reused.
- `reminders-guide.md` — operating instructions: reread the guide and the records before every request, how to identify a target, when to ask, the write protocol, recovery, examples.
- `reminders-brief.md` — the agreed behaviour.
- `reminders.sh` — a Git Bash script, the only reader and writer. Commands: `list`, `add`, `modify`, `remove`, `recover`.
- `FACTORY.md` — one new bullet under "Routing" and a new "Reminder service" section: links, store path, starting request, routing distinction, controls, recovery.

Write protocol in the script: take the lock with `mkdir .reminders.lock` (waits up to 60 s, records the owner), reread the store, build a temp file changing only the target record, refuse if any other record would differ, rename it over the store, reread to confirm, release. The lock and temp file are removed on success, failure and interruption. `recover` clears a lock only when its recorded owner process is dead.

### Worker's checks (as it reported them)

1. **Add two — passed.** `R-0001` and `R-0002`, labelled `T001-CHECK-7f3a`; both confirmed in the raw file.
2. **List and modify by ID — passed.** `R-0001` got new text, kept its ID; `R-0002` unchanged.
3. **Fresh conversation — passed.** A subagent with no inherited history (id `a311fb77b7d4bec34`) was given only the project path, the starting request and one plain-language change. It listed both records and modified only `R-0002`; the change was in the file afterwards.
4. **Concurrent writes — passed,** on an isolated scratch copy.
   - 15 simultaneous writers (12 adds, 2 modifies, 1 remove): all took effect, no errors.
   - Control with the lock disabled: 1 of 12 adds survived and both modifies were lost.
   - Interrupted writer: a dead-owner lock blocked a write without changing the store, and `recover` cleared it; a live-owner lock was refused.
5. **Remove — passed.** Both test records removed; the store is empty and `Next ID` stays `R-0003`.

### Controller inspection

9. Checked the working tree: the four new files exist, `FACTORY.md` and `TODO.md` are modified, nothing else changed.
10. Checked `FACTORY.md`: State section intact, new routing bullet and "Reminder service" section present with both links.
11. Checked `REMINDERS.md`: empty, `Next ID: R-0003`, no leftover lock, temp files or test records.
12. Read `reminders-guide.md` in full.
13. Ran the script on a scratch copy: add, add, modify, remove, add, list. Texts and IDs were correct and the removed ID was not reused (`R-0003`, `R-0005` remained). The real store was not touched; the scratch copy was deleted.
14. CronList: still exactly one job, `35e2fcfd`. No `CLAUDE.md` was created.

### Completion

15. Under the lock, marked T-001 `- [x]`. It was the only entry, so it was already at the bottom.
16. Cleared the active-assignment pointer.
17. Reported "verified complete" with the handover, and the transition to an empty queue with the dispatcher still enabled.
18. Two further ticks fired and found nothing to do.
19. Wrote this file, replacing the part 1 summary.

## Files

| File | State |
|---|---|
| `REMINDERS.md` | New, untracked. Empty store, next ID `R-0003`. |
| `reminders-guide.md` | New, untracked. |
| `reminders-brief.md` | New, untracked. |
| `reminders.sh` | New, untracked. |
| `FACTORY.md` | Modified: routing bullet and "Reminder service" section added. |
| `TODO.md` | Modified: T-001 added, now checked. |
| `SUMMARY.md` | Modified: this file replaces the part 1 text. |

Nothing was committed in this part.

## Current state

- Pickup: enabled. Dispatcher job `35e2fcfd`, every minute, expires 2026-10-20.
- Active assignment: none.
- Queue: no unchecked entries; T-001 checked.
- Reminders: none saved.

## How to use the reminder service

In a fresh conversation on this project, start with:

> Read FACTORY.md and reminders-guide.md in this project, then list my reminders.

- Add: "Add a reminder: renew the car insurance"
- List: "List my reminders"
- Modify: "Change R-0003 to renew the car insurance before March"
- Remove: "Remove R-0003"

An ID or ordinary wording both work. The service asks when the target is ambiguous. Asked for a timed reminder, it explains that it stores text only.

Changing the service itself is a development request and goes through the queue.

## Limits of the evidence

- The fresh-conversation check used a subagent, not a new top-level VS Code chat. The controller did not repeat it.
- The worker ran checks 1, 2 and 5 itself, acting as the service conversation.
- That the fresh agent read the canonical files rests on its own report plus the saved change; its tool trace was not inspected.
- The controller's own script test ran on a scratch copy, not the real store.
- Still unverified from part 1: a tick coming due during a run (none did), and moving a completed entry past other entries (T-001 was alone).

## Things to know

- The service needs Git Bash on the host.
- The lock protects only writers that go through `reminders.sh`; a hand edit of `REMINDERS.md` bypasses it.
- With roughly 40 or more simultaneous writers, some may time out on the 60-second lock wait. Nothing is lost; they retry.
- Idle dispatcher ticks still post a "." in chat every minute.
