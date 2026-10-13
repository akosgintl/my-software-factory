# FACTORY

Instruction entry point for this factory. Fresh controller starting request:

> Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory.

## Setup

- Project: `C:\_Work\my-software-factory`
- Active queue: `C:\_Work\my-software-factory\TODO.md` (TODO intake: **open**). No GitHub intake.
- Engine: Claude Code session scheduler (CronCreate / CronList / CronDelete) + Agent tool workers.
- Feedback destination: the chat of the Claude Code session that owns the dispatcher job (VS Code, session `my-software-factory-c8`).

## State

- Pickup: **enabled**
- Dispatcher job: `35e2fcfd` (created 2026-10-13, expires 2026-10-20), owned by session `my-software-factory-c8`
- Active assignment: controller `my-software-factory-c8` (job `35e2fcfd`), task `T-002`, worker `a45fd1ae952df36d6` returned (files + isolated checks done), phase: controller live delivery checks 1-3 with disposable reminders labelled T002-LIVE via checker job `6ffb2e2a`; dispatcher ticks launch nothing until these are inspected and cleaned up

`Active assignment` is a recovery pointer only (controller session, task id, worker handle, phase) — never a second queue.

## Native automation

- One recurring session cron job, `* * * * *` (every 60 s), prompt:
  `Factory dispatcher tick. Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory: follow "Dispatch" exactly, report to me in this chat per "Feedback", and stay silent on an idle or skipped tick.`
- Run controls / non-overlap: the job lives in one session and fires only while that session is idle, so a tick cannot start while a dispatcher turn is running. Workers are launched in the foreground (`run_in_background: false`), keeping the dispatcher turn — the logical run — active until the worker's terminal result. The `Active assignment` pointer is the second guard: a tick that finds one never launches anything.
- Lifetime: session-only (not on disk) and auto-expires 7 days after creation. It stops when the session/VS Code window closes, the host sleeps or restarts. Nothing fires while the machine is off; missed ticks are not replayed.
- Renewal / restart: in a Claude Code session opened on this project, send the starting request above. The controller runs CronList; if no dispatcher job exists it reconciles `Active assignment` (see Recovery), creates the job with the prompt above, and records the new id and creation date here. Never create a second job. The reminder checker is a separate job with its own record and controls: restore it the same way from "Reminder checker".

## Controls (say these in the controlling chat)

- Add work: "Queue this task: <brief + checks>" → appended to TODO.md, reference returned.
- Status: "Factory status" → pickup state, active assignment, CronList readback, unchecked count.
- Pause pickup: "Pause factory pickup" → sets Pickup to paused (records prior state + reason); claimed work finishes.
- Resume: "Resume factory pickup".
- Stop: "Stop the factory" → finish/record claimed work, CronDelete the dispatcher job, record `Dispatcher job: none`.
- Restart: the starting request above.

## Queue-write protocol (controller and intake alike)

1. Acquire: `mkdir C:\_Work\my-software-factory\.todo.lock` (atomic; if it exists, wait briefly and retry; never delete another writer's lock on elapsed time alone — check who holds it).
2. Reread FACTORY.md intake state and TODO.md from disk.
3. Make one small edit, preserving all other entries, edits and order.
4. `rmdir` the lock. Never hold it while a worker runs.

Intake appends at the end of the unchecked entries only while TODO intake is open. Frozen or retired intake rejects the write: keep the brief in the requesting conversation. Never recreate a missing TODO.md — report it. Paused pickup does not close intake. If this file records retired TODO intake or GitHub intake, do not recreate the local queue.

## Routing

- New development request → queue a complete brief (drop any wrapping tags/intake instructions, save only the brief), return its verified reference (task id + line), stop. Do not execute it.
- Only assigned workers execute briefs.
- Factory configuration → direct controller maintenance between assignments: pause pickup, finish active work, apply the change, release maintenance ownership (restore pickup).
- Ordinary application use → follow that application's operating guide.
- Reminders: building or changing the reminder service → the active development queue above, like any development request. Ordinary reminder use (add / list / modify / remove) → follow [reminders-guide.md](reminders-guide.md) directly; never queue it. See "Reminder service".

## Dispatch (one run at a time)

1. Reread State and TODO.md. If an `Active assignment` exists: when its controller is this session and its worker is still running, continue that owner and launch nothing; otherwise go to Recovery. If pickup is paused, select nothing and end.
2. No assignment and pickup enabled: under the write protocol, take the first `- [ ]` entry and write the `Active assignment` pointer. Report "picked up".
3. Launch one fresh worker (Agent tool, foreground) with: the absolute project path, the instruction to read FACTORY.md there, the complete brief and checks, and the role line: "You are already assigned this task. Execute it directly; do not enqueue or dispatch it again." Record its handle in the pointer. Report "worker started".
4. On the worker's terminal result, run the checks yourself. A launch receipt, partial output or a self-written DONE file is not completion.
5. Failed, interrupted or blocked: leave the entry unchecked and the pointer in place, inspect existing effects, report the blocker. Never duplicate, skip or mark unfinished work complete.
6. Verified success: under the write protocol, reread TODO.md, change that entry to `- [x]` and move it with its whole indented brief to the end of the file; clear the pointer. Report "verified complete". If pickup is still enabled, go to 2.
7. Nothing to do: end the turn, leaving the job enabled. Report the transition to an empty queue once; say nothing on later idle ticks.

## Recovery

After an interruption, do not act on elapsed time. Check CronList and the recorded worker handle (ListAgents / SendMessage to resume it). If the worker is alive, keep waiting on it; if it is gone, inspect what it already changed against the checks, then either verify completion or report the blocker and await direction. Keep the claim and the intended pickup state; never enable competing work to recover.

## Pause / maintenance / trial

- Pause: record `Pickup: paused (prior: <state>; reason: <why>)`. Claimed work and its checks continue.
- Maintenance: pause, finish claimed work, apply the change, then restore the prior state — unless the user paused in the meantime, which wins.
- Queued trial: release maintenance ownership and temporarily enable pickup so the trial runs through normal queue order and completion gates; restore the prior state afterwards, respecting later user pauses.

## Feedback

The controller reports in the feedback destination: queued, picked up, worker started, waiting (current phase), delays/blockers, and the inspected completion result — keeping queued / started / waiting / blocked / verified complete distinct. Workers return progress and results to the controller only; the controller informs the user, including during maintenance. File writes and logs are not feedback. No separate reporting automation. A foreground worker cannot be narrated mid-run: say so at start for long tasks and report as soon as it returns.

## Workers

Read this file and your full assignment from the supplied absolute path; do not rely on conversation history. Do not edit TODO.md, State, claims or the dispatcher job. When updating project guidance, preserve them. A task that adds a service records its operating controls in a new section of this file. Keep secrets out of this file.

## Reminder service

Chat reminders stored as text (added by T-001), with one-off and recurring schedules (added by T-002). Unscheduled reminders are never sent. Scheduled reminders are delivered only by the single reminder checker below, and only while it is running.

- Agreed behaviour: [reminders-brief.md](reminders-brief.md)
- Operating instructions: [reminders-guide.md](reminders-guide.md)
- Canonical store: `C:\_Work\my-software-factory\REMINDERS.md`, read and written only through `C:\_Work\my-software-factory\reminders.sh` (shared write lock `.reminders.lock`). Timezone calculations: `C:\_Work\my-software-factory\reminders-time.ps1` (called by the script; needs Windows PowerShell 5.1, present on this host).
- Fresh service conversation: give it the absolute project path `C:\_Work\my-software-factory` and this starting request:

  > Read FACTORY.md and reminders-guide.md in this project, then list my reminders.

- Routing: building or changing the service (files above, format, new features) goes through the active development queue. Ordinary reminder use follows reminders-guide.md directly, in any conversation, without a queue entry or a worker; it does not touch TODO.md, State or the dispatcher job, and the dispatcher takes no part in it.
- Controls (say these in any project conversation that has loaded the guide): "Add a reminder: <text>" · "List my reminders" · "Change R-0003 to <text>" · "Remove R-0003". An ID or ordinary wording both work; the service asks when the target is ambiguous. Scheduling: "Remind me on <date> at <time> to <text>" · "Remind me every Monday at 8:30 to <text>" · "Move R-0003 to Friday 10:00" · "Stop sending R-0003 but keep it" · "My timezone is <city>". The service asks for the timezone until one is confirmed; it never uses the host's.
- Stuck write (a "write lock is still held" error that does not clear): `bash "C:/_Work/my-software-factory/reminders.sh" recover` — see "Recovery" in the guide.

## Reminder checker

One native scheduled job that delivers due reminders (added by T-002). It is separate from the dispatcher job and has its own record and controls; dispatcher controls ("Pause factory pickup", "Stop the factory") do not pause or stop it, and its controls do not touch the dispatcher.

- Checker job: `6ffb2e2a` (created 2026-10-13, expires 2026-10-20), owned by session `my-software-factory-c8`
- Engine: Claude Code session scheduler (CronCreate / CronList / CronDelete), the same engine as the dispatcher. No coded timer, daemon, launcher or operating-system schedule exists or may be added.
- Cadence: `* * * * *` (every 60 s, host local time; the cadence does not depend on any timezone — reminders carry their own).
- Saved prompt (use exactly this when creating the job):
  `Reminder checker tick. Read C:\_Work\my-software-factory\reminders-guide.md and C:\_Work\my-software-factory\REMINDERS.md, then follow the guide's "Checker tick" section exactly: run bash "C:/_Work/my-software-factory/reminders.sh" due once. If its output is NOTHING_DUE, end the turn without writing anything. Otherwise first write every MESSAGE line to me in this chat as your reply (each names its reminder ID), and only after that text is written run reminders.sh ack <ID> <occurrence> for each DELIVER line. Never ack before delivering, never resend an UNCERTAIN occurrence, and do not touch TODO.md, FACTORY.md or any scheduled job.`
- Paths: project `C:\_Work\my-software-factory`; store `C:\_Work\my-software-factory\REMINDERS.md`; instructions `C:\_Work\my-software-factory\reminders-guide.md` ("Checker tick"); script `C:\_Work\my-software-factory\reminders.sh`.
- Destination: the chat of the session that owns the job — Claude Code in VS Code, session `my-software-factory-c8`, the same chat as the factory's feedback. To open it: open the VS Code window on `C:\_Work\my-software-factory`, open the Claude Code panel and select the session `my-software-factory-c8`. Due messages start with `Reminder R-NNNN:`; factory progress, blockers and completion keep their own wording in the same chat. Nothing is sent to any other person, channel or device.
- Delivery: the checker's chat reply is the delivery. Each tick runs `reminders.sh due` (select + mark pending under the shared lock), writes the messages, then `reminders.sh ack` per message (recheck under the lock, then complete the one-off or advance the recurrence). Nothing due → no reply at all.
- Run controls / non-overlap: the job lives in the same session as the dispatcher and fires only while that session is idle, so a checker tick never overlaps a dispatcher turn or another checker tick. Consequence: while a dispatcher turn is waiting on a foreground worker, no checker tick runs; reminders due in that time arrive when the turn ends, once each, labelled `LATE … catch-up`. Independently of this, the pending mark in the store stops two checks from sending the same occurrence.
- Lifetime: session-only (not on disk) and auto-expires 7 days after creation. It stops when the session or VS Code window closes and when the host sleeps, shuts down or restarts. Missed ticks are not replayed and nothing is delivered while it is stopped; the first tick after it runs again sends one catch-up message per overdue reminder and advances recurring ones to their first future occurrence. Punctual delivery is not promised while stopped or busy.

Controls (say these in the controlling chat):

- Status: "Reminder checker status" → CronList readback (exactly one job with the saved prompt, its id matching the record above) plus `bash "C:/_Work/my-software-factory/reminders.sh" list` (next due times, any delivery in progress or uncertain).
- Pause / stop: "Pause the reminder checker" / "Stop the reminder checker" → CronDelete the checker job only and record `Checker job: none (paused|stopped <date>; reason)`. Reminders stay saved; nothing is sent meanwhile. On resume, everything that became due is sent once as catch-up — unschedule or remove reminders first if that is not wanted.
- Resume / restart / renew: "Restart the reminder checker" (also part of the factory starting request) → CronList; if a job with the saved prompt already exists, reuse it and record its id; otherwise CronCreate with the cadence and saved prompt above and record the new id, creation date and expiry here. Never run two checkers. Renew before the 7-day expiry the same way (CronDelete the old job, CronCreate, record), or simply restart after it has expired.
- Timezone: reminders use the timezone saved with each one; the user's confirmed default is the `Default timezone` line in REMINDERS.md (`reminders.sh tz`). The host's timezone is never used.

Recovery:

- After any interruption (closed window, restart, expiry): CronList first. No checker job → restart as above. Do not act on elapsed time and do not create a second job.
- Then `reminders.sh list`. "delivery in progress" older than two minutes, or "DELIVERY UNCERTAIN", means a tick was interrupted between writing a message and acknowledging it. It is not resent automatically: reconcile it per reminders-guide.md "Reconciling an uncertain delivery" (`ack` if the message is visible in the chat or the user saw it, `retry` only if the user did not get it).
- A stuck write lock: `bash "C:/_Work/my-software-factory/reminders.sh" recover` (reminders-guide.md "Recovery").
- Crash window: between the reply being written and its `ack`, the store cannot prove the message appeared. Such an occurrence is held, reported once as uncertain and never resent blindly, so delivery is at most once per occurrence automatically — not exactly once.
