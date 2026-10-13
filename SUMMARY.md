# Session summary — part 4: T-002 completed, project instructions and Impeccable skill

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

This covers everything from the "Prepare this factory with standing project instructions and a project-local Impeccable design skill" request to the request for this summary. It also records the live reminder deliveries that happened after the part 3 summary was written, so that nothing falls between the two. Earlier parts are the previous versions of this file in git.

## Outcome

- **T-002 (scheduled and recurring reminders) is verified complete.** All live delivery checks were observed in this chat.
- **The maintenance upgrade is applied and verified.** The project has a standing instruction file (`CLAUDE.md`) and a project-local Impeccable design skill (4.5.2). A fresh worker, dispatched through the real queue, found and read both from files alone.
- The factory is enabled with one dispatcher and one reminder checker. The queue has no unchecked work and no reminders are saved.

## Carried over from part 3: live deliveries before this request

The part 3 summary was written before any test reminder came due. These happened afterwards, before the maintenance request:

- **13:02** — checker tick delivered `R-0004` (recurring, every 2 minutes). After `ack` it advanced by exactly 120 s to 13:04:38.
- **13:03** — checker tick delivered `R-0003` (one-off). After `ack` it was saved as completed.
- **13:04** — checker tick found nothing due. Nothing was sent for the old 13:04 time of `R-0005` (rescheduled) or for `R-0006` (removed).
- **13:05** — checker tick delivered `R-0004` a second time; it advanced by 120 s again, to 13:06:38.
- **13:06** — a dispatcher tick, acting as controller, removed `R-0004` because the recurring check was done.
- The user asked whether the last reminder was in `SUMMARY.md`. Answer given: no; the summary predates the deliveries, and would be updated once T-002 completed.
- 13:06 and 13:07 checker ticks found nothing due. Dispatcher ticks in this period found T-002 still claimed and launched nothing.

## What was asked

1. **Maintenance request.** Apply directly, as controller maintenance between assignments and not as a queued task:
   - pause pickup, let active work finish;
   - save eight standing rules in a project instruction file;
   - install the Impeccable design skill at project scope;
   - update `FACTORY.md`, the dispatcher prompt and the worker template;
   - verify with one harmless inspection task through the real dispatcher.
2. **This summary.**

## What was done, in order

### Reserving maintenance (13:07)

1. Confirmed the prerequisites: dispatcher job `35e2fcfd` and reminder checker job `6ffb2e2a` both present.
2. Paused pickup in `FACTORY.md`, recording the prior state (enabled) and the reason. The harness has no native paused state for a job, so the pickup flag is the pause; the job kept its one-minute cadence.
3. Did not start the upgrade, because T-002 was still claimed with one live check outstanding (`R-0005` at 13:08). Ended the turn so the checker could fire.
4. Noted two things for later: `node`, `npm` and `npx` were not found, and a stray folder with a garbled name was in the project root.

### Finishing T-002 (13:08–13:09)

5. The 13:08 checker tick delivered `R-0005` at its new time only. After `ack` it was saved as completed.
6. The next dispatcher tick completed T-002:
   - removed the remaining test reminders (`R-0003`, `R-0005`); the store is empty, next ID `R-0007`;
   - CronList showed exactly one dispatcher and one checker;
   - under the queue lock, marked T-002 `- [x]` and moved it with its whole brief to the end of `TODO.md`, below T-001;
   - cleared the active-assignment pointer.
7. Reported "verified complete". Pickup stayed paused, so nothing new was selected.

### Maintenance

8. **Inspection.**
   - No Node.js anywhere on the machine; winget available.
   - The project is its own git repository with no parent repository.
   - The stray folder was empty. It was created at 13:05:22, the same second as a reminder `ack`.
9. **Documentation read:**
   - the Impeccable installation instructions;
   - the Node.js release table (v24 and v22 are LTS);
   - the Next.js installation page (Next.js 16.4, minimum Node.js 20.9);
   - Claude Code's pages on skills and on project instruction files.
10. **Instruction filename.** Chose `CLAUDE.md`. Claude Code loads it from the project root at session start, and reads `AGENTS.md` only when no `CLAUDE.md` exists.
11. **Node.js.** Installed Node.js 24.20.0 LTS (npm 11.19.0) machine-wide with winget, at `C:\Program Files\nodejs`. Shells that were already open do not have it on their path.
12. **Stray folder.** Removed it (it was empty).
13. **Impeccable.**
    - Checked the package (`impeccable@4.5.2`) and the installer's options first.
    - Ran `npx impeccable install --providers=claude --scope=project --no-hooks`.
    - Result: skill at `.claude\skills\impeccable\` (entry point `SKILL.md`, 42 procedure files under `reference\`, launcher under `scripts\`), engine v0.1.14, and four helper agents under `.claude\agents\`.
    - Hooks were skipped; they are optional and would write `.claude\settings.local.json`.
14. **`CLAUDE.md`.** Created with the eight standing rules (web stack, SQLite, Impeccable for interface work, fresh state, routing, native scheduling, feedback, checks), links to `FACTORY.md`, `reminders-guide.md`, `reminders-brief.md` and the skill entry point, and two boundaries.
15. **`FACTORY.md`.** Updated:
    - header and Setup now name `CLAUDE.md` and the skill;
    - new dispatcher prompt saved, with a note that a running job's prompt cannot be edited in place;
    - Dispatch step 3 now has a fixed worker template (project path, read `CLAUDE.md` and `FACTORY.md`, read the skill for interface tasks, complete brief, role line, return-to-controller line);
    - Workers section names `CLAUDE.md`;
    - new "Impeccable design skill" section: paths, version, install command, hooks, loading route, Node tooling, update steps.
16. **A slip, repaired.** The first edit of `FACTORY.md` dropped the backslashes from the Windows paths in the inserted lines and duplicated two lines in the checker section. Both were fixed and checked before anything used the file.
17. **Dispatcher job.** Deleted job `35e2fcfd` and created job `d89d2b53` with the new prompt at the same `* * * * *` cadence. Recorded the new id in State. CronList: exactly `6ffb2e2a` (checker, untouched) and `d89d2b53`.

    New prompt:
    `Factory dispatcher tick. Read CLAUDE.md and FACTORY.md in C:\_Work\my-software-factory and use them to operate this factory: follow FACTORY.md "Dispatch" exactly, with one active run only (launch nothing if an assignment or maintenance is recorded or pickup is paused), give each worker the project path, its complete brief and the guidance files in the worker template, report to me in this chat per "Feedback", and stay silent on an idle or skipped tick.`

### Discovery trial

18. Queued one disposable inspection task, `T-TRIAL-d1sc0v`, under the queue lock, at the end of the unchecked entries. A first attempt inserted nothing because of a path-escaping problem in the helper command; the second attempt inserted it correctly.
19. Released maintenance, set pickup to enabled and ended the turn.
20. One checker tick fired first (nothing due). Then the new dispatcher tick fired by itself, read `CLAUDE.md` and `FACTORY.md`, claimed the trial and launched a fresh foreground worker (agent id `acc53a04c3c70ff1d`) using only the template lines and the saved brief. No rules and no skill path were passed.
21. The worker ran for about 30 seconds and reported, with file and line for each answer:
    - instruction file: `CLAUDE.md`, loaded at session start and named for an explicit read;
    - its brief: `T-TRIAL-d1sc0v` in `TODO.md`;
    - stack: Node.js with Next.js; database: SQLite when introduced;
    - live store: `REMINDERS.md`, changed only through `reminders.sh`;
    - reminder checker: job `6ffb2e2a`, every minute, delivering to this chat;
    - Impeccable: entry point `.claude\skills\impeccable\SKILL.md`, version 4.5.2, loaded by reading files by path;
    - procedure: it chose `reference\critique.md`, read all 806 lines, and quoted its first heading (`### Purpose`) and one instruction.
22. Controller comparison: the answers match the files, both quoted lines are in `critique.md` at lines 1 and 8, and `git status` was unchanged by the worker.
23. Under the lock, marked the trial `- [x]` and moved it with its brief to the end of `TODO.md`, below T-001 and T-002. Cleared the pointer and set pickup to plain enabled, its state before maintenance.
24. Reported "verified complete" for the trial and the upgrade.
25. Further ticks (checker and dispatcher) found nothing to do.
26. Wrote this file, replacing the part 3 text.

## Files

| File | State |
|---|---|
| `CLAUDE.md` | New, untracked. |
| `.claude\skills\impeccable\` | New, untracked. About 21 MB. |
| `.claude\agents\impeccable-*.md` | New, untracked. Four files. |
| `FACTORY.md` | Modified. |
| `TODO.md` | Modified: T-002 checked and moved; trial entry added, checked, at the end. |
| `REMINDERS.md` | Modified: test records removed, next ID `R-0007`. |
| `SUMMARY.md` | Modified: this file. |

Outside the project: Node.js 24.20.0 at `C:\Program Files\nodejs`.

Nothing was committed in this part.

## Current state

- Pickup: enabled. Active assignment: none.
- Dispatcher job `d89d2b53`; reminder checker job `6ffb2e2a`. Both every minute, both expire 2026-10-20.
- Queue: T-001, T-002 and `T-TRIAL-d1sc0v` all checked; nothing unchecked.
- Reminders: none saved. Default timezone: not confirmed.

## Observed and not observed

**Observed**

- All T-002 live checks: one-off delivered once and completed; recurring delivered twice, 120 s apart; edited reminder sent only at its new time; removed reminder never sent.
- Automatic pickup by the new dispatcher job with the new prompt.
- A fresh worker finding the instruction file, stack, store, checker and skill from files alone.
- A completed entry moved past other entries to the end of the queue (first time there were other entries).
- Exactly one dispatcher and one checker after the swap.

**Not observed**

- Native skill discovery by a worker. The trial worker confirmed `impeccable` was not in its skill list. While this summary was being written, the controller session picked the skill up by itself (`impeccable` appeared in its skill list), so native discovery now works in the controlling chat; a worker's list has not been rechecked.
- The skill's own launcher (`scripts\impeccable.cmd`). The worker skipped it because the skill says it may download a binary on first run.
- Whether a new session loads `CLAUDE.md` automatically. The trial worker was told to read it.
- A tick coming due during a run, and behaviour across expiry, sleep and restart.

## Needs the user

- Nothing is needed for the skill in the controlling chat any more: `/impeccable` became available there without `/reload-skills`. Do not restart the session without reason; that ends both scheduled jobs.
- Confirm a timezone the first time a reminder is scheduled.
- The checked trial entry is still at the end of `TODO.md`; it can be removed on request.

## Things to know

- A session cron job's prompt cannot be edited. Changing it means deleting and recreating the job, which gives it a new id.
- The stray garbled-name folder was probably created by the PowerShell time helper. If it reappears, that is a defect to queue.
- No web app, reminder migration, `PRODUCT.md` or `DESIGN.md` was created by this upgrade.
- Both jobs are session-only and expire after seven days. Restart with: "Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory."
- Idle ticks still post a "." in chat, now from two jobs.
