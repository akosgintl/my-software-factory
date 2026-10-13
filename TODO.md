# TODO

Factory queue. Operating rules: [FACTORY.md](FACTORY.md). Write only under the queue-write protocol there.

Entry format — the indented block is the complete worker brief and travels with its entry:

    - [ ] T-<id>: <title>
        Brief: <everything a fresh worker needs; absolute paths>
        Checks: <how the controller verifies completion>

## Queue

- [ ] T-002: Add Scheduled and Recurring Reminders
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
