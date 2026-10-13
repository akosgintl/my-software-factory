# TODO

Factory queue. Operating rules: [FACTORY.md](FACTORY.md). Write only under the queue-write protocol there.

Entry format — the indented block is the complete worker brief and travels with its entry:

    - [ ] T-<id>: <title>
        Brief: <everything a fresh worker needs; absolute paths>
        Checks: <how the controller verifies completion>

## Queue

- [ ] T-003: Build the Reminders Web App
    Project path: C:\_Work\my-software-factory

    Convert my chat reminders service into a Next.js web app with one writable SQLite database. Preserve chat operations and the existing native factory reminder checker. Make the app reachable in my browser and return the candidate to the controller for review and completion.

    ## Project and Worker Responsibilities

    Require a working chat service and native reminder checker, saved stack/design instructions, project-local Impeccable and a fresh review/repair gate. Read AGENTS.md (or CLAUDE.md for Claude), FACTORY.md, REVIEW.md, reminders-brief.md, reminders-guide.md and installed skill on the project's execution host. Use the selected instruction file consistently. Report missing prerequisites to the controller. Load the assigned queue and completion rules from FACTORY.md; read TODO.md only while it is active.

    You are the fresh implementation worker assigned this complete saved brief. Implement it and return to the controller; never enqueue it again or create another dispatcher/checker. Factory and reminder-agent scheduling must use the harness's native automation functionality. Request required automation updates or pause/resume actions from the parent/controller through its supported route; those controls remain controller-owned.

    On first application, REMINDERS.md is live and this task creates the first web app/database. On a retry, inspect the recorded migration stage and current live store before reading or importing records.

    ## Preserve the Service

    Inspect current chat add/list/modify/remove operations, records, recurrence/timezone rules and the due-reminder loop. Identify its user-visible reminder conversation. Preserve IDs, text, status, due times, recurrence definitions, next occurrences, timezone and delivery destination, including completed/cancelled records.

    Save browser-app-brief.md, link it from the project instruction file and update reminders-brief.md to describe the extension and verified storage change. Keep this version personal on its current host; accounts, public deployment and app-owned reminder processing are outside this assignment.

    ## Migrate to One Database

    Use the instructed Node.js/Next.js stack and SQLite. Follow documentation for installed versions: https://nextjs.org/docs/app/getting-started/installation and https://nextjs.org/docs/app/guides/self-hosting. Preserve the selected instruction filename and other files when scaffolding; consolidate generated framework guidance.

    Put the database on durable writable host storage, outside build output. Every reader/writer must use the same recorded path; do not use copied databases or writable Markdown mirrors.

    For a live Markdown store:

    1. Back it up and inspect the records to preserve. Coordinate a short pause of all writes; the controller owns any native reminder-automation pause.
    2. Import records without changing IDs or schedule meaning. Verify values against the source and make the import safe to retry without duplicates.
    3. Switch chat, browser and the existing reminder checker together. Have the controller update the actual native checker configuration to use shared database operations, preserving its schedule, overlap protection, destination and enabled/paused state.
    4. Record the migration stage, verified live database path and recovery route in reminders-guide.md and FACTORY.md before resuming writes/checking. Keep the old file as a labelled historical backup and remove it from active read/write guidance.

    On an incomplete migration, reconcile its recorded stage while preserving every confirmed write. After a completed switch, continue from live SQLite; never reimport a historical backup over newer edits or deletions, or require the old REMINDERS.md filename to exist.

    Provide shared validated create, list/read, modify, remove/cancel, due-eligibility and delivery-state operations. Chat, browser and the native checker use these operations. Preserve existing cancellation and recurrence rules. Use SQLite transactions and appropriate concurrency controls, re-reading records before conflicting updates; prevent lost edits and overlapping delivery attempts. Preserve uncertain-send handling rather than promising exactly-once delivery across SQLite and chat. Consult https://www.sqlite.org/isolation.html.

    Keep due checking and chat delivery in the one existing native agent automation. Shared data operations do not introduce a second scheduler in the app. Database locking and the application server are ordinary application code.

    ## Build a Current, Usable Interface

    Read Impeccable's installed entry point and relevant procedures. Save product/design context from this brief, preserving existing direction.

    Provide scanning, creation, details, modification and removal/cancellation, including unscheduled reminders if supported. Show status, due date/time, named timezone and recurrence, with the stable ID in details. Use labelled controls, keyboard access, wrapping for long text and a usable narrow layout. Explain invalid/ambiguous values and preserve entered text during correction. Confirm changes from committed records; removal/cancellation must also affect delivery eligibility.

    Read fresh database values on opening, after mutations and on refresh. While open, update chat/checker changes through an appropriate update mechanism or short documented polling interval; refresh on focus and provide manual refresh. Avoid server/browser caching that freezes changing records. Show refresh failures and describe any update delay without claiming instant consistency. Preserve unrelated in-progress form edits during refresh. See https://nextjs.org/docs/app/getting-started/fetching-data.

    ## Keep the Application Available

    Build and run the app on its actual host through a supported parent-owned process, preview service or supervisor. This is application runtime, separate from native agent scheduling. Provide status, restart and stop controls. Transfer a worker-owned process through the supported handoff route or have the controller start it, since a delegated worker's process may end on return.

    Provide and test an address reachable from my browser, using a supported private preview/forwarding route for a remote host. My browser's localhost is not a remote machine. Preserve unrelated services and state which host/processes must remain available.

    ## Check and Hand Over

    Use clearly labelled synthetic reminders with tracked IDs. Save/run relevant automated checks against isolated data, then exercise real browser/chat/checker routes:

    1. Compare migrated IDs, values and schedules with the source, including pending, recurring and completed/cancelled records where present.
    2. Create through chat and read the same ID/values in the browser within the documented interval. Modify through the browser and read fresh values through chat. Repeat with a browser-created record and chat modification/removal.
    3. Keep the page open while chat and the checker change records. Confirm fresh display values without losing an in-progress form edit.
    4. Check invalid input, retained text, long text, keyboard use and desktop/narrow layouts. Invalid records must not save.
    5. Let the existing native checker process one near-term active reminder, one cancelled before sending and one recurring sample. Observe the active message in its identified conversation, cancelled ineligibility and the correct next recurring occurrence. Close the browser for a due check. Distinguish simulated delivery from actual chat receipt; logs do not establish receipt.
    6. Restart through the documented app control and read the same saved records through browser and chat.

    Include guide/instruction changes in the candidate: canonical database path, chat operations, browser address, refresh interval, migration recovery, native checker configuration and app/factory/checker controls. Remove stale Markdown requirements that could restore a second store. Clean only synthetic records and temporary resources, preserving user data, migration backup and the working app.

    Return the candidate, observed checks, application map and server/control handoff to the controller. It retains the assignment and active run, verifies the server after your terminal return, and launches a fresh REVIEW.md reviewer for code and rendered design. It sends findings for repair and requests new fresh reviews until none remain. Missing required checks leave the assignment unfinished; your handoff alone is not completion.

    Return progress and blocker observations to the controller. It reports through the native user-facing route saved in FACTORY.md, with the task reference, and reports completion only after the gates pass. Include what was written, run, reviewed or observed, actual messages received and remaining limitations. The controller applies the saved queue-completion rules. Leave the app and existing native automations available.

- [x] T-001: Create a Chat Reminder Service
    Project path: C:\_Work\my-software-factory

    Create a chat reminder service backed by REMINDERS.md. I must be able to add, list, modify and remove reminders in ordinary chat, including in fresh project conversations. This assignment stores text only: do not add scheduling, a browser app or a database.

    ## Project and Role

    Use the selected factory project and resolve its absolute path on the execution host. Read FACTORY.md and its current queue/completion rules; read TODO.md only if it is the active queue. Require the recorded working dispatcher. On a retry, preserve existing reminder files, IDs, records and unfinished work.

    You are the already assigned implementation worker. Carry out this brief and return the files, checks and operating controls to the controller. Do not enqueue it again or create a dispatcher. Every fresh context explicitly loads FACTORY.md and the assigned brief; preserve unrelated settings and automations.

    The controller retains ownership until all checks finish. If a fresh-conversation check needs parent-only tools, return the prepared service and starting request below; the controller performs that check after your terminal handoff. Creating files alone does not complete the task.

    ## Save Instructions and Records

    Create REMINDERS.md with an empty list and a small record format; preserve saved records on a retry. Each reminder has a stable unique ID and its text. Editing or deleting another record must not change an ID, and deleted IDs must not be reused so an old request targets a different reminder.

    Save the agreed behaviour in reminders-brief.md and the operating instructions in reminders-guide.md. Link both from FACTORY.md. The guide names the canonical REMINDERS.md path and requires every service conversation to reread the guide and current records before answering or writing. Cached conversation history is not the store. Use plain project files and explicit loading; do not create or require a separate engine instruction file.

    Save the routing distinction in FACTORY.md: building/changing the service goes through its active development queue; ordinary reminder use follows reminders-guide.md directly. Fresh service conversations receive the absolute project path and this starting request: "Read FACTORY.md and reminders-guide.md in this project, then list my reminders."

    ## Chat Behaviour and Shared Writes

    - Add saves the requested text and returns its ID and text.
    - List rereads the file and shows current IDs/texts or clearly states that it is empty.
    - Modify identifies the record, preserves its ID and saves the requested text change.
    - Remove deletes only the identified record and confirms its absence.

    Accept ordinary language or an ID. Ask when the target or requested change is ambiguous; never rewrite several records to guess a target. If asked for timed delivery, explain that this service stores text only and does not schedule a message.

    Use one simple shared write lock or supported single-writer mechanism. Acquire it, reread the latest records, change only the intended record and replace the file atomically where supported. Atomic replacement alone does not prevent lost updates. Release protection on success/failure and define recovery from an interrupted writer. All reminder writers must follow this protocol.

    ## Check and Hand Over

    Use uniquely labelled disposable records and preserve real reminders:
    1. Add two through chat; independently verify their saved IDs/texts.
    2. List them, modify one by ID and verify its new text, unchanged ID and unchanged neighbour.
    3. In a fresh conversation without inherited history, use the starting request to list and modify that saved disposable reminder. Verify it reads the canonical files and persists the change.
    4. Make a small isolated check that concurrent writes cannot lose another record's update.
    5. Remove the disposable reminders through chat and confirm real records are unchanged.

    Bound the checks and clean up only their records/files. Keep the factory running; do not add a scheduler for testing. Return changed paths, observed checks and blockers. The controller inspects completion through FACTORY.md's saved queue rules.

    The final handover names the canonical store and instruction paths, gives short examples of all four operations and reports fresh-conversation evidence and limitations. State clearly that this service does not send reminders automatically.

- [x] T-002: Add Scheduled and Recurring Reminders
    Project path: C:\_Work\my-software-factory

    Extend the REMINDERS.md chat service with one-off dates/times, recurring schedules and one reminder checker created through the harness's native automation functionality. Due reminders must produce readable messages in an identified user-visible chat and advance their saved state. Leave the working service, dispatcher and native checker available.

    ## Project and Role

    Use the selected factory project with a working text-only chat service. Resolve its actual execution-host path and read FACTORY.md, reminders-brief.md, reminders-guide.md and REMINDERS.md; read TODO.md only if it remains the active queue. Preserve current records and IDs. A missing dispatcher or prerequisite service leaves this assignment unfinished.

    You are the already assigned worker. Implement this brief and return changed files, observed checks and native automation controls to the controller; do not enqueue it again. The controller retains the assignment and performs parent-only scheduling/chat actions and final delivery checks after your handoff. Do not assume child workers have those tools. Fresh contexts receive the path and explicit instructions to read the guide and complete assignment.

    ## Records, Chat and Recurrence

    Extend the existing format with active/completed state, resolved next due instant, named timezone, recurrence rule and delivered/pending occurrence state. Preserve stable IDs/text and unscheduled records; an unscheduled reminder is not due. Keep REMINDERS.md as the sole writable store.

    Update the brief and guide so all four chat operations handle scheduling. Confirm the saved date, local time, timezone and recurrence. Resolve timezone from reliable user/project context or ask; never adopt the remote host's timezone silently. Resolve relative dates against the current date in that timezone and ask about ambiguous dates, times or recurrence. Delivery text includes the reminder's ID.

    Save these semantics:
    - A one-off becomes completed only after its occurrence is delivered.
    - Calendar schedules retain their local time in the named timezone. Duration schedules advance by their duration. Calculate from the saved scheduled occurrence, not the check's execution time.
    - After downtime, send one catch-up message per overdue reminder. Advance a recurring reminder to its first future occurrence rather than replaying missed ones.
    - Define/disclose handling of missing or repeated local times at clock changes; avoid immediate duplicate sends.

    Chat and checker share one write-protection protocol. Acquire protection, reread current state, preserve unrelated changes and replace atomically where supported. Before sending, recheck that the record exists, is active and still has the selected due occurrence. Edits/removals affect the next check. Serialise the delivery/update operation to prevent overlapping checks sending twice.

    ## Native Checker and Visible Delivery

    Discover the harness's native automation, lifetime, ownership and chat-delivery capabilities using its tools/current documentation. Create the checker through supported native controls; do not write timers, launchers, polling daemons or external schedules. Use native lifetime/renewal settings for continuing operation. If a required capability is missing, return the exact blocker; do not substitute a coded service.

    Keep one checker separate from the dispatcher and reuse it on a retry. Choose supported owning contexts if they must be separate. Identify and record its actual user-visible destination and how I open it; do not send to another person or unrelated channel. Each native invocation loads reminders-guide.md and the canonical REMINDERS.md from the absolute project path, checks due records, delivers and updates completion/recurrence only after delivery is evidenced. Stay quiet when nothing is due.

    A native scheduled response can be the delivery mechanism. Verify that it reaches the chosen chat; a file, log, stdout, queued event or successful run alone is insufficient. For asynchronous delivery, save the pending occurrence and native delivery/run handle, then reconcile acknowledgement before advancing it. Never resend an uncertain occurrence blindly. Release file protection before waiting for a future check, then reacquire and reread before applying the confirmed result.

    Record the native automation identity, saved checker prompt, project/store paths, destination, cadence, lifetime, status/pause/stop/restart controls and recovery in FACTORY.md. Preserve dispatcher controls and the factory's feedback route. The controller reports setup progress, blockers and completion there; due messages use the reminder destination. Keep secrets private.

    The harness owns the continuing checker after the setup worker exits. Use native parent ownership/handoff and verify the recorded owner. Explain host/backend availability, sleep/restart and recovery; do not promise punctual delivery while stopped.

    ## Check and Hand Over

    Use uniquely labelled disposable reminders and a finite window suited to the native cadence:
    1. Observe a near-due one-off's message and saved completed state in the stated chat. A later check must not resend it.
    2. Observe two short recurring deliveries. Each advances once to the correct future occurrence/timezone.
    3. Edit one future reminder and remove another; neither superseded nor removed occurrence may be sent.
    4. Check one isolated overdue record's catch-up/future advancement and a clock-change calculation without changing the machine clock or sending historical real reminders.
    5. Check overlap/write protection with isolated records. After the worker's terminal return, the controller verifies the native checker remains owned and exactly one dispatcher and checker are configured for this project.

    Failed/unverified delivery remains unresolved with its saved state. Repair and recheck within scope; never turn missing chat output into a pass. Remove only test records/messages/resources and test-only schedules; leave intended native automations running.

    Return paths, checks and limitations so the controller can complete through the saved factory rules. The handover names the destination, observed delivery, timezone/recurrence semantics, native identities, runtime conditions and inspect/pause/stop/restart controls. Explain any crash window between delivery and file update; do not promise exactly-once delivery without enforceable support.

- [x] T-TRIAL-d1sc0v: Fresh-worker discovery inspection (disposable)
    Read-only inspection. Change no files, run no installers, touch no scheduled job.

    Using only what you find by reading files on this host, starting from the guidance files you were told to read, report each of the following with the file and line or section where you found it:
    1. The project instruction file (name and absolute path) and how this harness loads it.
    2. Your current brief: its task id and where it is saved.
    3. The standing stack choice for web applications and the database choice.
    4. The live reminder store, and how it may be changed.
    5. The reminder checker: what it is, its recorded identity, cadence and destination.
    6. The Impeccable design skill: entry point path, installed version, and the loading route a worker must use.
    7. Open the skill's entry point, choose the one procedure you would read before reviewing an existing interface, read it, and quote its first heading plus one specific instruction from it.

    Checks: every answer names its source file; answers match the files; item 7 quotes real text from a file under .claude\skills\impeccable\reference\; `git status` shows no change made by you.
