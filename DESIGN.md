---
name: Reminders
description: A card catalogue for the reminders that chat, this page and the reminder checker share.
colors:
  accent: "oklch(0.44 0.13 262)"
  accent-strong: "oklch(0.37 0.13 262)"
  accent-tint: "oklch(0.935 0.035 262)"
  accent-line: "oklch(0.8 0.07 262)"
  shell: "oklch(0.31 0.055 165)"
  shell-2: "oklch(0.38 0.055 165)"
  shell-ink: "oklch(0.97 0.012 150)"
  shell-ink-2: "oklch(0.87 0.03 155)"
  tab-attention: "oklch(0.87 0.075 35)"
  tab-scheduled: "oklch(0.875 0.055 245)"
  tab-unscheduled: "oklch(0.895 0.065 92)"
  tab-delivered: "oklch(0.885 0.045 160)"
  rule-red: "oklch(0.6 0.19 25)"
  ground: "oklch(0.953 0.012 155)"
  surface: "oklch(0.992 0.004 110)"
  surface-2: "oklch(0.972 0.008 150)"
  line: "oklch(0.87 0.014 160)"
  line-strong: "oklch(0.6 0.02 160)"
  ink: "oklch(0.25 0.022 165)"
  ink-2: "oklch(0.43 0.022 165)"
  danger: "oklch(0.48 0.18 27)"
  danger-strong: "oklch(0.41 0.17 27)"
  danger-tint: "oklch(0.955 0.025 25)"
  danger-line: "oklch(0.82 0.08 25)"
  warn-ink: "oklch(0.42 0.1 60)"
  warn-tint: "oklch(0.955 0.045 85)"
  warn-line: "oklch(0.82 0.09 80)"
  ok-ink: "oklch(0.39 0.085 160)"
  ok-tint: "oklch(0.95 0.035 160)"
  ok-line: "oklch(0.82 0.06 160)"
typography:
  headline:
    fontFamily: "Libre Franklin, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Libre Franklin, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Libre Franklin, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Libre Franklin, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.3
  meta:
    fontFamily: "Libre Franklin, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  call-number:
    fontFamily: "Courier Prime, 'Courier New', ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  call-number-lg:
    fontFamily: "Courier Prime, 'Courier New', ui-monospace, monospace"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  typed:
    fontFamily: "Courier Prime, 'Courier New', ui-monospace, monospace"
    fontSize: "1.0625em"
    fontWeight: 400
    lineHeight: 1
rounded:
  radius: "6px"
  radius-lg: "10px"
spacing:
  s1: "0.25rem"
  s2: "0.5rem"
  s3: "0.75rem"
  s4: "1rem"
  s5: "1.5rem"
  s6: "2rem"
  s7: "3rem"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  button-hover:
    backgroundColor: "{colors.surface-2}"
  button-active:
    backgroundColor: "{colors.line}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "oklch(0.99 0.005 262)"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "oklch(0.99 0.005 27)"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  button-danger-hover:
    backgroundColor: "{colors.danger-strong}"
  button-danger-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  button-danger-quiet-hover:
    backgroundColor: "{colors.danger-tint}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.radius}"
    padding: "0 0.5rem"
    height: "2.375rem"
  button-quiet-hover:
    backgroundColor: "{colors.accent-tint}"
  button-shell:
    backgroundColor: "transparent"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  button-shell-hover:
    backgroundColor: "{colors.shell-2}"
  button-shell-primary:
    backgroundColor: "{colors.shell-ink}"
    textColor: "{colors.shell}"
    rounded: "{rounded.radius}"
    padding: "0 1rem"
    height: "2.375rem"
  guide-tab:
    backgroundColor: "{colors.tab-scheduled}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "8px 8px 0 0"
    padding: "0.3rem 0.75rem 0.25rem"
  catalogue-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "0.75rem 0.75rem 0.75rem 1rem"
  catalogue-row-hover:
    backgroundColor: "{colors.surface-2}"
  catalogue-row-current:
    backgroundColor: "{colors.accent-tint}"
  record-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-lg}"
    padding: "1.5rem"
  input:
    backgroundColor: "oklch(1 0 0)"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "0.4rem 0.65rem"
    height: "2.375rem"
  day-chip:
    backgroundColor: "oklch(1 0 0)"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "0 0.75rem"
    height: "2.375rem"
  day-chip-checked:
    backgroundColor: "{colors.accent-tint}"
  banner-error:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-strong}"
    rounded: "{rounded.radius}"
    padding: "0.75rem 1rem"
  banner-warn:
    backgroundColor: "{colors.warn-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "0.75rem 1rem"
  banner-ok:
    backgroundColor: "{colors.ok-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "0.75rem 1rem"
---

# Design System: Reminders

Recorded from the shipped build (`app/globals.css`, `app/layout.tsx`, `app/ui/*`) after the first implementation. Where this file and the code disagree, the code is the evidence and this file is out of date.

Three things here are assumptions, not confirmed decisions:

- **Assumption:** light theme only. The stylesheet declares `color-scheme: light` and has no dark values. Nobody asked for a dark theme and nobody ruled one out.
- **Assumption:** desk use in ordinary room light, on a monitor beside an editor, sometimes in a narrow snapped window.
- **Assumption:** the direction itself. The build round was unattended; no user was reachable to pick or confirm the card-catalogue world. It is open to a re-roll.

## Overview

**Creative North Star: "The Card Catalogue"**

A reminder is a card filed under a call number. The screen is a library card catalogue that can be read in one pass: every row leads with its stable ID in a typewriter face, and groups of rows sit behind coloured guide tabs, the way guide cards stand up in a drawer. The catalogue lends its type, palette, density and that one signature. Nothing else is borrowed: no paper texture, no drawer handles, no skeuomorphic props.

It is a working screen for one person. Density is moderate, text wraps instead of truncating, and every control is a standard web control. The dark green bar at the top is the cabinet; everything below is pale card stock on a pale sage ground. Colour carries meaning in four places only: blue for actions and selection, the four tab tints for the four groups, one red rule under a record's call number, and the red, amber and green of messages.

**Key Characteristics:**
- A typed call-number column leads every row and heads every record card.
- Four tinted guide tabs name the four groups: Needs your attention, Scheduled, Not scheduled, Delivered.
- A dark green shell bar over a pale sage ground with near-white card surfaces.
- One blue for every action and for the selected row.
- Status is always a mark plus a word, never colour alone.
- Hairline borders (1px) throughout; one soft shadow, used only on the open card.
- Two panes on a wide window, one pane at a time on a narrow one. On a wide window the open card stays beside the list and scrolls by itself when it is longer than the window.
- A message is on screen only while it is true: it goes when the record or the entries it describes change.

## Colors

A cool, low-chroma green-grey world with one saturated blue; all values are OKLCH custom properties on `:root`, and the frontmatter carries the same values.

### Primary
- **Stamp-pad Blue** (`accent`, oklch(0.44 0.13 262)): primary buttons, focus rings, the caret, native control accent, and the border of a checked weekday.
- **Stamp-pad Blue, pressed** (`accent-strong`, oklch(0.37 0.13 262)): hover state of primary buttons, text of quiet link-buttons, the "Scheduled" status word, and the call number and chevron of the selected row.
- **Blue Wash** (`accent-tint`, oklch(0.935 0.035 262)): the selected row, the "Stop sending" confirmation, checked weekdays, text selection.
- **Blue Hairline** (`accent-line`, oklch(0.8 0.07 262)): the underline of quiet buttons and the border of the blue confirmation box.

### Secondary
- **Cabinet Green** (`shell`, oklch(0.31 0.055 165)): the header bar, and the text of the primary button that sits on it.
- **Cabinet Green, raised** (`shell-2`, oklch(0.38 0.055 165)): the bar's bottom edge and the hover fill of buttons on the bar.
- **Shell Ink** (`shell-ink`, oklch(0.97 0.012 150)): the product name, button text and focus ring on the bar; the fill of the bar's primary button.
- **Shell Ink, quiet** (`shell-ink-2`, oklch(0.87 0.03 155)): the freshness line and the outline of the bar's secondary button.

### Tertiary
- **Guide Salmon** (`tab-attention`, oklch(0.87 0.075 35)): the tab of "Needs your attention".
- **Guide Blue** (`tab-scheduled`, oklch(0.875 0.055 245)): the tab of "Scheduled".
- **Guide Buff** (`tab-unscheduled`, oklch(0.895 0.065 92)): the tab of "Not scheduled", and the "Test data" flag in the header.
- **Guide Green** (`tab-delivered`, oklch(0.885 0.045 160)): the tab of "Delivered".
- **Index Red** (`rule-red`, oklch(0.6 0.19 25)): the 2px rule under the head of a record card or a form. Nothing else.

### Neutral
- **Sage Ground** (`ground`, oklch(0.953 0.012 155)): the page.
- **Card Stock** (`surface`, oklch(0.992 0.004 110)): rows, cards, default buttons.
- **Card Stock, shaded** (`surface-2`, oklch(0.972 0.008 150)): row and button hover, the schedule preview box.
- **Hairline** (`line`, oklch(0.87 0.014 160)): dividers between rows, the footer rule, pressed default buttons.
- **Edge** (`line-strong`, oklch(0.6 0.02 160)): the outline of cards, row groups, tabs, default buttons, fields and weekday chips; the resting chevron; the scrollbar thumb. It is the boundary of every outlined control, so it is held to WCAG's 3:1 for non-text contrast against everything it touches: it measures at least 3:1 on Sage Ground, Card Stock, white, and the tinted confirmation and banner fills. It was oklch(0.72 0.02 160), about 2.4:1, until the first review; do not lighten it again.
- **Ink** (`ink`, oklch(0.25 0.022 165)): all primary text.
- **Ink, quiet** (`ink-2`, oklch(0.43 0.022 165)): call numbers at rest, meta lines, hints, labels of facts, tab counts, hovered field borders. It measures 5.2:1 or better on every surface and tab tint it sits on.

### Messages
- **Danger** (`danger`, `danger-strong`, `danger-tint`, `danger-line`): refused values, the "Delivery uncertain" status, the Remove action and its confirmation.
- **Warning** (`warn-ink`, `warn-tint`, `warn-line`): notices that need a second look, such as a record changed elsewhere or unsaved entries.
- **Confirmation** (`ok-ink`, `ok-tint`, `ok-line`): saved, created, removed; the "Delivered" status word.

### Named Rules
**The Mark And Word Rule.** A status is an icon plus a word in a status colour. Colour never stands alone, and a tab tint never stands alone either: the tab always carries the group's name and count.

**The Tint Is A Label Rule.** The four guide tints are backgrounds for short labels set in Ink (the tabs, the test-data flag). They are not text colours, not row fills and not borders.

**The One Red Rule.** Index Red draws the rule under a card head and nothing else. Errors and destructive actions use the Danger family, which is a different, darker red.

## Typography

**Display Font:** none. There is no display tier; the largest type on the screen is a typed call number.
**Body Font:** Libre Franklin (with 'Segoe UI', system-ui, sans-serif), loaded as a variable font through `next/font` and served locally.
**Label/Mono Font:** Courier Prime (with 'Courier New', ui-monospace, monospace), weights 400 and 700.

**Character:** One sturdy sans does all the reading and all the controls. The typewriter face is the stamp on the card: it marks the things that are exact and must be copied character for character.

### Hierarchy
- **Call number, large** (Courier Prime 700, 1.625rem, line-height 1.25): the heading of an open record, over the red rule.
- **Headline** (700, 1.375rem, line-height 1.2 to 1.25, letter-spacing -0.01em): the product name in the bar; headings of forms and of the explanatory card.
- **Lead** (400, 1.125rem, line-height 1.5, at most 65ch): the full reminder text in an open record; the empty-state heading uses the same size in bold.
- **Body** (400, 1rem, line-height 1.5, tabular figures): default text. Row text is the same size at weight 550.
- **Call number** (Courier Prime 400, 1rem; 700 and Stamp-pad Blue when its row is selected; 0.875rem on narrow windows): the leading column of every row.
- **Label** (650, 0.875rem, line-height 1.3): tabs, field labels, status words, emphasised due times. Buttons use 600 at the same size. Facts, banners and field errors are set at this size in regular or 600.
- **Meta** (400, 0.8125rem): the lines under a row's text, hints, the footer.
- **Typed inline** (Courier Prime 400, 1.0625em of the text around it; line-height 1 inside a sentence, the surrounding 1.5 when it is a whole fact): an ID or a UTC instant inside a sentence or a fact.

### Named Rules
**The Typed Means Exact Rule.** Courier Prime is for reminder IDs and exact UTC instants. Nothing else is typed: not headings, not labels, not local times, not button text.

**The Next-Due Rule.** In a row's meta lines the due date and time is the only thing set in Ink at weight 600; timezone, relative time and recurrence stay in quiet ink around it.

## Layout

The page is a column: shell bar, optional page banner, workspace, footer. Bar, workspace and footer share one measure (max-width 78rem, centred, 1.5rem side padding).

The workspace is a two-column grid at 11fr to 10fr with a 2rem gap, so the list takes a little over half. The list pane scrolls with the page; the panel pane is sticky 1.5rem below the top. The grid has two rows, `auto` for the result notice and `1fr` for the list, and the panel spans both: a card taller than the list adds its height to the list's row only, so the list always starts directly under the notice row, level with the top of the card while there is no notice. Prose is capped (60 to 75ch) rather than stretched.

The panel pane is never taller than the part of the window the workspace occupies: the window less a 1.5rem margin above and below, less the header while the top of the page is in view, less the footer at its end (`--pane-room`, measured as the page scrolls; never under 160px). A card that fits is wholly on screen at every scroll position. A longer one (a 2000-character reminder, a weekly form in a short window) scrolls inside the pane with `overflow-y: auto`, so its last buttons are reached from any place in a long list without moving the list. Scrolling chains as the browser does it; `overscroll-behavior: contain` is not used, because with it the wheel over a card that fits would not scroll the list. The pane carries 0.75rem of side padding (taken back by a negative margin) and 1rem below, so the card's shadow and its 8px rise are not cut off by the scrolling box. Moving focus into the pane (a heading, the first refused field, the unsaved-entries prompt) scrolls the pane, not the list.

Spacing is a 4px step with seven named stops (0.25rem to 3rem). Groups are separated by 2rem; rows and cards use 0.75rem to 1.5rem of internal padding. Controls are 2.375rem tall.

Below 860px the workspace becomes one pane at a time: the list while nothing is open, the panel once a record or form is open, with an "All reminders" back button at the top of the card. The card scrolls with the page there and has no scroll of its own. The result notice of the last change is not part of either pane: it is its own row above them (above the list on a wide window, above whichever pane is shown on a narrow one), and a new notice is scrolled into view. Controls grow to 2.75rem, side padding drops to 1rem, the call number moves to its own line above the row text, and fact labels stack over their values. Below 420px, paired fields stack, the weekday chips form two columns, and the second half of the freshness line is dropped.

## Elevation & Depth

Flat by default. The list is drawn with outlines and hairline dividers only. Depth is conveyed by tone: dark bar, pale ground, near-white cards.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px oklch(0.25 0.02 165 / 0.06), 0 6px 18px -8px oklch(0.25 0.02 165 / 0.18)`): the open card in the panel pane, and the unsaved-entries prompt that appears above it. It says "this is the card you pulled out of the drawer".

### Named Rules
**The Pulled Card Rule.** Only what sits in the panel pane is lifted. The catalogue itself never casts a shadow. A card entering the panel rises 8px over 220ms on `cubic-bezier(0.16, 1, 0.3, 1)`; it does not fade.

## Shapes

Gently rounded rectangles with hairline outlines. Controls, row groups, banners and chips use a 6px radius; the open card uses 10px. Guide tabs are rounded on top only (8px 8px 0 0, a literal value, not a token) and have no bottom border: each tab is inset 0.75rem from the left edge of its group and overlaps the group's top edge by 1px so it reads as standing on it.

Borders are 1px everywhere. The exceptions are the 2px red rule under a card head, the 2px focus ring, and the dashed 1px outline of the schedule preview, which marks a value that is computed and not yet saved.

Icons are one small drawn set: 16px grid, 1.5px round strokes, in the current text colour, always beside a word.

## Components

### Buttons
Plain, rectangular, the same height as fields.
- **Shape:** 6px radius, 1px border, 2.375rem minimum height (2.75rem below 860px), 0 1rem padding, 0.875rem at weight 600, optional 16px icon before the label with a 0.5rem gap.
- **Default:** Card Stock fill, Edge border, Ink text. Hover: shaded fill, quiet-ink border. Pressed: Hairline fill.
- **Primary:** Stamp-pad Blue fill with near-white text; hover and pressed go darker. One per group of actions (Edit, Save reminder, Keep editing).
- **Danger:** solid Danger fill, used only inside the Remove confirmation.
- **Danger, quiet:** Card Stock fill, Danger text and a Danger border (the text colour, so the boundary keeps 3:1; Danger Hairline is for message boxes, not controls); hover fills with the danger tint. This is the Remove button at rest. It sits alone at the far end of the action row, apart from Edit and Stop sending.
- **Quiet:** no fill or border, underlined pressed-blue text, 0 0.5rem padding; hover fills with Blue Wash. Used for Dismiss, Change, the back button.
- **On the shell:** an outlined button (quiet shell-ink border, transparent fill, raised green on hover) and a primary one (Shell Ink fill, Cabinet Green text, white on hover).
- **States:** colour transitions take 150ms on the ease-out curve. A busy button keeps its place, shows `cursor: progress` at 0.7 opacity and changes its word ("Saving…"); Refresh spins its icon (700ms, linear). Focus is a 2px Stamp-pad Blue outline offset by 2px; on the bar the outline is Shell Ink.

### Guide Tabs And Catalogue Rows (signature)
- **Tab:** a group's heading. Tint fill from the group, Edge border on three sides, label type in Ink, the count after it in quiet ink at weight 500.
- **Row group:** one outlined Card Stock block (6px radius) per group; rows are divided by Hairline.
- **Row:** a link with three columns: call number (4.75rem), text and meta, chevron. Text shows at most three lines. Meta lines hold the due time, timezone, relative time, status mark and recurrence. Hover shades the row and turns the chevron blue.
- **Selected row:** Blue Wash fill, call number in bold pressed blue, blue chevron.
- **Order of groups:** Needs your attention, Scheduled, Not scheduled, Delivered. Empty groups are not drawn.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Card Stock, Edge outline.
- **Shadow Strategy:** the Card shadow; see Elevation & Depth.
- **Internal Padding:** 1.5rem (1rem below 860px), 1rem between blocks.
- **Card head:** on a record, the large call number on the left and the status mark on the right, over the red rule. On a form, the heading ("New reminder", or "Edit" followed by the typed call number) over the same rule. The explanatory and not-found cards have a plain headline and no rule.
- **Facts:** a definition list at 0.875rem with a 9.5rem label column in quiet ink; values wrap anywhere and stop at 60ch.
- **Confirmation box:** replaces the action row inside the card. Blue Wash with a Blue Hairline for "Stop sending", danger tint with a Danger Hairline for "Remove". The confirming button comes first and takes focus. When the box closes, focus returns to the button that opened it; after a completed "Stop sending" (that button is gone) it goes to the record's heading. Dismissing the result notice moves focus to the open reminder's row, or the open card's heading when a narrow window hides the list, or the first row, or "New reminder". A refused Stop or Remove is explained directly above the action row, where focus returns; the explanation goes when Stop or Remove is pressed again. A "Stop sending" question that is open when a reread shows the schedule is already gone (stopped in chat, or the one-off was delivered) closes, and the record's heading takes focus. Focus is never left on the page body.
- **Unsaved-entries prompt:** a warning banner above the form with "Keep editing" (primary, takes focus) and "Discard entries". "Keep editing" returns focus to the control that opened the prompt (Cancel, a row, "New reminder"), or to the form heading if that control is gone. The prompt goes by itself once the form has no unsaved entries left (they were put back, or the latest values were loaded).
- **Controls that remove themselves:** whatever takes away the focused control names its successor. "Use this browser's timezone" hands focus to the timezone field; Cancel and Save in the default-timezone form hand it back to "Change"; a failure banner that clears while its "Try now" is focused hands it to Refresh.
- **Empty state:** an outlined Card Stock block (6px radius, no shadow, at most 34rem wide) with a short heading, two sentences and a primary button.

### Inputs / Fields
- **Style:** white fill, 1px Edge border, 6px radius, 2.375rem minimum height, 0.4rem 0.65rem padding. Label above at label size; hint below at meta size in quiet ink. Textareas start at 5.5rem and resize vertically.
- **Dates and times:** plain text fields that take what the page shows everywhere else, `YYYY-MM-DD` and 24-hour `HH:MM`, with that format and an example as the hint. The browser's own date and time controls are not used: they display the browser's locale (`03/04/2027`, `02:30 PM`), which contradicts the rest of the page. Leaving a field pads an unambiguous short entry (`9:05` to `09:05`); nothing is ever reordered or guessed.
- **Hover / Focus:** hover darkens the border to quiet ink; focus draws the 2px blue outline flush with the edge and turns the border blue.
- **Error:** Danger border doubled by a 1px inset ring, and a sentence in Danger at weight 600, inside the field's own block directly under its hint, that says what was wrong and that nothing was saved. Paired fields each carry their own message, so it stays with its field when the pair stacks. A summary banner at the top of the form counts the values still to correct: the count follows the corrections and the banner goes with the last one. Choosing another kind of schedule drops the messages of the fields it hides. A refusal that belongs to no field (changed elsewhere, nothing to save) uses the same banner and is scrolled into view, because the user is at Save, at the bottom of the form; it describes the entries as they were sent, so it goes at the next change to them.
- **Weekday chips:** bordered labels wrapping a native checkbox; checked turns the chip Blue Wash with a blue border and heavier text.
- **Schedule preview:** a dashed, shaded box that states the first send time, or why the schedule cannot be saved yet.

### Banners
A 1px outlined, 6px rounded strip at 0.875rem with the message on the left and its action on the right; it wraps on narrow widths. Error: danger tint with dark danger text. Warning and confirmation: their tint and line with Ink text. Used for a failed reread, for the result of the last change, for records changed or removed elsewhere, and for unsaved entries.

- **Failed reread:** the one banner that is held on screen. It is sticky 0.5rem below the top of the window at every width, above the list and the card, because the values under it may be out of date wherever the page is scrolled to. While it is shown, the panel pane starts below it and is that much shorter, and anything scrolled to (by keyboard focus too) lands below it (`--stuck`, `scroll-padding-top`). It has no shadow. It goes with the next reread that works.
- **Result notice:** speaks in the present tense about one record ("R-0015 is saved. Next due ..."). It is cleared when that record's Edit form opens, when another row or "New reminder" is opened, and as soon as a reread shows the record changed (a newer revision, or a different due time or schedule, from chat, another window or the checker) or removed. If its Dismiss button held keyboard focus at that moment, focus is handed on as Dismiss does. A notice about a removal describes no saved record and stays until dismissed.

### Status Mark
An icon and a word at weight 650. Scheduled, waiting and sending are pressed blue with a clock or an arrow; delivered is confirmation green with a check; not scheduled is quiet ink with a note; delivery uncertain is Danger with a warning triangle.

### Navigation
There is no navigation: it is one screen. The header bar holds the product name, the freshness line and two actions. Opening a row puts its ID in the address (`?r=R-NNNN`).

## Do's and Don'ts

### Do:
- **Do** lead every row and every record card with the reminder's ID in Courier Prime.
- **Do** give every new group a guide tab with its name and count, and give every status an icon and a word.
- **Do** keep one primary button per group of actions, in Stamp-pad Blue (or Shell Ink on the bar).
- **Do** set the destructive action apart from its neighbours and confirm it inside the card, not in a dialog.
- **Do** write every due time with its timezone, and let long text wrap; rows clamp at three lines, details show everything.
- **Do** take colours, sizes, radii and spacing from the custom properties on `:root`.
- **Do** keep motion to colour transitions (150ms) and the 8px card rise (220ms), and remove both under `prefers-reduced-motion`.

### Don't:
- **Don't** use Courier Prime for anything except reminder IDs and exact UTC instants.
- **Don't** use the guide tints as text colours, row fills or borders, and don't add a fifth tint without a fifth group.
- **Don't** use Index Red for errors or actions, and don't draw the red rule anywhere but under a card head.
- **Don't** put a shadow on the list, the bar, banners or buttons.
- **Don't** let a card grow past the window beside a long list, and don't leave a message on screen once the record or the entries it describes have changed.
- **Don't** signal a state by colour alone.
- **Don't** add textures, drawer handles or other props of a physical catalogue; the world is lent as type, palette, density and one signature.
- **Don't** give a control a boundary lighter than Edge. The hairline tokens (`line`, `accent-line`, `danger-line`, `warn-line`, `ok-line`) are for dividers and message boxes; a field, select, chip or outlined button needs 3:1 against its fill and its surroundings, and `npm run test:e2e` measures it.
- **Don't** use the browser's date or time controls, and don't show a date or time in any form but `YYYY-MM-DD` and 24-hour `HH:MM`.
