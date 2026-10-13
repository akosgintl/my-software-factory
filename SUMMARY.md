# Session summary — part 5: review and repair gate

Date: 2026-10-13. Project: `C:\_Work\my-software-factory`. Session: `my-software-factory-c8` (Claude Code in VS Code).

This covers everything from the "Add a review and repair gate to this factory" request to the request for this summary. Earlier parts are the previous versions of this file in git.

## Outcome

The factory now has a review and repair gate. No task is checked off until a fresh reviewer returns a clean verdict against `REVIEW.md` on the current files. A trial showed the full sequence: implementation with a planned defect, a review that found it, a repair, a different review that was clean, and completion only then. The trial's leftovers are removed and the factory is enabled.

## State at the start

- Factory enabled: dispatcher job `d89d2b53`, reminder checker job `6ffb2e2a`, both every minute.
- No active assignment; nothing unchecked in the queue; no reminders saved.
- Everything from part 4 had been committed by the user as `2549f94 part-02 -> 01-factory-stack-and-design`; the working tree was clean.
- Between the part 4 summary and this request, several checker and dispatcher ticks fired and found nothing to do. During that time the four Impeccable helper agents (`impeccable-asset-producer`, `-documenter`, `-finish-reviewer`, `-manual-edit-applier`) became available to this session as agent types.

## What was asked

1. **Maintenance request.** Apply directly, as controller maintenance and not as a queued task:
   - save fixed review criteria in `REVIEW.md`;
   - make the dispatcher keep each assignment through fresh review, repair and re-review until clean;
   - update the actual dispatcher prompt and the worker and reviewer templates;
   - trial the gate with a harmless two-line text file whose first implementation omits one line;
   - confirm that an unavailable required check cannot produce completion.
2. **This summary.**

## What was done, in order

### Reserving maintenance

1. Confirmed the prerequisites: dispatcher `d89d2b53`, checker `6ffb2e2a`, `CLAUDE.md`, the Impeccable skill, `reminders-brief.md`, `reminders-guide.md`. `REVIEW.md` did not exist yet.
2. Nothing was claimed, so paused pickup in `FACTORY.md` (prior state: enabled; reason recorded) and started at once.

### Saving the gate

3. **`REVIEW.md`** created:
   - who reviews: a fresh reviewer with no part in the implementation or in earlier reviews; it reports and never repairs;
   - the six-step procedure: read and locate; check the work; changed interface (Impeccable `critique.md`, rendered app at desktop and narrow sizes, the listed interface checks); no rendered interface; findings; verdict;
   - a required check that was not performed is itself a finding;
   - a report format ending in `CLEAN` or `NOT CLEAN`.
4. **`FACTORY.md`** updated:
   - Setup links `REVIEW.md`;
   - Dispatch steps 4–6 rewritten: after the worker returns, report "implementation handed over" and run the gate; blockers keep the task unchecked and claimed without rapid retries; check off only after a `CLEAN` review of the current files, clearing only the assignment pointer;
   - new "Review gate" section: the route (a new foreground agent each time, never a resumed reviewer, no scripted launch), the sequence, what is never clean, the review record `reviews\<task id>.md`, and the feedback points;
   - reviewer template and repair template added;
   - the saved dispatcher prompt extended with the gate.
5. **`CLAUDE.md`** updated: `REVIEW.md` added to the reading list, and standing rule 5 now names the review gate.
6. **Dispatcher job.** Deleted `d89d2b53` and created `34560376` with the new prompt at the same `* * * * *` cadence. Recorded the new id. CronList: exactly `6ffb2e2a` (checker, untouched) and `34560376`.

   New prompt:
   `Factory dispatcher tick. Read CLAUDE.md and FACTORY.md in C:\_Work\my-software-factory and use them to operate this factory: follow FACTORY.md "Dispatch" exactly, with one active run only (launch nothing if an assignment or maintenance is recorded or pickup is paused), give each worker the project path, its complete brief and the guidance files in the worker template, keep the assignment through the "Review gate" (fresh reviewer against REVIEW.md, repair, new fresh reviewer, complete only on a CLEAN verdict for the current files), report to me in this chat per "Feedback", and stay silent on an idle or skipped tick.`

### Queuing the trial

7. Under the queue lock, added `T-TRIAL-g4te: Review-gate trial fixture (disposable)` at the end of the unchecked entries:
   - create `trial-fixture-g4te\note.txt`;
   - fixed acceptance criterion: exactly the two lines `gate trial line one` and `gate trial line two`;
   - trial instruction for the first implementation worker only: omit the second line and say so.
8. Released maintenance, set pickup to enabled, ended the turn.

### Running the trial

One checker tick fired first (nothing due). Then the new dispatcher tick fired by itself and ran the whole sequence in one turn of about three minutes.

| Step | Agent | `note.txt` state | Result |
|---|---|---|---|
| Claim | controller | — | Pointer written; "picked up" reported |
| Implementation | `ae077146ba46f4739` | sha256 `8bed60ea…`, 20 bytes, 1 line | Second line omitted, as instructed, and disclosed |
| Controller inspection | controller | `8bed60ea…` | "Implementation handed over" reported; review record started |
| Review 1 | `a3b49f8b0c7a54604` | `8bed60ea…` | `NOT CLEAN`. F1: second line missing |
| Repair | `a578343ad6319a9cf` | sha256 `77239b40…`, 40 bytes, 2 lines | Reproduced F1, added the line, reran checks |
| Controller inspection | controller | `77239b40…` | Both lines present; hash recorded |
| Review 2 | `a4f49d8f12884f92a` | `77239b40…` | `CLEAN`. No findings |
| Completion | controller | `77239b40…` (rechecked) | Entry checked and moved to the end; pointer cleared |

- Base revision for all rounds: `2549f94`.
- Every agent was a new one. No reviewer was resumed, and the second reviewer reported that it did not open the review record.
- Each worker and reviewer got only its template lines, the saved brief and, for repair, the finding verbatim.
- Both reviewers stated that a rendered interface did not apply, and why.

### Probe: unavailable required check

9. First attempt: a fresh reviewer given a probe brief requiring it to run a verifier script in the fixture folder. The permission classifier refused to launch that agent ("Create RCE Surface"). Nothing ran.
10. Second attempt, without executing anything: a fresh reviewer (`a1572d5c77b016bf7`) given a probe brief (`PROBE-g4te-check`, not a queued task) requiring a byte comparison against a reference file that does not exist.
11. Result: `NOT CLEAN`. The file itself passed, and the unperformed comparison was reported as finding F1, citing `REVIEW.md` steps 5 and 6.

### Cleanup

12. Removed the `trial-fixture-g4te` folder, the trial's review record `reviews\T-TRIAL-g4te.md` (and the then-empty `reviews` folder) and, under the lock, the trial's entry in `TODO.md`. `TODO.md` is identical to its committed content again.
13. Confirmed: pickup enabled, no active assignment, one dispatcher and one checker, `reminders.sh due` gives `NOTHING_DUE`, no reminders saved.
14. Reported the result, the sequence, the limitations and the controls.
15. Further ticks (checker and dispatcher) found nothing to do.
16. Wrote this file, replacing the part 4 text.

## Files

| File | State |
|---|---|
| `REVIEW.md` | New, untracked. |
| `FACTORY.md` | Modified: review gate, templates, new dispatcher id and prompt. |
| `CLAUDE.md` | Modified: `REVIEW.md` link, rule 5. |
| `SUMMARY.md` | Modified: this file. |
| `TODO.md` | Unchanged from the last commit. |

Nothing was committed in this part.

## Current state

- Pickup: enabled. Active assignment: none.
- Dispatcher job `34560376`; reminder checker job `6ffb2e2a`. Both every minute, both expire 2026-10-20.
- Queue: T-001, T-002 and `T-TRIAL-d1sc0v` checked; nothing unchecked.
- Reminders: none saved. Default timezone: not confirmed.

## Observed and not observed

**Observed**

- Automatic pickup by the new dispatcher job.
- A fresh review finding the planned defect.
- A repair by a separate worker, and a different fresh reviewer returning `CLEAN` on the repaired file.
- Completion happening only after the clean verdict, on a file whose hash matched the reviewed one.
- A reviewer refusing a clean verdict when a required check could not be performed.

**Not observed**

- The controller keeping a real queued task unchecked because of a not-clean verdict from an unavailable check. The probe was not a queued task; that step rests on the saved rule.
- Rendered-interface review. It did not apply to the trial; the interface steps of `REVIEW.md` are unexercised.
- More than one repair round.
- A tick coming due during the run, and behaviour across expiry, sleep and restart.

## Things to know

- The gate runs inside one dispatcher turn. Reminder checks do not run during it and catch up afterwards.
- A real task now costs at least two agents (worker and reviewer), and two more for each repair round.
- Review records are written under `reviews\`, one file per task. Only the trial's was created, and it was removed.
- The earlier trial entry `T-TRIAL-d1sc0v` is still at the end of `TODO.md`.
- Both jobs are session-only and expire after seven days. Restart with: "Read FACTORY.md in C:\_Work\my-software-factory and use it to operate this factory."

## Controls

Say these in the controlling chat:

- "Factory status"
- "Pause factory pickup" / "Resume factory pickup"
- "Stop the factory"
- "Reminder checker status"
- "Pause the reminder checker" / "Restart the reminder checker"
