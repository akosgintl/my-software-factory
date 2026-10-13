---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/ui/RemindersApp.tsx","app/ui/ReminderForm.tsx","app/ui/ReminderDetail.tsx","app/globals.css"]
---

# Reminders screen (app/page.tsx)

Scope: the single screen of the Reminders browser app. Visitor mode: Operate.

- Audience and job: the factory's owner, on their own PC beside the chat, scanning what is saved and fixing a text or a time. Tasks: scan, open details, create, change, stop sending, remove.
- Content: real reminder records only (ID, text, status, due time in the named timezone with offset, recurrence, destination). No metrics, no marketing copy.
- Constraints: standard web controls; keyboard operable; usable at 360 px; committed database values only; a form in progress is never overwritten by a refresh; list rows show the first three lines of a long text and details show all of it; the page never claims instant consistency or proof of delivery.
- Decision round: unattended. No question tool and no route to the user existed for the implementation worker, so the dealt direction was built and the assumptions are recorded in PRODUCT.md. The user can ask for a re-roll.
- Unresolved: light theme only (assumed desk use in room light); no dark theme was requested.

## Direction contract

THESIS: A reminder is a card filed under a call number. The screen is a card catalogue you can scan in one pass: every row leads with its stable ID, groups sit behind coloured guide tabs. It refuses the category default of a white to-do list with checkboxes and one blue accent.

OWN-WORLD: Library card catalogue, lent as type, palette, density and one signature only. Enamelled cabinet green shell; cool card-stock surfaces on a pale sage ground; stamp-pad blue for actions and selection; guide-card tints (blue, buff, green, salmon) that name the four groups; the index card's red header rule under a record's call number. Libre Franklin for everything; a typewriter face (Courier Prime) only for call numbers and exact UTC instants.

STORY: The visitor sees at once what will be sent next and when, in which timezone; opens one card; changes or removes it with confidence that chat and the checker act on the same record.

FIRST VIEWPORT: Green header bar: "Reminders", freshness line, Refresh, New reminder (primary, right). Below, two panes: left 52% the catalogue (tabbed groups "Needs your attention", "Scheduled", "Not scheduled", "Delivered"; rows = call number column, text, due line); right the open card (call number as heading over the red rule, status, text, facts, actions with Remove set apart). Narrow: one pane at a time.

FORM: Operate shell with standard controls; signature move = guide-card tabs plus the typed call-number column. Candidate 7 of 7 on the grounded list (card catalogue); seed key 2bb706fd. Raises from the dealt hand: state is never colour alone, each status carries a mark and a word (exposure record); a delivered one-off stays filed as "Delivered" instead of vanishing (ticket wallet); the number is the card's only headline (catalogue sleeve); one hairline weight throughout (reference setting); the destructive action stands apart from its neighbours (developer console); the next-due line carries the row's emphasis (star atlas). All six challengers declined on product clarity for a working screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
