#!/usr/bin/env bash
# Reader/writer for the chat reminder service. Rules: reminders-guide.md.
# Every change to REMINDERS.md goes through this script so that all writers
# share one lock:  acquire -> reread -> change one record -> atomic replace -> release.
#
#   bash reminders.sh list
#   bash reminders.sh add    "<text>"          (text "-" = read text from stdin)
#   bash reminders.sh modify <ID> "<text>"     (text "-" = read text from stdin)
#   bash reminders.sh remove <ID>
#   bash reminders.sh recover                  (after an interrupted writer)
#
# Exit codes: 0 ok, 1 bad input or malformed store, 2 no such ID, 3 lock busy.
set -u

DIR="${REMINDERS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"   # REMINDERS_DIR: isolated tests only
FILE="$DIR/REMINDERS.md"
LOCK="$DIR/.reminders.lock"
WAIT="${REMINDERS_LOCK_WAIT:-60}"   # seconds to wait for the lock
STALE_AGE=60                        # a lock with no readable owner is recoverable after this many seconds
TMP=""
HELD=0

die() { echo "ERROR: $2" >&2; exit "$1"; }

my_pid() { cat "/proc/$$/winpid" 2>/dev/null || echo "$$"; }

pid_alive() {
  if command -v tasklist >/dev/null 2>&1; then
    tasklist //FI "PID eq $1" //NH 2>/dev/null | grep -qw "$1"
  else
    kill -0 "$1" 2>/dev/null
  fi
}

owner_info() { tr '\n' ' ' < "$LOCK/owner" 2>/dev/null || echo "(owner not recorded)"; }

acquire() {
  local deadline=$(( $(date +%s) + WAIT ))
  until mkdir "$LOCK" 2>/dev/null; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      die 3 "write lock $LOCK is still held after ${WAIT}s by: $(owner_info). Nothing was changed. If that writer is gone, run: bash reminders.sh recover"
    fi
    sleep 0.2
  done
  HELD=1
  printf 'host=%s\npid=%s\nstarted=%s\nop=%s\n' "$(hostname)" "$(my_pid)" "$(date +%s)" "$1" > "$LOCK/owner"
}

release() {
  [ -n "$TMP" ] && rm -f "$TMP"
  TMP=""
  if [ "$HELD" = 1 ]; then
    rm -f "$LOCK/owner"
    rmdir "$LOCK" 2>/dev/null
    HELD=0
  fi
}
trap release EXIT
trap 'exit 130' INT TERM HUP

src() { tr -d '\r' < "$FILE"; }
records() { grep -E '^- R-[0-9]+: ' || true; }

need_store() {
  [ -f "$FILE" ] || die 1 "canonical store $FILE is missing. It is not recreated automatically; report this."
}

norm_id() {
  local d
  d=$(printf '%s' "$1" | tr -d '[:space:]' | sed -E 's/^[Rr]-?//')
  case "$d" in ''|*[!0-9]*) die 1 "'$1' is not a reminder ID (expected e.g. R-0003)";; esac
  printf 'R-%04d' "$((10#$d))"
}

get_text() {
  local raw="$1" t
  [ "$raw" = "-" ] && raw=$(cat)
  t=$(printf '%s' "$raw" | tr '\r\n\t' '   ' | sed -E 's/ +/ /g; s/^ //; s/ $//')
  [ -n "$t" ] || die 1 "reminder text is empty"
  printf '%s' "$t"
}

# commit <id> <expected record-count delta>: check that only record <id> differs, then replace atomically.
commit() {
  local id="$1" delta="$2" before after
  before=$(src | records | grep -v "^- $id: " || true)
  after=$(records < "$TMP" | grep -v "^- $id: " || true)
  [ "$before" = "$after" ] || die 1 "internal check failed: another record would change. Nothing was changed."
  [ $(( $(src | records | wc -l) + delta )) -eq "$(records < "$TMP" | wc -l)" ] \
    || die 1 "internal check failed: unexpected record count. Nothing was changed."
  mv -f "$TMP" "$FILE" || die 1 "could not replace $FILE. Nothing was changed."
  TMP=""
}

cmd_list() {
  need_store
  local out
  out=$(src | records | sed 's/^- //')
  if [ -z "$out" ]; then echo "No reminders saved."; else printf '%s\n' "$out"; fi
}

cmd_add() {
  local text ctr max n id
  text=$(get_text "$1") || exit 1
  need_store
  acquire add
  ctr=$(src | sed -nE 's/^Next ID: R-([0-9]+)$/\1/p' | head -n 1)
  [ -n "$ctr" ] || die 1 "store has no 'Next ID: R-NNNN' line; refusing to guess an ID (deleted IDs must never be reused)."
  n=$((10#$ctr))
  max=$(src | records | sed -E 's/^- R-([0-9]+): .*/\1/' | sort -n | tail -n 1)
  [ -n "$max" ] && [ $((10#$max + 1)) -gt "$n" ] && n=$((10#$max + 1))
  id=$(printf 'R-%04d' "$n")
  TMP="$FILE.tmp.$$"
  src | awk -v nid="$(printf 'R-%04d' $((n + 1)))" '/^Next ID: /{print "Next ID: " nid; next} {print}' > "$TMP"
  printf -- '- %s: %s\n' "$id" "$text" >> "$TMP"
  commit "$id" 1
  src | grep -qxF -- "- $id: $text" || die 1 "saved file does not contain the new record"
  echo "Added $id: $text"
}

cmd_modify() {
  local id text old
  id=$(norm_id "$1") || exit 1
  text=$(get_text "$2") || exit 1
  need_store
  acquire "modify $id"
  [ "$(src | grep -c "^- $id: ")" -eq 1 ] || die 2 "no reminder with ID $id. Nothing was changed."
  old=$(src | sed -n "s/^- $id: //p")
  TMP="$FILE.tmp.$$"
  src | R_TEXT="$text" awk -v p="- $id: " 'index($0, p) == 1 {print p ENVIRON["R_TEXT"]; next} {print}' > "$TMP"
  commit "$id" 0
  src | grep -qxF -- "- $id: $text" || die 1 "saved file does not contain the modified record"
  echo "Modified $id: $text"
  echo "(previous text: $old)"
}

cmd_remove() {
  local id old
  id=$(norm_id "$1") || exit 1
  need_store
  acquire "remove $id"
  [ "$(src | grep -c "^- $id: ")" -eq 1 ] || die 2 "no reminder with ID $id. Nothing was changed."
  old=$(src | sed -n "s/^- $id: //p")
  TMP="$FILE.tmp.$$"
  src | awk -v p="- $id: " 'index($0, p) == 1 {next} {print}' > "$TMP"
  commit "$id" -1
  src | grep -q "^- $id: " && die 1 "record $id is still present after removal"
  echo "Removed $id: $old"
  echo "Confirmed: $id is no longer in the store. Its ID will not be reused."
}

cmd_recover() {
  local seen host pid age moved
  if [ -d "$LOCK" ]; then
    seen=$(cat "$LOCK/owner" 2>/dev/null || true)
    host=$(printf '%s\n' "$seen" | sed -n 's/^host=//p')
    pid=$(printf '%s\n' "$seen" | sed -n 's/^pid=//p')
    age=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
    if [ -n "$pid" ]; then
      [ "$host" = "$(hostname)" ] || die 3 "lock is held from another host ($host); check that writer there. Lock left in place."
      pid_alive "$pid" && die 3 "the writer holding the lock is still running ($(owner_info)). Lock left in place; retry later."
    else
      [ "$age" -ge "$STALE_AGE" ] || die 3 "lock has no owner record and is only ${age}s old; retry after ${STALE_AGE}s. Lock left in place."
    fi
    moved="$LOCK.stale.$$"
    mv "$LOCK" "$moved" 2>/dev/null || die 3 "the lock changed while recovering; run recover again."
    if [ "$(cat "$moved/owner" 2>/dev/null || true)" != "$seen" ]; then
      mv "$moved" "$LOCK"
      die 3 "the lock changed while recovering; run recover again."
    fi
    rm -rf "$moved"
    echo "Cleared the interrupted writer's lock (was: $(printf '%s' "$seen" | tr '\n' ' '))."
  else
    echo "No lock was held."
  fi
  acquire recover
  rm -f "$FILE".tmp.* 2>/dev/null
  need_store
  src | grep -qE '^Next ID: R-[0-9]+$' || die 1 "store has no 'Next ID' line; repair it by hand before writing."
  echo "Store is consistent. An interrupted change was either fully saved or not saved at all: list, then repeat the request if it is missing."
}

case "${1:-}" in
  list)    [ $# -eq 1 ] || die 1 "usage: reminders.sh list";                 cmd_list ;;
  add)     [ $# -eq 2 ] || die 1 "usage: reminders.sh add \"<text>\"";       cmd_add "$2" ;;
  modify)  [ $# -eq 3 ] || die 1 "usage: reminders.sh modify <ID> \"<text>\""; cmd_modify "$2" "$3" ;;
  remove)  [ $# -eq 2 ] || die 1 "usage: reminders.sh remove <ID>";          cmd_remove "$2" ;;
  recover) [ $# -eq 1 ] || die 1 "usage: reminders.sh recover";              cmd_recover ;;
  *) die 1 "usage: reminders.sh list | add \"<text>\" | modify <ID> \"<text>\" | remove <ID> | recover" ;;
esac
