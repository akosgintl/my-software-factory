#!/usr/bin/env bash
# Reader/writer for the chat reminder service. Rules: reminders-guide.md.
# Every change to REMINDERS.md goes through this script so that all writers (chat and the
# reminder checker) share one lock:  acquire -> reread -> change -> atomic replace -> release.
#
#   bash reminders.sh list
#   bash reminders.sh add    "<text>" [SCHEDULE]   (text "-" = read text from stdin)
#   bash reminders.sh modify <ID> "<text>"         (text only; the schedule is kept)
#   bash reminders.sh schedule   <ID> SCHEDULE     (set or replace the schedule)
#   bash reminders.sh unschedule <ID>
#   bash reminders.sh remove <ID>
#   bash reminders.sh resolve SCHEDULE             (show what would be saved; writes nothing)
#   bash reminders.sh now [--tz <Zone>]            (current date/time in a zone)
#   bash reminders.sh tz [<Zone>]                  (show / save the confirmed default timezone)
#   bash reminders.sh due [--run <handle>]         (checker: select due occurrences, mark pending)
#   bash reminders.sh ack   <ID> <occurrence>      (checker: delivered -> complete / advance)
#   bash reminders.sh retry <ID> <occurrence>      (reconcile: was NOT delivered -> due again)
#   bash reminders.sh recover                      (after an interrupted writer)
#
# SCHEDULE:  [--tz <IANA zone>] --at "YYYY-MM-DD HH:MM"                       one-off
#            [--tz <IANA zone>] --rule every:N{m|h|d} [--at "YYYY-MM-DD HH:MM"]  exact duration
#            [--tz <IANA zone>] --rule daily@HH:MM | weekly:MO,WE@HH:MM | monthly:D@HH:MM
#                               [--from YYYY-MM-DD]                           calendar, local time kept
#
# Exit codes: 0 ok, 1 bad input or malformed store, 2 no such ID, 3 lock busy,
#             4 ack/retry refused (that occurrence is not pending; nothing changed).
set -u

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="${REMINDERS_DIR:-$SELF_DIR}"   # REMINDERS_DIR: isolated tests only
FILE="$DIR/REMINDERS.md"
LOCK="$DIR/.reminders.lock"
HELPER="$SELF_DIR/reminders-time.ps1"
WAIT="${REMINDERS_LOCK_WAIT:-60}"   # seconds to wait for the lock
STALE_AGE=60                        # a lock with no readable owner is recoverable after this many seconds
GRACE="${REMINDERS_PENDING_GRACE:-120}"   # a pending delivery older than this is "delivery uncertain"
LATE=300                            # a delivery this many seconds after its due instant is labelled late
TMP=""
REP=""
HELD=0
ZONE_RE='^(UTC|[A-Za-z_]+(/[A-Za-z0-9_+-]+)+)$'
ISO_RE='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
AT_RE='^([0-9]{4}-[0-9]{2}-[0-9]{2})[T ]([0-9]{2}:[0-9]{2})$'
CAL_RE='^(daily|weekly:(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|monthly:([1-9]|[12][0-9]|3[01]))@([01][0-9]|2[0-3]):[0-5][0-9]$'

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
  [ -n "$REP" ] && rm -f "$REP"
  TMP=""; REP=""
  if [ "$HELD" = 1 ]; then
    rm -f "$LOCK/owner"
    rmdir "$LOCK" 2>/dev/null
    HELD=0
  fi
}
trap release EXIT
trap 'exit 130' INT TERM HUP

src() { tr -d '\r' < "$FILE"; }
textrecs() { grep -E '^- R-[0-9]+: ' || true; }            # reminder lines
metarecs() { grep -E '^  ~ R-[0-9]+ \|' || true; }         # schedule lines
records()  { grep -E '^(- R-[0-9]+: |  ~ R-[0-9]+ \|)' || true; }

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

# ---------- time ----------

# Current instant (epoch seconds). REMINDERS_TEST_NOW=<YYYY-MM-DDTHH:MM:SSZ> replaces the clock for
# isolated tests only: it is refused unless REMINDERS_DIR points at a scratch store, so it can never
# move the clock of the canonical store.
now_epoch() {
  if [ -n "${REMINDERS_TEST_NOW:-}" ]; then
    [ -n "${REMINDERS_DIR:-}" ] && [ "$(cd "$DIR" && pwd -P)" != "$(cd "$SELF_DIR" && pwd -P)" ] \
      || die 1 "REMINDERS_TEST_NOW is a test clock and is refused for the canonical store (it needs REMINDERS_DIR set to a scratch copy). Unset it."
    [[ "$REMINDERS_TEST_NOW" =~ $ISO_RE ]] || die 1 "REMINDERS_TEST_NOW must look like 2026-10-13T10:00:00Z"
    date -u -d "$REMINDERS_TEST_NOW" +%s || die 1 "REMINDERS_TEST_NOW is not a real instant"
  else
    date -u +%s
  fi
}
iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
epoch() { date -u -d "$1" +%s; }

# tcall <request>... : timezone helper (reminders-time.ps1); one reply line per request.
tcall() {
  local IFS=';' out win
  win=$(cygpath -w "$HELPER" 2>/dev/null || printf '%s' "$HELPER")
  [ -f "$HELPER" ] || die 1 "timezone helper $HELPER is missing; scheduling is unavailable. Report this."
  # The helper only calculates, so it is safe to run again. Windows PowerShell occasionally starts in
  # "constrained language mode" on this host and then fails without output: retry a few times.
  local try
  for try in 1 2 3 4 5; do
    out=$(REM_REQ="$*" powershell.exe -NoProfile -NonInteractive -Command \
          "& ([scriptblock]::Create([IO.File]::ReadAllText('${win//\'/\'\'}')))" 2>&1 | tr -d '\r')
    printf '%s\n' "$out" | grep -qE '^(OK|ERR)\|' && break
    sleep 0.5
  done
  printf '%s\n' "$out" | grep -qE '^(OK|ERR)\|' || die 1 "timezone helper failed (nothing was changed): $out"
  printf '%s\n' "$out" | grep -E '^(OK|ERR)\|'
}
# tone <request> : single request; sets T_EPOCH T_FLAG T_LOCAL or dies with the helper's message.
tone() {
  local r
  r=$(tcall "$1") || exit 1
  case "$r" in ERR\|*) die 1 "${r#ERR|}";; esac
  IFS='|' read -r _ T_EPOCH T_FLAG T_LOCAL <<< "$r"
}

default_tz() { src | sed -nE 's/^Default timezone: ([A-Za-z_]+(\/[A-Za-z0-9_+-]+)*)$/\1/p' | head -n 1; }

describe_rule() {
  case "$1" in
    once) echo "one-off" ;;
    every:*m) echo "every ${1:6:-1} minute(s), exact duration" ;;
    every:*h) echo "every ${1:6:-1} hour(s), exact duration" ;;
    every:*d) echo "every ${1:6:-1} x 24 hours, exact duration (local time shifts at clock changes)" ;;
    daily@*) echo "every day at ${1#*@} local time" ;;
    weekly:*) local r="${1#weekly:}"; echo "weekly on ${r%@*} at ${r#*@} local time" ;;
    monthly:*) local r="${1#monthly:}"; echo "monthly on day ${r%@*} (last day of shorter months) at ${r#*@} local time" ;;
    *) echo "$1" ;;
  esac
}
duration_secs() {   # every:N{m|h|d} -> seconds
  local n="${1:6:-1}"
  case "$1" in *m) echo $((10#$n * 60));; *h) echo $((10#$n * 3600));; *d) echo $((10#$n * 86400));; esac
}
flag_note() {       # <flag> <local>
  case "$1" in
    missing)  echo "NOTE: that local time does not exist on that date in $S_TZ (clocks go forward); it was moved forward to $2." ;;
    repeated) echo "NOTE: that local time happens twice on that date in $S_TZ (clocks go back); the first (earlier) one is used: $2." ;;
  esac
}

# parse_sched <args...> : sets O_TZ O_AT O_RULE O_FROM
parse_sched() {
  O_TZ=""; O_AT=""; O_RULE=""; O_FROM=""
  while [ $# -gt 0 ]; do
    [ $# -ge 2 ] || die 1 "option $1 needs a value"
    case "$1" in
      --tz) O_TZ="$2" ;; --at) O_AT="$2" ;; --rule) O_RULE="$2" ;; --from) O_FROM="$2" ;;
      *) die 1 "unknown option '$1' (expected --tz, --at, --rule, --from)" ;;
    esac
    shift 2
  done
}

# compute_sched : from O_* and the current instant, sets S_TZ S_RULE S_NEXT (ISO UTC) S_LOCAL S_NOTE.
compute_sched() {
  local now d t dur
  S_NOTE=""
  S_TZ="${O_TZ:-$(default_tz)}"
  [ -n "$S_TZ" ] || die 1 "no timezone: none was given (--tz) and no confirmed default timezone is saved. Ask the user which timezone they mean (IANA name, e.g. Europe/Budapest); never assume the host's timezone."
  [[ "$S_TZ" =~ $ZONE_RE ]] || die 1 "'$S_TZ' is not an IANA timezone name (expected e.g. Europe/Budapest)"
  S_RULE="${O_RULE:-once}"
  now=$(now_epoch) || exit 1
  if [ -n "$O_AT" ]; then
    [[ "$O_AT" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})[T\ ]([0-9]{2}:[0-9]{2})$ ]] \
      || die 1 "--at must be \"YYYY-MM-DD HH:MM\" (24-hour local time in the reminder's timezone)"
    d="${BASH_REMATCH[1]}"; t="${BASH_REMATCH[2]}"
  fi
  case "$S_RULE" in
    once)
      [ -n "$O_AT" ] || die 1 "a one-off needs --at \"YYYY-MM-DD HH:MM\""
      [ -z "$O_FROM" ] || die 1 "--from is only for daily/weekly/monthly rules"
      tone "res|$S_TZ|$d|$t" ;;
    every:*)
      [[ "$S_RULE" =~ ^every:[1-9][0-9]{0,4}[mhd]$ ]] || die 1 "duration rule must be every:N followed by m, h or d (whole minutes at least), e.g. every:90m"
      [ -z "$O_FROM" ] || die 1 "--from is only for daily/weekly/monthly rules; give the first occurrence with --at"
      dur=$(duration_secs "$S_RULE")
      if [ -n "$O_AT" ]; then tone "res|$S_TZ|$d|$t"; else tone "fmt|$S_TZ|$((now + dur))"; fi ;;
    daily@*|weekly:*|monthly:*)
      [[ "$S_RULE" =~ ^(daily|weekly:(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|monthly:([1-9]|[12][0-9]|3[01]))@([01][0-9]|2[0-3]):[0-5][0-9]$ ]] \
        || die 1 "calendar rule must be daily@HH:MM, weekly:MO,WE@HH:MM (days MO TU WE TH FR SA SU) or monthly:D@HH:MM (D = 1-31), 24-hour time"
      [ -z "$O_AT" ] || die 1 "calendar rules take their time from the rule (e.g. daily@09:00); use --from YYYY-MM-DD for a start date, not --at"
      tone "nxt|$S_TZ|$S_RULE|$now|$O_FROM" ;;
    *) die 1 "unsupported rule '$S_RULE'. Supported: (none = one-off), every:N{m|h|d}, daily@HH:MM, weekly:DAYS@HH:MM, monthly:D@HH:MM" ;;
  esac
  [ "$T_EPOCH" -gt "$now" ] || die 1 "that time ($T_LOCAL $S_TZ) is not in the future (now: $(iso "$now")). Nothing was saved; ask the user which date/time they mean."
  S_NEXT=$(iso "$T_EPOCH"); S_LOCAL="$T_LOCAL"
  S_NOTE=$(flag_note "$T_FLAG" "$T_LOCAL")
}

sched_summary() {   # one human line for the saved schedule
  echo "Schedule: $(describe_rule "$S_RULE"); next due $S_LOCAL ($S_TZ) = $S_NEXT"
  [ -z "$S_NOTE" ] || echo "$S_NOTE"
}

# ---------- schedule line ----------

M_KEYS="state tz rule next local pending prun pmarked pnote last acked"
load_meta() {       # <id> : sets M_* ; returns 1 when the reminder is unscheduled
  local line part parts k
  for k in $M_KEYS; do printf -v "M_$k" '%s' "-"; done
  line=$(src | grep -E "^  ~ $1 \|" | head -n 1)
  [ -n "$line" ] || return 1
  IFS='|' read -ra parts <<< "$line"
  for part in "${parts[@]:1}"; do
    part="${part# }"; part="${part% }"; k="${part%%=*}"
    case " $M_KEYS " in *" $k "*) printf -v "M_$k" '%s' "${part#*=}" ;; esac
  done
  return 0
}
meta_line() {       # <id>
  printf '  ~ %s | state=%s | tz=%s | rule=%s | next=%s | local=%s | pending=%s | prun=%s | pmarked=%s | pnote=%s | last=%s | acked=%s' \
    "$1" "$M_state" "$M_tz" "$M_rule" "$M_next" "$M_local" "$M_pending" "$M_prun" "$M_pmarked" "$M_pnote" "$M_last" "$M_acked"
}
clear_pending() { M_pending="-"; M_prun="-"; M_pmarked="-"; M_pnote="-"; }
set_sched() {       # S_* -> M_* (new or replaced schedule; keeps M_last / M_acked)
  M_state="active"; M_tz="$S_TZ"; M_rule="$S_RULE"; M_next="$S_NEXT"; M_local="$S_LOCAL"; clear_pending
}

# rewrite <id> <text-mode> <meta-mode> : new store content on stdout.
#   text-mode: keep | set (R_TEXT) | remove      meta-mode: keep | set (R_META) | drop
rewrite() {
  src | R_ID="$1" R_TM="$2" R_MM="$3" awk '
    BEGIN { tp = "- " ENVIRON["R_ID"] ": "; mp = "  ~ " ENVIRON["R_ID"] " |"; tm = ENVIRON["R_TM"]; mm = ENVIRON["R_MM"] }
    index($0, tp) == 1 {
      if (tm == "remove") next
      if (tm == "set") print tp ENVIRON["R_TEXT"]; else print
      if (mm == "set") print ENVIRON["R_META"]
      next
    }
    index($0, mp) == 1 { if (tm == "remove" || mm != "keep") next }
    { print }'
}

# commit <id> <expected reminder-count delta>: check that only record <id> differs, then replace atomically.
commit() {
  local id="$1" delta="$2" before after
  before=$(src | records | grep -vE "^(- $id: |  ~ $id \|)" || true)
  after=$(records < "$TMP" | grep -vE "^(- $id: |  ~ $id \|)" || true)
  [ "$before" = "$after" ] || die 1 "internal check failed: another record would change. Nothing was changed."
  [ $(( $(src | textrecs | wc -l) + delta )) -eq "$(textrecs < "$TMP" | wc -l)" ] \
    || die 1 "internal check failed: unexpected record count. Nothing was changed."
  [ "$(metarecs < "$TMP" | sed -E 's/^  ~ (R-[0-9]+) .*/\1/' | sort | uniq -d | wc -l)" -eq 0 ] \
    || die 1 "internal check failed: duplicate schedule line. Nothing was changed."
  mv -f "$TMP" "$FILE" || die 1 "could not replace $FILE. Nothing was changed."
  TMP=""
}

have_id() { [ "$(src | grep -c "^- $1: ")" -eq 1 ] || die 2 "no reminder with ID $1. Nothing was changed."; }
text_of() { src | sed -n "s/^- $1: //p"; }

# ---------- commands ----------

cmd_list() {
  need_store
  local out
  out=$(src | awk '
    function field(line, k,   n, i, p, a) {
      n = split(line, a, / \| /)
      for (i = 2; i <= n; i++) { p = index(a[i], "="); if (substr(a[i], 1, p - 1) == k) return substr(a[i], p + 1) }
      return "-"
    }
    /^- R-[0-9]+: / { print substr($0, 3); next }
    /^  ~ R-[0-9]+ \|/ {
      st = field($0, "state"); r = field($0, "rule"); p = field($0, "pending")
      if (st == "completed") s = "completed (one-off delivered; occurrence " field($0, "last") ")"
      else s = "active; next due " field($0, "local") " (" field($0, "tz") ") = " field($0, "next") "; rule " r
      print "    " s
      if (p != "-" && field($0, "pnote") == "yes")
        print "    DELIVERY UNCERTAIN for occurrence " p " (marked " field($0, "pmarked") ", run " field($0, "prun") "): not resent; reconcile with ack or retry"
      else if (p != "-")
        print "    delivery in progress for occurrence " p " (marked " field($0, "pmarked") ", run " field($0, "prun") ")"
    }')
  if [ -z "$out" ]; then echo "No reminders saved."; else printf '%s\n' "$out"; fi
}

cmd_add() {
  local text ctr max n id raw="$1"; shift
  text=$(get_text "$raw") || exit 1
  need_store
  local sched=0
  if [ $# -gt 0 ]; then sched=1; parse_sched "$@"; compute_sched; fi
  acquire add
  ctr=$(src | sed -nE 's/^Next ID: R-([0-9]+)$/\1/p' | head -n 1)
  [ -n "$ctr" ] || die 1 "store has no 'Next ID: R-NNNN' line; refusing to guess an ID (deleted IDs must never be reused)."
  n=$((10#$ctr))
  max=$(src | textrecs | sed -E 's/^- R-([0-9]+): .*/\1/' | sort -n | tail -n 1)
  [ -n "$max" ] && [ $((10#$max + 1)) -gt "$n" ] && n=$((10#$max + 1))
  id=$(printf 'R-%04d' "$n")
  TMP="$FILE.tmp.$$"
  src | awk -v nid="$(printf 'R-%04d' $((n + 1)))" '/^Next ID: /{print "Next ID: " nid; next} {print}' > "$TMP"
  printf -- '- %s: %s\n' "$id" "$text" >> "$TMP"
  if [ "$sched" = 1 ]; then
    load_meta "$id" || true
    set_sched
    printf '%s\n' "$(meta_line "$id")" >> "$TMP"
  fi
  commit "$id" 1
  src | grep -qxF -- "- $id: $text" || die 1 "saved file does not contain the new record"
  echo "Added $id: $text"
  if [ "$sched" = 1 ]; then sched_summary; else echo "Unscheduled: it is stored as text and will never be sent."; fi
}

cmd_modify() {
  local id text old
  id=$(norm_id "$1") || exit 1
  text=$(get_text "$2") || exit 1
  need_store
  acquire "modify $id"
  have_id "$id"
  old=$(text_of "$id")
  TMP="$FILE.tmp.$$"
  R_TEXT="$text" rewrite "$id" set keep > "$TMP"
  commit "$id" 0
  src | grep -qxF -- "- $id: $text" || die 1 "saved file does not contain the modified record"
  echo "Modified $id: $text"
  echo "(previous text: $old)"
  if load_meta "$id"; then echo "Schedule unchanged: $M_state; rule $M_rule; next due $M_local ($M_tz)"; fi
}

cmd_schedule() {
  local id was
  id=$(norm_id "$1") || exit 1; shift
  need_store
  parse_sched "$@"; compute_sched
  acquire "schedule $id"
  have_id "$id"
  was="unscheduled"
  if load_meta "$id"; then was="$M_state; rule $M_rule; next due $M_local ($M_tz)"; fi
  [ "$M_pending" = "-" ] || echo "NOTE: occurrence $M_pending was being delivered when this change was saved; it may already have been sent. Its acknowledgement will now be refused and it will not be sent again."
  set_sched
  TMP="$FILE.tmp.$$"
  R_META="$(meta_line "$id")" rewrite "$id" keep set > "$TMP"
  commit "$id" 0
  load_meta "$id" && [ "$M_next" = "$S_NEXT" ] || die 1 "saved file does not contain the new schedule"
  echo "Scheduled $id: $(text_of "$id")"
  sched_summary
  echo "(previous schedule: $was)"
}

cmd_unschedule() {
  local id
  id=$(norm_id "$1") || exit 1
  need_store
  acquire "unschedule $id"
  have_id "$id"
  load_meta "$id" || { echo "$id has no schedule. Nothing was changed."; return 0; }
  TMP="$FILE.tmp.$$"
  rewrite "$id" keep drop > "$TMP"
  commit "$id" 0
  local was="$M_state; rule $M_rule; next due $M_local ($M_tz)"
  load_meta "$id" && die 1 "schedule of $id is still present"
  echo "Unscheduled $id: $(text_of "$id")"
  echo "(previous schedule: $was). It is kept as text and will not be sent."
}

cmd_remove() {
  local id old
  id=$(norm_id "$1") || exit 1
  need_store
  acquire "remove $id"
  have_id "$id"
  old=$(text_of "$id")
  TMP="$FILE.tmp.$$"
  rewrite "$id" remove drop > "$TMP"
  commit "$id" -1
  src | grep -qE "^(- $id: |  ~ $id \|)" && die 1 "record $id is still present after removal"
  echo "Removed $id: $old"
  echo "Confirmed: $id is no longer in the store. Its ID will not be reused. Nothing further will be sent for it."
}

cmd_resolve() {
  need_store
  parse_sched "$@"; compute_sched
  echo "Would save (nothing was written):"
  sched_summary
}

cmd_now() {
  local z now
  need_store
  parse_sched "$@"
  z="${O_TZ:-$(default_tz)}"
  [ -n "$z" ] || die 1 "no timezone: give --tz <IANA zone>, or ask the user and save a confirmed default with: reminders.sh tz <Zone>"
  now=$(now_epoch) || exit 1
  tone "fmt|$z|$now"
  echo "Now: $T_LOCAL ($z) = $(iso "$now")"
}

cmd_tz() {
  need_store
  if [ $# -eq 0 ]; then
    local z; z=$(default_tz)
    if [ -n "$z" ]; then echo "Default timezone: $z (confirmed by the user)"; else echo "Default timezone: not confirmed. Ask the user; never assume the host's timezone."; fi
    return 0
  fi
  [[ "$1" =~ $ZONE_RE ]] || die 1 "'$1' is not an IANA timezone name (expected e.g. Europe/Budapest)"
  local r; r=$(tcall "zone|$1") || exit 1
  case "$r" in ERR\|*) die 1 "${r#ERR|}";; esac
  acquire "tz $1"
  TMP="$FILE.tmp.$$"
  src | awk -v z="$1" '/^Default timezone: / { next } { print } /^Next ID: / { print "Default timezone: " z }' > "$TMP"
  commit "R-NONE" 0
  [ "$(default_tz)" = "$1" ] || die 1 "saved file does not contain the default timezone"
  echo "Default timezone saved: $1. Existing reminders keep the timezone they were saved with."
}

# due: under the lock, select every active reminder whose next occurrence is due, mark that occurrence
# pending (occurrence instant + run handle + time marked) and print what to deliver. A reminder that
# already has a pending occurrence is never selected again: an older check may have sent it.
cmd_due() {
  local run="" now rc
  if [ $# -gt 0 ]; then [ "$1" = "--run" ] && [ $# -eq 2 ] || die 1 "usage: reminders.sh due [--run <handle>]"; run="$2"; fi
  need_store
  now=$(now_epoch) || exit 1
  [ -n "$run" ] || run="chk-$(iso "$now" | tr -d ':-')-$$"
  run=$(printf '%s' "$run" | tr -c 'A-Za-z0-9._-' '_')
  acquire "due $run"
  TMP="$FILE.tmp.$$"; REP="$FILE.tmp.$$.rep"
  : > "$REP"
  src | R_REP="$REP" awk -v now="$now" -v nowiso="$(iso "$now")" -v run="$run" -v grace="$GRACE" -v late="$LATE" '
    BEGIN { rep = ENVIRON["R_REP"] }
    function ep(s,   t) { t = s; gsub(/[-:TZ]/, " ", t); return mktime(t, 1) }
    function span(s,   d, h, m, o) {
      d = int(s / 86400); h = int((s % 86400) / 3600); m = int((s % 3600) / 60); o = ""
      if (d) o = o d "d "; if (d || h) o = o h "h "; return o m "m"
    }
    function rule(r) { return r == "once" ? "one-off" : "recurring " r }
    /^- R-[0-9]+: / { id = substr($0, 3, index($0, ": ") - 3); txt[id] = substr($0, index($0, ": ") + 2); print; next }
    /^  ~ R-[0-9]+ \|/ {
      n = split($0, a, / \| /); id = substr(a[1], 5); delete f
      for (i = 2; i <= n; i++) { p = index(a[i], "="); k[i] = substr(a[i], 1, p - 1); f[k[i]] = substr(a[i], p + 1) }
      if (f["state"] == "active" && (id in txt)) {
        if (f["pending"] != "-") {
          if (f["pnote"] != "yes" && now - ep(f["pmarked"]) >= grace) {
            f["pnote"] = "yes"
            print "UNCERTAIN " id " " f["pending"] > rep
            print "MESSAGE Delivery uncertain for reminder " id ": \"" txt[id] "\" (due " f["local"] " " f["tz"] "; " rule(f["rule"]) "). An earlier check (run " f["prun"] ", " f["pmarked"] ") selected it but never confirmed delivery. It has NOT been resent." > rep
          }
        } else if (f["next"] != "-" && ep(f["next"]) <= now) {
          f["pending"] = f["next"]; f["prun"] = run; f["pmarked"] = nowiso; f["pnote"] = "no"
          l = now - ep(f["next"])
          print "DELIVER " id " " f["next"] > rep
          print "MESSAGE Reminder " id ": " txt[id] "  (due " f["local"] " " f["tz"] "; " rule(f["rule"]) (l >= late ? "; LATE by " span(l) " - catch-up" : "") ")" > rep
        }
      }
      line = a[1]
      for (i = 2; i <= n; i++) line = line " | " k[i] "=" f[k[i]]
      print line; next
    }
    { print }' > "$TMP"
  rc=$?
  [ "$rc" -eq 0 ] || die 1 "check failed while reading the store. Nothing was changed."
  if [ ! -s "$REP" ]; then echo "NOTHING_DUE"; return 0; fi
  [ "$(src | grep -vE '^  ~ R-[0-9]+ \|')" = "$(grep -vE '^  ~ R-[0-9]+ \|' "$TMP")" ] \
    && [ "$(src | metarecs | wc -l)" -eq "$(metarecs < "$TMP" | wc -l)" ] \
    || die 1 "internal check failed: more than schedule state would change. Nothing was changed."
  local report; report=$(cat "$REP")
  mv -f "$TMP" "$FILE" || die 1 "could not replace $FILE. Nothing was changed."
  TMP=""
  echo "CHECK run=$run now=$(iso "$now")"
  printf '%s\n' "$report"
  echo "END deliver=$(printf '%s\n' "$report" | grep -c '^DELIVER ') uncertain=$(printf '%s\n' "$report" | grep -c '^UNCERTAIN ')"
}

# pending_guard <id> <occurrence> <verb>: under the lock, the reminder must exist, be active and still
# have exactly this occurrence pending; otherwise exit 4 without changing anything.
pending_guard() {
  [[ "$2" =~ $ISO_RE ]] || die 1 "'$2' is not an occurrence instant (expected e.g. 2026-10-13T10:50:00Z, as printed by due)"
  [ "$(src | grep -c "^- $1: ")" -eq 1 ] \
    || die 4 "$3 refused: reminder $1 no longer exists (removed after it was selected). Nothing was changed."
  load_meta "$1" || die 4 "$3 refused: reminder $1 has no schedule any more. Nothing was changed."
  if [ "$3" = "ack" ] && [ "$M_pending" = "-" ] && [ "$M_last" = "$2" ]; then
    echo "Already acknowledged: $1 occurrence $2 (state $M_state; next due $M_local). Nothing was changed."
    exit 0
  fi
  [ "$M_state" = "active" ] || die 4 "$3 refused: reminder $1 is $M_state. Nothing was changed."
  [ "$M_pending" = "$2" ] \
    || die 4 "$3 refused: occurrence $2 of $1 is not pending (pending: $M_pending; next due: $M_next). It was edited, rescheduled or already reconciled. Nothing was changed."
}

cmd_ack() {
  local id occ now base dur k
  id=$(norm_id "$1") || exit 1; occ="$2"
  need_store
  now=$(now_epoch) || exit 1
  acquire "ack $id"
  pending_guard "$id" "$occ" ack
  base=$(epoch "$occ")
  case "$M_rule" in
    once)
      M_state="completed"; M_next="-" ;;
    every:*)
      dur=$(duration_secs "$M_rule")
      k=1; [ "$now" -ge "$base" ] && k=$(( (now - base) / dur + 1 ))
      tone "fmt|$M_tz|$((base + k * dur))"
      M_next=$(iso "$T_EPOCH"); M_local="$T_LOCAL" ;;
    *)
      tone "nxt|$M_tz|$M_rule|$(( now > base ? now : base ))"
      M_next=$(iso "$T_EPOCH"); M_local="$T_LOCAL" ;;
  esac
  M_last="$occ"; M_acked=$(iso "$now"); clear_pending
  TMP="$FILE.tmp.$$"
  R_META="$(meta_line "$id")" rewrite "$id" keep set > "$TMP"
  commit "$id" 0
  if [ "$M_rule" = "once" ]; then
    echo "Acknowledged $id occurrence $occ: one-off completed; it will not be sent again."
  else
    echo "Acknowledged $id occurrence $occ: advanced to $M_local ($M_tz) = $M_next; rule $M_rule"
    S_TZ="$M_tz"; flag_note "$T_FLAG" "$T_LOCAL"
  fi
}

cmd_retry() {
  local id occ
  id=$(norm_id "$1") || exit 1; occ="$2"
  need_store
  acquire "retry $id"
  pending_guard "$id" "$occ" retry
  clear_pending
  TMP="$FILE.tmp.$$"
  R_META="$(meta_line "$id")" rewrite "$id" keep set > "$TMP"
  commit "$id" 0
  echo "Released $id occurrence $occ: marked not delivered; the next check will send it once (as a late catch-up)."
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
  echo "A check interrupted between marking and acknowledging leaves a pending occurrence: see 'list' (it is never resent automatically)."
}

USAGE='usage: reminders.sh list | add "<text>" [SCHEDULE] | modify <ID> "<text>" | schedule <ID> SCHEDULE | unschedule <ID> | remove <ID> | resolve SCHEDULE | now [--tz <Zone>] | tz [<Zone>] | due [--run <handle>] | ack <ID> <occurrence> | retry <ID> <occurrence> | recover
SCHEDULE: [--tz <Zone>] --at "YYYY-MM-DD HH:MM" | [--tz <Zone>] --rule every:N{m|h|d} [--at ...] | [--tz <Zone>] --rule daily@HH:MM|weekly:MO,WE@HH:MM|monthly:D@HH:MM [--from YYYY-MM-DD]'

c="${1:-}"; [ $# -gt 0 ] && shift
case "$c" in
  list)       [ $# -eq 0 ] || die 1 "usage: reminders.sh list";                    cmd_list ;;
  add)        [ $# -ge 1 ] || die 1 "usage: reminders.sh add \"<text>\" [SCHEDULE]"; cmd_add "$@" ;;
  modify)     [ $# -eq 2 ] || die 1 "usage: reminders.sh modify <ID> \"<text>\" (text only; use 'schedule' to change the time)"; cmd_modify "$1" "$2" ;;
  schedule)   [ $# -ge 3 ] || die 1 "usage: reminders.sh schedule <ID> SCHEDULE";  cmd_schedule "$@" ;;
  unschedule) [ $# -eq 1 ] || die 1 "usage: reminders.sh unschedule <ID>";         cmd_unschedule "$1" ;;
  remove)     [ $# -eq 1 ] || die 1 "usage: reminders.sh remove <ID>";             cmd_remove "$1" ;;
  resolve)    [ $# -ge 2 ] || die 1 "usage: reminders.sh resolve SCHEDULE";        cmd_resolve "$@" ;;
  now)        cmd_now "$@" ;;
  tz)         [ $# -le 1 ] || die 1 "usage: reminders.sh tz [<Zone>]";             cmd_tz "$@" ;;
  due)        cmd_due "$@" ;;
  ack)        [ $# -eq 2 ] || die 1 "usage: reminders.sh ack <ID> <occurrence>";   cmd_ack "$1" "$2" ;;
  retry)      [ $# -eq 2 ] || die 1 "usage: reminders.sh retry <ID> <occurrence>"; cmd_retry "$1" "$2" ;;
  recover)    [ $# -eq 0 ] || die 1 "usage: reminders.sh recover";                 cmd_recover ;;
  *) die 1 "$USAGE" ;;
esac
