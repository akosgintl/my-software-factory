# REVIEW

Fixed review criteria for this factory. Project: `C:\_Work\my-software-factory`. Rules: [CLAUDE.md](CLAUDE.md). Workflow: [FACTORY.md](FACTORY.md) "Review gate".

These criteria are fixed for the life of an assignment. Changing them is separate controller maintenance, never part of a task and never a way to clear a finding.

## Who reviews

A fresh reviewer, launched by the controller for this one review, with no part in the implementation or in any earlier review of the same assignment. The reviewer reports findings; it does not repair, edit, commit, schedule or complete anything. After any change to the reviewed files, a new fresh reviewer starts again from step 1; an earlier verdict does not carry over.

## Procedure

1. **Read and locate.** Read the full assignment, the project instructions ([CLAUDE.md](CLAUDE.md), [FACTORY.md](FACTORY.md)), the brief relevant to the area (for reminders: [reminders-brief.md](reminders-brief.md), [reminders-guide.md](reminders-guide.md)) and every changed file. Identify what you are reviewing: the git revision, plus `git status` and a content hash for uncommitted files. Inspect the surrounding code and data operations needed to judge the change, not only the changed lines.
2. **Check the work.** Check requested behaviour, preserved capabilities, code quality, error handling and data integrity. Run the relevant saved checks (those in the assignment and in the operating guides) and report their scope and what you observed. Use scratch copies for anything that writes; never test against the live `REMINDERS.md`.
3. **Changed interface.** Read the installed Impeccable review procedure first: `.claude\skills\impeccable\SKILL.md`, then `reference\critique.md` (and `reference\audit.md` for technical quality). Use the actual rendered app at a desktop size and at a narrow/mobile size. Check, where applicable:
   - action labels;
   - time and timezone display;
   - keyboard access;
   - long text;
   - empty and error states;
   - retention of entered values after an error.

   Assess the result against the agreed design direction (`PRODUCT.md`, `DESIGN.md`, the brief). Reading source or looking at an older screenshot does not replace this.
4. **No rendered interface.** Say why none applies. Review changed design guidance as text; do not invent a page to inspect, and do not report a rendered-design result.
5. **Findings.** Report each actionable finding with:
   - the affected location or behaviour;
   - the criterion it fails (from the assignment or this file);
   - what you observed, or how to reproduce it;
   - the correction required.

   Keep unrelated ideas in a separate "Notes" list; they are not findings. A required check that was not performed is itself a finding and prevents a clean verdict.
6. **Verdict.** Return `CLEAN` only when there are zero unresolved findings and every applicable required check was performed on the current result. Otherwise return `NOT CLEAN`. Report the limitations of the review and the revision or file state reviewed. A failure, a timeout, an unavailable app or tool, or an empty response is not clean.

## Report format

    VERDICT: CLEAN | NOT CLEAN
    Reviewed state: <git revision; changed files with content hashes>
    Checks performed: <check — scope — observed result>
    Checks not performed: <check — why>            (any required one means NOT CLEAN)
    Rendered interface: <reviewed at which sizes | not applicable because ...>
    Findings:
      F1. <location/behaviour> — <failed criterion> — <observation or reproduction> — <required correction>
    Notes (not findings): <unrelated ideas>
    Limitations: <what this review could not establish>
