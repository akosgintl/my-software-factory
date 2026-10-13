#!/usr/bin/env bash
# Chat and checker command of the reminder service. Rules: reminders-guide.md.
#
#   bash reminders.sh list | add "<text>" [SCHEDULE] | modify <ID> "<text>" | schedule <ID> SCHEDULE
#                     | unschedule <ID> | remove <ID> | resolve SCHEDULE | now [--tz <Zone>] | tz [<Zone>]
#                     | due [--run <handle>] | ack <ID> <occurrence> | retry <ID> <occurrence>
#                     | status | backup | recover
#
# This file only finds Node.js and hands over to reminders-cli.mjs, which calls the shared operations
# in lib/reminders/ops.mjs against the one SQLite database (lib/reminders/paths.mjs). The browser app
# uses the same operations and the same database. Nothing here reads or writes a Markdown store.
#
# Exit codes: 0 ok, 1 bad input or unusable database, 2 no such ID, 3 database busy,
#             4 ack/retry refused (that occurrence is not pending; nothing changed), 5 edit conflict.
set -u
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NODE="$(command -v node 2>/dev/null || true)"
[ -n "$NODE" ] || NODE="/c/Program Files/nodejs/node.exe"
[ -x "$NODE" ] || { echo "ERROR: Node.js was not found (looked on PATH and in C:\\Program Files\\nodejs). Nothing was changed." >&2; exit 1; }

CLI="$SELF_DIR/reminders-cli.mjs"
if command -v cygpath >/dev/null 2>&1; then
  CLI="$(cygpath -w "$CLI")"
  # Git Bash rewrites arguments that look like POSIX paths when it starts a Windows program; a
  # reminder text such as "/standup notes" must reach Node.js unchanged.
  export MSYS_NO_PATHCONV=1
  export MSYS2_ARG_CONV_EXCL='*'
fi
exec "$NODE" "$CLI" "$@"
