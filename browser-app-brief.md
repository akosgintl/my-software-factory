# Browser app brief (agreed behaviour of the Reminders web app)

What the Reminders browser app is and must keep doing. It extends the chat reminder service described in [reminders-brief.md](reminders-brief.md); how to operate both: [reminders-guide.md](reminders-guide.md). Built by factory task T-003. Changes to anything here go through the active development queue in [FACTORY.md](FACTORY.md). Product and design context for interface work: [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md).

## Purpose and scope

- A Next.js web app that shows and changes the same reminders the chat service keeps, in one writable SQLite database shared by chat, browser and the reminder checker.
- Personal, on the user's own Windows PC, reachable only from that PC. No accounts, no public deployment.
- The app never sends reminders and contains no scheduler, timer or background job. Due checking and chat delivery stay in the one existing native reminder checker (FACTORY.md "Reminder checker").
- Chat operations (add, list, modify, schedule, stop sending, remove) and the checker's commands are unchanged for the user; they now read and write the database.

## One database

- Canonical path: `C:\_Work\my-software-factory\data\reminders.db`, named in `reminders.config.json` and resolved only by `lib/reminders/paths.mjs`. It is durable host storage outside the build output (`.next`), and is not committed to git.
- Every reader and writer uses that path: `reminders.sh` → `reminders-cli.mjs` (chat and checker) and the Next.js route handlers (browser). There are no copies and no writable Markdown mirror. The database is never created implicitly: a missing file is an error.
- `REMINDERS_DB` replaces the path for isolated tests only; the app then shows "Test data" and the commands say so.
- The Markdown store was migrated on 2026-10-13 (staged: backup → import → verify → switch → checker switched). `REMINDERS.md` no longer exists in the project root; its byte-identical copy is a labelled historical backup in `backups\markdown-store-pre-sqlite\` and is never imported again.

## Records preserved

- Stable ID `R-NNNN` (never reused), text, state (unscheduled, active, completed), named IANA timezone, recurrence rule, next due instant (UTC) and its local reading, pending occurrence with run handle and time, last delivered occurrence and acknowledgement time, delivery destination (one exists: the reminder checker's chat).
- "Stop sending" keeps the text and drops the schedule; "Remove" deletes the record. Both take effect for the checker at once. A completed one-off stays listed as delivered until removed or rescheduled.

## Shared operations

`lib/reminders/ops.mjs` holds the only implementation of: create, list/read, modify text, set schedule, stop sending, remove, resolve (preview), default timezone, due selection, acknowledge, retry, status, backup. Rules:

- Validation is the same for chat and browser: one-line text of at most 2000 characters; a named timezone (from the request or the confirmed default, never the host); a time in the future; supported rules only; real dates; clock-change policy as in reminders-brief.md.
- Every write is one SQLite `BEGIN IMMEDIATE` transaction: take the write lock, re-read the record, check, change that record only, commit. Concurrent writers wait (busy timeout 5 s) and otherwise fail with "busy" without changing anything.
- A browser change carries the revision it was based on; if the text or schedule changed in between, it is refused with the current record instead of overwriting it. Delivery progress (due, acknowledge) does not invalidate an edit in progress.
- Overlapping checks cannot both take an occurrence: selection marks it pending inside the write transaction. Delivery stays at most once per occurrence automatically, with uncertain-send handling; it is not exactly-once across SQLite and chat.

## Interface

- One screen: a list to scan (groups: needs your attention, scheduled, not scheduled, delivered) and a panel for details, editing and creating. Narrow windows show one of the two at a time.
- On a wide window the panel stays beside the list wherever the list is scrolled to and is never taller than the window: a long record or form scrolls inside the panel, so its last buttons (Edit, Stop sending, Remove, Save, Cancel) are reached with the mouse wheel from any place in a long list, at the top and the end of the page too, without moving the list. On a narrow window the card scrolls with the page.
- Shows status, due date and time in the reminder's own timezone with UTC offset, the timezone name and the recurrence; details add the stable ID, destination, exact UTC instant and delivery state.
- Labelled controls, full keyboard operation with visible focus, long text wraps, usable at 360 px. Closing a confirmation or prompt (including "Keep editing" on unsaved entries), dismissing a notice, or using any control that removes itself hands keyboard focus to a nearby control, never to the page body. Control boundaries (fields, selects, weekday chips, outlined buttons) keep at least 3:1 contrast.
- Dates and times are typed as they are shown everywhere else, `YYYY-MM-DD` and 24-hour `HH:MM`, in plain fields that state the format; the browser's locale-formatted date and time controls are not used.
- Invalid or ambiguous values are explained next to the field (each message under its own field, also when fields stack in a narrow window); entered values stay in the form; nothing invalid is saved. The resolved first date and time, including clock-change notes, is shown before saving.
- Confirmations are worded from the committed record returned by the database. The result notice, with any warning it carries (a clock change, an occurrence that was being delivered), is shown above whichever pane is on screen at every width and is brought into view when it appears; a refused change is explained next to the control that was used.
- A message stays only while it is true. The result notice goes when the Edit form of its record opens and as soon as a reread shows that record changed or removed (in chat, in another window, or advanced by the checker); a notice about a removal stays until dismissed. In a form, the count of values to correct follows the corrections, and a refusal that belongs to no field goes at the next change to the entries. The prompt about unsaved entries goes once nothing is unsaved; an open "Stop sending" question goes once the reminder has no schedule left; the explanation of a refused Stop or Remove goes at the next attempt.
- Uncertain deliveries are shown and explained; they are reconciled in chat.

## Freshness

- Values are read from the database when the page is opened, after every change made in it, every 5 seconds while the tab is visible (`pollSeconds` in `reminders.config.json`), when the tab or window regains focus, and on the Refresh button.
- No server or browser caching: the page is rendered per request and every API response is `no-store`.
- A change made in chat or by the checker can take up to 5 seconds to appear; the page says so and does not claim instant consistency.
- A failed reread is shown with the time of the values still on screen and is retried. Its message is held at the top of the window while it lasts, so it is seen from any place in a long list; the open card starts below it and keyboard focus is never scrolled behind it.
- A refresh never overwrites a form in progress. If the record being edited changed or was removed elsewhere, the form says so and lets the user keep their entries or load the latest values. Nothing in the form changes until the user chooses. "Keep my entries" keeps the part the user changed (the text, the schedule, or both) and shows the latest saved value for a part they did not change, so the form always shows exactly what Save will leave stored; nothing is saved until the user presses Save.

## Running

- Address: `http://localhost:3210` (also `http://127.0.0.1:3210`), this PC only.
- Every route, the page as well as the API, answers only when the request's Host is `localhost`, `127.0.0.1` or `[::1]` (`proxy.ts`, `lib/server/local-host.ts`); any other name gets 403, so a foreign hostname pointed at this PC cannot read the reminders. The API additionally refuses requests from other sites.
- Controls: `app.sh` / `app.cmd` (status, build, run, start, stop, restart); see FACTORY.md "Reminders browser app". The server is an ordinary application process; stopping it does not affect chat or the checker.

## Checks

- `npm test`: shared operations, chat command, concurrency, migration (scratch databases, test clock), and the app controls (`stop` leaves a process it cannot prove is this app alone; a closed output pipe does not crash a command).
- `npm run test:e2e`: the rendered app in headless Edge against a scratch database on port 3211, including "Keep my entries" after a change made in chat (the form shows what Save stores, in both directions), the wording of result notices and that they and refusals are on screen at 360 px after create, save, stop and a refused change, keyboard focus after confirmations, the unsaved-entries prompt and the timezone controls, text and control-boundary contrast, date and time entry in a US-English browser, message placement at 360 and 375 px, refusal of a foreign Host on the page and the API, messages that must not outlive what they say (the result notice on Edit and after a change in chat, form refusals after a correction, the unsaved-entries prompt), a list of more than 50 reminders with a 2000-character reminder and a weekly form at 1280x900 and 1366x650 (the card's buttons are reached with the wheel while the list stays where it is, from far down the list and from the top), a list shorter than the open card at 1440x900 and 1280x720 (the list starts directly under the notice row, level with the card, whatever the card's height), and the failed-reread message seen from the end of that list without covering the open form.
- Live checks with the real chat and the native checker are run by the controller and recorded in `reviews\T-003.md`.

## Out of scope

Accounts, public or remote access, app-owned reminder processing, notifications outside the chat, a dark theme, reconciling uncertain deliveries in the browser.
