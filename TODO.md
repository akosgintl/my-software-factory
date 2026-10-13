# TODO

Factory queue. Operating rules: [FACTORY.md](FACTORY.md). Write only under the queue-write protocol there.

Entry format — the indented block is the complete worker brief and travels with its entry:

    - [ ] T-<id>: <title>
        Brief: <everything a fresh worker needs; absolute paths>
        Checks: <how the controller verifies completion>

## Queue

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
