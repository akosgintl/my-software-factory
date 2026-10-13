# Session summary — part 6: the Reminders web app (T-003)

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

This covers everything from the "Queue one task titled Build the Reminders Web App" request to the request for this summary. Earlier parts are the previous versions of this file in git.

## Status

**T-003 is not checked off yet, but it is one step from completion.** The app is built and running, the store is migrated to SQLite, and the sixth fresh review returned CLEAN on the current files. One final live check was still in flight when this summary was requested: a synthetic reminder, `R-0012`, due at 17:31, to be delivered by the native checker on the current build. After that the controller removes it and completes the task.

## State at the start

- Factory enabled: dispatcher job `34560376`, reminder checker job `6ffb2e2a`, both every minute.
- Queue: nothing unchecked. Reminders: none saved, next ID `R-0007`, store `REMINDERS.md`.
- Review gate, `CLAUDE.md`, `REVIEW.md` and the Impeccable skill in place. The user had committed everything up to `a8a7a34 part-02 -> 02-factory-review-loop`.

## What was asked

1. **Intake.** Queue one task, "Build the Reminders Web App", with the supplied brief. Intake only.
2. During the run: "no Remainder R-... messages" (a report that nothing had arrived).
3. During the run: "how many review rounds are?"
4. **This summary.**

## Timeline

Times are local (UTC+2).

### Intake and pickup

1. Reread `FACTORY.md`, `CLAUDE.md` and `TODO.md`: intake open, no claim, no matching entry, prerequisites present.
2. Under the queue lock, inserted `T-003: Build the Reminders Web App` at the end of the unchecked entries (`TODO.md` line 13, brief on lines 14–80). Read-back diff: identical to the supplied brief plus the project-path line.
3. Reported "queued" and stopped.
4. The next dispatcher tick claimed T-003 and launched a fresh foreground worker with the template lines, the skill line (interface task), the verbatim brief, and a short list of controller facts (how to request the checker switch and the app start, Node's location, no browser tool).

### Implementation (about 46 minutes)

Worker `a94555ac2843edf24`. What it built:

- **Shared operations** in `lib\reminders\` on SQLite (Node's built-in `node:sqlite`): create, list, modify, schedule, stop sending, remove, due, ack, retry, status, backup. Every write is one `BEGIN IMMEDIATE` transaction; browser edits carry a revision and are refused on conflict.
- **Chat and checker command:** `reminders.sh` is now a thin wrapper around `reminders-cli.mjs`; same commands, wording and exit codes.
- **Timezones** now come from Node's own data; the PowerShell helper was removed after matching output on 12 cases.
- **App:** Next.js 16.4.0, React 19.3.0, under `app\`, with an API under `app\api\`. One screen: list plus a details/edit/create panel. It rereads every 5 seconds while visible, on focus and on Refresh. No scheduler in the app.
- **Migration:** `REMINDERS.md` (no records, next ID `R-0007`) backed up byte-identical to `backups\markdown-store-pre-sqlite\`, imported twice without duplicates, verified, switched. Live database: `data\reminders.db`.
- **Controls:** `app.sh` / `app.cmd` with `status | build | run | start | stop | restart`. Address `http://localhost:3210`, bound to this computer only.
- **Docs:** `browser-app-brief.md`, `PRODUCT.md`; updates to `reminders-brief.md`, `reminders-guide.md`, `CLAUDE.md`, `FACTORY.md`.
- **Checks it ran:** 22 unit tests and 23 browser tests in headless Edge, all passing.
- **Design process:** unattended. The Impeccable direction (a library card catalogue) was built without a user choice; assumptions are labelled in `PRODUCT.md`. Light theme only.
- Its Impeccable documenter agent (`a7c1c10b312c2a976`) wrote `DESIGN.md` and `.impeccable\design.json` a few minutes after the handoff.

### Controller steps after the handoff (from 14:16)

5. Replaced the checker job: deleted `6ffb2e2a`, created `982a02f2` with a prompt that reads the SQLite database. Recorded the migration stage as complete.
6. Started the app as a background task of this session.
7. The worker resumed briefly (its background agents had returned) and rebuilt underneath the running server; restarted the app.
8. Asked which Chrome to use; the user chose "Browser 1".
9. Live checks in the user's Chrome and the real chat, with synthetic reminders `R-0008`–`R-0011`:
   - chat-created reminder seen in the page; browser edit read back in chat;
   - with a half-filled form open, a chat change appeared after Refresh and the typed text stayed;
   - saving with no date, no time and an unknown timezone was refused beside each field, nothing saved, entries kept;
   - a browser-created reminder was modified through chat;
   - "Stop sending" on `R-0009` confirmed in the page and showed it as not scheduled.
10. Not observed there: automatic polling (the automated tab reported itself hidden) and the narrow layout (the window would not resize).
11. Closed the tab and ended the turn at 14:22 so the checker could deliver.

### The missing reminders (14:22–14:58)

12. **Nothing arrived.** The user reported it at 14:58. No tick of either job had fired for 36 minutes, although both jobs existed.
13. **Cause:** the app server was running as a background task of this session, and the scheduler fires no ticks while a session background task is alive.
14. **Fix:** stopped the task and started the app detached (`app.sh start`). Ticks resumed within a minute.
15. The checker then delivered `R-0010` (one-off) and `R-0011` (every 2 minutes), each once, labelled late. `R-0010` was saved completed; `R-0011` skipped the missed occurrences and advanced on its grid. A minute later `R-0011` arrived on time and advanced by 120 seconds. `R-0009`, stopped in the browser, was never sent.
16. `app.sh restart`: the same three records were read through the API and through chat.
17. Removed the synthetic reminders. Corrected `FACTORY.md`: the app runs detached, never as a session background task, and a note that background tasks block ticks.

### Review gate (15:00–17:26)

Each row is a new agent; no reviewer was resumed and none opened the review record.

| Round | Agent | Verdict | Findings |
|---|---|---|---|
| Review 1 | `a65f4354954f08fbb` | NOT CLEAN | 7 |
| Repair 1 | `a9bddf36dc7e52dd9` | — | all fixed |
| Review 2 | `ab29db452f4df1d1a` | NOT CLEAN | 3 |
| Repair 2 | `a721cc0c142bc5e59` | — | 2 fixed (1 by controller) |
| Review 3 | `a7a2062d65d06b561` | NOT CLEAN | 2 |
| Repair 3 | `ad8a902f257faad14` | — | fixed, plus 5 of the same kind |
| Review 4 | `af76b1d2f403d581d` | NOT CLEAN | 2 |
| Repair 4 | `ad7b57f85378c550d` | — | fixed, plus 7 of the same kind |
| Review 5 | `a2dd2ca8aea39d2e9` | NOT CLEAN | 2 |
| Repair 5 | `ae5ad60bb6032b11a` | — | fixed |
| Review 6 | `a6197517adde5c221` | **CLEAN** | 0 |

The findings, by round:

1. **Round 1**
   - `app.sh stop` could force-kill an unrelated process named in a stale state file.
   - Keyboard focus lost after several in-panel actions.
   - Control borders at about 2.4:1 contrast against a 3:1 commitment.
   - Date and time inputs showed the browser's locale format against ISO hints.
   - On narrow screens the date error sat under the time field.
   - The page route lacked the local-address guard the API had.
   - `app.sh status` crashed when its output pipe closed.
2. **Round 2**
   - "Keep my entries" could show a schedule or text that Save did not store.
   - A notice left a sentence lower-case.
   - The controller's own `FACTORY.md` record named a stale process id (fixed by the controller).
3. **Round 3**
   - On narrow screens the result notice was hidden while a card was open.
   - "Keep editing" dropped keyboard focus.
4. **Round 4**
   - With a long list, a tall card's buttons could only be reached by scrolling past the list.
   - A "Created…" notice stayed above the edit form and could contradict a newer change.
5. **Round 5**
   - With a short list, the list started below the top of the card (a side effect of repair 4).
   - `DESIGN.md` recorded a type size that differed from the stylesheet.

Every reviewer ran both saved suites and rendered the app in headless Edge at a desktop and a narrow size on an isolated instance. Tests grew from 22 unit and 23 browser to 26 and 35. From round 3 on, each reviewer's file-state id matched the controller's.

The controller restarted the live app after each repair. Between rounds 2 and 3 it moved earlier agents' scratch files aside, after a reviewer ran a leftover probe script by mistake (no project file or live data was affected).

During the run the user asked how many review rounds there were; the answer given was six, with the table of verdicts.

### After the clean verdict (17:26)

18. Confirmed the delivery code is unchanged since the live deliveries: the shared operations, the chat command and the API routes all have modification times before 14:16.
19. Rechecked in the user's Chrome on the current build: chat-created `R-0012` shown in the page; browser-created `R-0013` read and removed through chat.
20. Closed the tab and ended the turn so the checker could deliver `R-0012` at 17:31. Two checker ticks before that time found nothing due.
21. Wrote this file, replacing the part 5 text.

## Files

New: `app\`, `lib\`, `scripts\`, `tests\`, `proxy.ts`, `app.sh`, `app.cmd`, `reminders-cli.mjs`, `reminders.config.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `.gitattributes`, `browser-app-brief.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable\`, `backups\markdown-store-pre-sqlite\`, `reviews\T-003.md`.

Modified: `CLAUDE.md`, `FACTORY.md`, `TODO.md`, `reminders-brief.md`, `reminders-guide.md`, `reminders.sh`, `SUMMARY.md`.

Removed from the root: `REMINDERS.md`, `reminders-time.ps1` (copies are in the backup folder).

Not tracked by git: `data\reminders.db`, `node_modules\`, `.next\`, `.app\`, `tests\e2e\output\`.

Nothing was committed in this part.

## Current state

- Pickup: enabled. Active assignment: T-003, final live re-check.
- Dispatcher job `34560376`; reminder checker job `982a02f2` (replaced `6ffb2e2a`). Both every minute, both expire 2026-10-20.
- App: running detached at `http://localhost:3210`.
- Live store: `data\reminders.db`. One synthetic reminder, `R-0012`, due 17:31. Next ID `R-0014`.
- Reviewed file state: `9ec8cf9d4070d83f`. Since that review only the controller's pointer line in `FACTORY.md` and this summary have changed.

## Still to do for T-003

1. Observe `R-0012` delivered in chat and saved as completed.
2. Remove it.
3. Confirm no candidate file changed since the clean review.
4. Check T-003 off, move it to the end of `TODO.md`, clear the pointer, report completion.

## Open questions for the user

- **Default timezone.** The live database has Europe/Budapest saved as the default timezone. It was written at 16:22:49, during repair worker 4's run, by a writer the controller has not identified. If the user set it in the browser, nothing is needed. If not, a worker's test reached the live database, which is an isolation gap to queue as a defect.
- **Design direction.** The card-catalogue look was chosen unattended. It can be re-rolled as a new task.

## Observed and not observed

**Observed**

- Chat and browser reading and writing the same records in both directions, in the user's Chrome, on the first build and again on the current one.
- Native checker deliveries in this chat: a one-off (completed), a recurring reminder (late catch-up, then on time), and a stopped reminder not sent. These were on the first build; the delivery code is unchanged since.
- Restart through `app.sh restart` with the same records afterwards.
- A scheduler stall caused by a session background task, and its recovery.
- Five not-clean reviews, each followed by a repair and a different fresh reviewer, then a clean one.

**Not observed**

- A native checker delivery on the final build (in flight).
- Automatic polling and the narrow layout in the user's real Chrome. Both rest on headless Edge, by the worker and by four reviewers.
- A screen reader, real touch, browser zoom.
- Migration of real records: the source store was empty; only a test fixture covers records.

## Things to know

- **Never run a long-lived background task in the controller session.** It stops the dispatcher and the reminder checker until it ends.
- The app must be started with `bash app.sh start` (detached). It stops at shutdown or restart of the machine and must be started again.
- Reminder text is now limited to 2000 characters.
- The date and time fields are plain text fields taking `YYYY-MM-DD` and 24-hour `HH:MM`; the browser's date picker was given up for consistency.
- A real task with an interface took about 46 minutes to build and about 2.5 hours to review and repair, in one dispatcher run. No reminder checks run during such a run.
- `REVIEW.md` step 2 still mentions the retired `REMINDERS.md`. It is fixed criteria; correcting it is separate maintenance.
- Both jobs are session-only and expire on 2026-10-20. Restart with: "Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory."

## Controls

- App: `bash app.sh status | start | stop | restart | build` (or `.\app.cmd …` in PowerShell).
- Factory, in the controlling chat: "Factory status", "Pause factory pickup", "Resume factory pickup", "Stop the factory".
- Reminder checker: "Reminder checker status", "Pause the reminder checker", "Restart the reminder checker".
