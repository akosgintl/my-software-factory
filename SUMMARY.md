# Session summary — software factory bootstrap

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

## Outcome

A simple software factory is set up and enabled. One dispatcher runs every minute in this session, takes the first unchecked task from `TODO.md`, hands it to a fresh worker, verifies the result, checks the entry off and moves it to the bottom. A disposable trial task ran end to end on a scheduled tick and was then removed. The queue is empty.

## What was asked

A bootstrap request to set up a factory with the harness's own automation features:

- create `TODO.md` and `FACTORY.md`;
- leave one dispatcher enabled on a 60-second cadence, with only one run and one assignment active at a time;
- report progress in chat;
- verify once with a disposable task, then clean up.

It also ruled out custom schedulers, shell loops, OS-level schedules and hand-edited automation files.

A later request asked for this summary.

## What was done, in order

1. **Inspected the project.** It held only `README.md` and one commit ("Initial commit") on `main`. No scheduled jobs existed, and no factory files, so this was a first run, not a retry.
2. **Chose the mechanism.** The session scheduler (CronCreate / CronList / CronDelete) for the dispatcher, the Agent tool for workers, and this chat for feedback.
3. **Wrote `TODO.md`** — an empty checklist with the entry format (title, indented brief, checks).
4. **Wrote `FACTORY.md`** with pickup recorded as paused. It holds the project path, queue, state, automation prompt, non-overlap controls, lifetime, user controls, queue-write protocol, routing, dispatch steps, recovery, pause/maintenance/trial rules, feedback rules and worker rules.
5. **Created the dispatcher job** `35e2fcfd`, cron `* * * * *`, with this prompt:
   `Factory dispatcher tick. Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory: follow "Dispatch" exactly, report to me in this chat per "Feedback", and stay silent on an idle or skipped tick.`
6. **Read the job back** with CronList: one job, every minute, recurring, session-only.
7. **Queued the trial task** `T-TRIAL-7f3a9c` under the queue lock: write `factory-trial-7f3a9c.txt` with the single line `factory trial 7f3a9c ok` and return its path.
8. **Enabled pickup** in `FACTORY.md` and recorded the job id, creation date and expiry.
9. **Ended the turn** so the scheduler could fire (it only fires while the session is idle).
10. **First scheduled tick fired by itself.** The controller reread the state and queue, claimed the trial, wrote the active-assignment pointer and reported "picked up".
11. **Launched a fresh foreground worker** (agent id `aa12a053f82c52e22`) with the project path, the instruction to read `FACTORY.md`, the full brief and checks, and the "already assigned" role line. It finished in about 7 seconds and reported the file path.
12. **Verified the result independently.** The file had one line, `factory trial 7f3a9c ok`, 24 bytes with a trailing newline. `git status` showed nothing else changed.
13. **Completed the entry.** Marked it `- [x]` under the lock (it was the only entry, so already last), cleared the pointer and reported "verified complete".
14. **Cleaned up the trial.** Removed its four-line entry from `TODO.md` and deleted `factory-trial-7f3a9c.txt`.
15. **Confirmed one dispatcher remains** with CronList, and delivered the final report in chat.
16. **Three more ticks fired.** Each found pickup enabled, no assignment and an empty queue. The first posted a one-line idle note; the next two posted only a "." (see Known issues).
17. **Wrote this file.**

## Files

| File | State |
|---|---|
| `FACTORY.md` | Created. Untracked. |
| `TODO.md` | Created, queue empty. Untracked. |
| `SUMMARY.md` | Created (this file). Untracked. |
| `README.md` | Untouched. |
| `factory-trial-7f3a9c.txt` | Created by the worker, then deleted. |
| `.todo.lock/` | Created and removed around each queue write; not present now. |
| `.claude/scheduled_tasks.lock` | Created by the harness, left alone. |

Nothing was committed to git.

## Current state

- Pickup: enabled.
- Dispatcher job: `35e2fcfd`, every minute, created 2026-10-13, expires 2026-10-20.
- Active assignment: none.
- Queue: empty. TODO intake: open. No GitHub intake.

## Checks

**Observed**

- Saved job read back: every minute, one job, loads `FACTORY.md` by absolute path, reports to this chat.
- Automatic pickup on a scheduled tick (not a manual run).
- Fresh worker executed the brief and returned the path.
- Controller verified the file, checked off the entry and cleared the pointer.
- Pickup and completion messages appeared in chat.
- One dispatcher still enabled after cleanup; idle ticks launch nothing.

**Not verified**

- Overlap: no tick came due during the 7-second worker run. That a tick cannot start mid-run rests on the scheduler's documented behaviour.
- Moving a completed entry past other entries: the trial was the only one.
- Seven-day expiry, sleep, restart and recovery after interruption.
- Two writers contending for the queue lock.

## Limits of this setup

- **Session-only.** The job is not saved to disk. It stops when this VS Code session closes or the machine sleeps or restarts. Missed ticks are not replayed.
- **Expires 2026-10-20.** There is no native renewal setting.
- **No native paused state.** Pausing is a pickup flag in `FACTORY.md`; the job itself keeps ticking.
- **No mid-run updates.** Workers run in the foreground to keep the run exclusive, so chat gets a message at start and at return, not in between.
- **Every tick costs a model turn,** including idle ones.

## Known issues

- Idle ticks are not fully silent. The harness requires each turn to end with some text, so the last two idle ticks posted a "." in chat. The first idle tick posted a one-line "queue empty" note, which duplicated what the final report had already said.

## Controls

Say these in the controlling chat:

- Add work: "Queue this task: <brief + checks>"
- Status: "Factory status"
- Pause: "Pause factory pickup"
- Resume: "Resume factory pickup"
- Stop: "Stop the factory"
- Restart or renew (new session, after expiry or a restart): "Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory."
