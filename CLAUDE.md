# Project instructions — my-software-factory

Project path: `C:\_Work\my-software-factory`. This is the project instruction file and the one authoritative set of standing rules. Claude Code loads it at session start; workers and scheduled ticks are also told to read it explicitly, because a session that started before an edit does not see the change.

Read before acting, as the work requires:

- [FACTORY.md](FACTORY.md) — how the factory runs: queue, dispatcher, reminder checker, feedback route, controls. Read it for any factory, queue or automation work.
- [reminders-guide.md](reminders-guide.md) — how to use the reminder service. Read it before any reminder request.
- [reminders-brief.md](reminders-brief.md) — the agreed behaviour of the reminder service.
- [browser-app-brief.md](browser-app-brief.md) — the agreed behaviour of the Reminders browser app and its shared SQLite database. Read it before changing the app, the database or the shared operations. Its controls are in FACTORY.md "Reminders browser app".
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) — product and design context for interface work (assumptions are labelled).
- [.claude/skills/impeccable/SKILL.md](.claude/skills/impeccable/SKILL.md) — the Impeccable design skill entry point. Read it for any interface work.
- [REVIEW.md](REVIEW.md) — the fixed review criteria. Every assignment is reviewed against it by a fresh reviewer before completion; read it when reviewing.

## Standing rules

1. **Web stack.** Use Node.js and Next.js for web applications, in compatible supported versions (installed: Node.js 24 LTS; Next.js 16 needs Node.js 20.9 or later). Follow the documentation for the installed versions, not memory. Keep `package.json` and the lockfile in the repository. The installed Next.js ships its own documentation in `node_modules\next\dist\docs\`: read the relevant page there before writing or changing app code (this replaces a separate generated agent-guidance file).
2. **Database.** Use SQLite when database storage is introduced. Chat, browser and reminder checking must share one database. Any migration preserves reminder IDs, text, schedules, named timezone, status and delivery destination. The live store is the SQLite database `data\reminders.db` (migrated from Markdown by T-003). It is read and written only through the shared operations in `lib\reminders\ops.mjs`: `reminders.sh` for chat and the checker, the app's API for the browser. Never recreate `REMINDERS.md`, never import the historical backup in `backups\markdown-store-pre-sqlite\`, never open a copy of the database as a second store, and test only against scratch databases (`REMINDERS_DB`).
3. **Interface work.** Use the installed project Impeccable skill. Before building or reviewing an interface, read its entry point and the relevant procedure under `.claude/skills/impeccable/reference/`. Do not work from a summary of it. Save product and design context from the agreed brief (`PRODUCT.md`, `DESIGN.md`), labelling assumptions as assumptions.
4. **Fresh state.** Inspect the current project files and records before acting, and preserve unrelated work. Conversation memory is not the data store.
5. **Routing.** Application-task intake saves the complete worker brief in the current queue, confirms its reference and stops. The dispatcher gives a fresh worker only that brief, the project path and the required guidance. The worker implements it, never enqueues it again, and returns to the controller. The controller keeps the assignment through its completion gates, including the review gate: a fresh reviewer against REVIEW.md, repair by a worker, a new fresh reviewer after every change, and completion only on a clean verdict. Factory upgrades are controller maintenance between assignments, not queued tasks.
6. **Scheduling.** All factory and reminder-checker scheduling goes through the harness's native automation (the Claude Code session scheduler). Use its actual controls to create, inspect, update, pause or resume a job; editing saved instructions does not change a running job. Every upgrade keeps the 60-second dispatcher trigger and the single-active-run guard. Scheduling and session control stay with the controller session; workers never schedule.
7. **Feedback.** The user-facing feedback route is recorded in FACTORY.md (the controlling chat). Report task progress, blockers and completion there with the task reference and the observed result. Logs and files are not feedback. Do not repeat idle updates.
8. **Checks.** Run the relevant checks, and inspect changed browser flows when an interface exists. Report passed, failed and unrun checks separately, and update the operating guidance once verified.

## Boundaries

- Do not edit `TODO.md`, the State section of `FACTORY.md` or any scheduled job unless you are the controller acting under FACTORY.md.
- Keep secrets out of project files.
