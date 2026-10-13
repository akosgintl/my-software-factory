# Product

<!-- impeccable:product-schema 1 -->

Source: the agreed brief of factory task T-003 ([browser-app-brief.md](browser-app-brief.md)) and the existing service brief ([reminders-brief.md](reminders-brief.md)). No interview could be held: the implementation worker had no question tool and no route to the user mid-run. Everything marked **Assumption** below was inferred from those briefs and is open to correction; nothing else was invented.

## Platform

web

## Stack

Fixed by the project's standing rules (CLAUDE.md), not chosen here: Node.js 24 LTS, Next.js 16 (App Router), SQLite. Personal use on the user's own Windows PC; no accounts, no public deployment.

## Users

One person: the owner of this software factory, on their own Windows 11 PC. They already keep reminders by talking to a chat agent in VS Code; a scheduled reminder checker in that chat delivers the ones that are due. They open the browser app on the same machine, next to the chat, to see everything at once, to fix a time or a wording faster than by describing it, and to check what is about to be sent.

**Assumption:** short, occasional visits on a desktop monitor beside an editor, in ordinary room light; sometimes a narrow window snapped to the side of the screen.

## Product Purpose

Reminders: a browser window onto the same reminders the chat service keeps. It lets the user scan, create, read, change, stop and remove reminders, and shows exactly what the chat and the checker will act on. Success: a reminder made in chat is visible here within the documented refresh interval and the other way round, with the same ID, text, time, timezone and recurrence; a removed or stopped reminder is never sent; nothing typed is lost when a value is refused or when the list refreshes.

## Positioning

It is not a second reminders app. Chat, browser and the reminder checker share one SQLite database through one set of validated operations, so there is nothing to sync and no second schedule engine: the browser never sends a reminder, the existing native checker does.

## Operating Context

- The reminder conversation: the chat of the Claude Code session that owns the reminder checker (FACTORY.md "Reminder checker"). Due reminders arrive there as `Reminder R-NNNN: ...` messages, only while that checker is running and idle.
- The browser app runs on the same PC at a local address and stays open in a tab while chat and the checker change records.
- Every scheduled reminder carries a named IANA timezone; the host's timezone is never adopted silently.

## Capabilities and Constraints

- Reminder kinds: unscheduled text (never sent), one-off, calendar recurrence (daily, weekly on named weekdays, monthly on a day), exact-duration recurrence (every N minutes, hours or 24-hour days).
- States: unscheduled, active, completed (a delivered one-off); delivery in progress and delivery uncertain are shown, and reconciled in chat.
- Stable IDs `R-NNNN`, never reused.
- "Stop sending" keeps the text and drops the schedule; "Remove" deletes the record. Both make the reminder ineligible for delivery at once.
- Not supported, and said so rather than approximated: yearly rules, nth-weekday rules, end dates, repeat counts, seconds.
- Delivery is at most once per occurrence automatically, never promised exactly once; the browser shows saved state, not proof of receipt.
- Updates from chat and the checker appear by polling (interval documented in reminders-guide.md), on window focus and on manual refresh; not instantly.
- Out of scope for this version: accounts, public deployment, app-owned reminder processing, notifications outside the chat.

## Brand Commitments

None existed before this task. Product name in the interface: "Reminders". Voice: plain, exact, second person; times always with their timezone. **Assumption:** no logo or wordmark is wanted.

## Evidence on Hand

- The live store was empty at migration (no records; next ID R-0007; no default timezone confirmed). All example reminders used during development are synthetic, labelled "SYNTHETIC" and removed afterwards.
- No testimonials, metrics or third-party claims exist or may be invented.

## Product Principles

1. One truth: show committed database values, never an optimistic guess.
2. Time is never ambiguous: every due time carries its named timezone and offset; unclear or impossible values are explained, not guessed.
3. The user's typing is sacred: refused input stays in the form; refreshes never overwrite an edit in progress.
4. Honest about delay and delivery: say how fresh the list is and what delivery does not promise.
5. The same rules everywhere: chat, browser and checker go through the same operations.

## Accessibility & Inclusion

Labelled controls, full keyboard operation with visible focus, text that wraps instead of truncating (the list shows the first three lines of a long reminder so it stays scannable; details always show all of it), usable at a narrow width (about 360 px), contrast at WCAG AA, status never conveyed by colour alone, reduced-motion respected. **Assumption:** WCAG 2.2 AA as the working standard; no further specific need was stated.
