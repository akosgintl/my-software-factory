#!/usr/bin/env bash
# Controls for the Reminders browser app:  bash app.sh status | build | run | start | stop | restart
# (see scripts/app-control.mjs). Node.js is found even when it is not on the PATH of this shell.
set -u
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$(command -v node 2>/dev/null || true)"
[ -n "$NODE" ] || NODE="/c/Program Files/nodejs/node.exe"
[ -x "$NODE" ] || { echo "ERROR: Node.js was not found (looked on PATH and in C:\\Program Files\\nodejs)." >&2; exit 1; }
cd "$SELF_DIR" || exit 1
exec "$NODE" scripts/app-control.mjs "$@"
