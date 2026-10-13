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
- Active assignment: none

`Active assignment` is a recovery pointer only (controller session, task id, worker handle, phase) — never a second queue.

## Native automation

- One recurring session cron job, `* * * * *` (every 60 s), prompt:
  `Factory dispatcher tick. Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory: follow "Dispatch" exactly, report to me in this chat per "Feedback", and stay silent on an idle or skipped tick.`
- Run controls / non-overlap: the job lives in one session and fires only while that session is idle, so a tick cannot start while a dispatcher turn is running. Workers are launched in the foreground (`run_in_background: false`), keeping the dispatcher turn — the logical run — active until the worker's terminal result. The `Active assignment` pointer is the second guard: a tick that finds one never launches anything.
- Lifetime: session-only (not on disk) and auto-expires 7 days after creation. It stops when the session/VS Code window closes, the host sleeps or restarts. Nothing fires while the machine is off; missed ticks are not replayed.
- Renewal / restart: in a Claude Code session opened on this project, send the starting request above. The controller runs CronList; if no dispatcher job exists it reconciles `Active assignment` (see Recovery), creates the job with the prompt above, and records the new id and creation date here. Never create a second job.

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
