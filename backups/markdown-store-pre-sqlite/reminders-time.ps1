# Timezone calculations for reminders.sh (do not run directly; rules: reminders-guide.md).
# Git Bash on this host has no tz database, so named IANA zones are resolved with the
# Windows.Globalization.Calendar API (ICU data shipped with Windows). The host's own
# timezone setting is never used.
#
# Requests arrive in the environment variable REM_REQ, separated by ';', fields by '|'.
# One reply line per request: OK|... or ERR|<message>.
#   zone|<tz>                          -> OK|<tz as accepted>
#   fmt|<tz>|<epoch>                   -> OK|<epoch>|ok|<Ddd yyyy-MM-dd HH:mm +hh:mm>
#   res|<tz>|<yyyy-MM-dd>|<HH:mm>      -> OK|<epoch>|ok/missing/repeated|<local>
#   nxt|<tz>|<rule>|<after>[|<from>]   -> OK|<epoch>|ok/missing/repeated|<local>
#        first occurrence of a calendar rule strictly after epoch <after>
#        (and not before local date <from>, when given)
# Clock-change policy: a local time that does not exist (clocks go forward) is moved forward by
# the size of the gap; a local time that happens twice (clocks go back) means its first passage.
$ErrorActionPreference = 'Stop'
[void][Windows.Globalization.Calendar, Windows.Globalization, ContentType = WindowsRuntime]
$cal = New-Object Windows.Globalization.Calendar
$cal.ChangeCalendarSystem('GregorianCalendar')
$cal.ChangeClock('24HourClock')
$E0 = New-Object DateTimeOffset 1970, 1, 1, 0, 0, 0, ([TimeSpan]::Zero)
$U0 = New-Object DateTime 1970, 1, 1, 0, 0, 0
$inv = [Globalization.CultureInfo]::InvariantCulture
$dow = @{ MO = 'Monday'; TU = 'Tuesday'; WE = 'Wednesday'; TH = 'Thursday'; FR = 'Friday'; SA = 'Saturday'; SU = 'Sunday' }

function SetZone([string]$z) {
  if ($z -cnotmatch '^(UTC|[A-Za-z_]+(/[A-Za-z0-9_+\-]+)+)$') { throw "'$z' is not an IANA timezone name (expected e.g. Europe/Budapest)" }
  try { $cal.ChangeTimeZone($z) } catch { throw "unknown timezone '$z' (expected an IANA name such as Europe/Budapest)" }
}
function Wall([long]$e) {
  $cal.SetDateTime($E0.AddSeconds($e))
  New-Object DateTime $cal.Year, $cal.Month, $cal.Day, $cal.Hour, $cal.Minute, $cal.Second
}
function Off([long]$e) { [long]((Wall $e) - $U0).TotalSeconds - $e }
function Fmt([long]$e) {
  $o = Off $e
  $sign = '+'; if ($o -lt 0) { $sign = '-'; $o = - $o }
  '{0} {1}{2:D2}:{3:D2}' -f (Wall $e).ToString('ddd yyyy-MM-dd HH:mm', $inv), $sign, [int][Math]::Floor($o / 3600), [int](($o % 3600) / 60)
}
# Wall-clock time -> instant. Returns "<epoch>|<flag>".
function Resolve([DateTime]$w) {
  $l = [long]($w - $U0).TotalSeconds
  $o1 = Off ($l - 86400)
  $o2 = Off ($l + 86400)
  $valid = New-Object System.Collections.Generic.List[long]
  foreach ($o in @($o1, $o2)) {
    $u = $l - $o
    if (((Off $u) -eq $o) -and (-not $valid.Contains($u))) { $valid.Add($u) }
  }
  if ($valid.Count -eq 0) { return ('{0}|missing' -f ($l - $o1)) }
  if ($valid.Count -eq 2) { return ('{0}|repeated' -f [Math]::Min($valid[0], $valid[1])) }
  return ('{0}|ok' -f $valid[0])
}
function ParseDate([string]$d) {
  if ($d -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "'$d' is not a date (expected YYYY-MM-DD)" }
  try { [DateTime]::ParseExact($d, 'yyyy-MM-dd', $inv) } catch { throw "'$d' is not a real calendar date" }
}
function ParseTime([string]$t) {
  if ($t -notmatch '^([01]\d|2[0-3]):([0-5]\d)$') { throw "'$t' is not a time (expected 24-hour HH:MM)" }
  [int]$Matches[1] * 60 + [int]$Matches[2]
}
function NextCal([string]$rule, [long]$after) {
  if ($rule -cnotmatch '^(daily|weekly:((MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)|monthly:([1-9]|[12]\d|3[01]))@(\d\d:\d\d)$') { throw "unsupported calendar rule '$rule'" }
  $kind = $Matches[1]; $days = $Matches[2]; $dom = $Matches[6]; $mins = ParseTime $Matches[7]
  $want = @()
  if ($days) { $want = @($days.Split(',') | ForEach-Object { $dow[$_] }) }
  $d = (Wall $after).Date.AddDays(-1)
  for ($i = 0; $i -lt 800; $i++) {
    $hit = $true
    if ($kind -like 'weekly*') { $hit = $want -contains $d.DayOfWeek.ToString() }
    elseif ($kind -like 'monthly*') { $hit = $d.Day -eq [Math]::Min([int]$dom, [DateTime]::DaysInMonth($d.Year, $d.Month)) }
    if ($hit) {
      $r = Resolve ($d.AddMinutes($mins))
      if ([long]($r.Split('|')[0]) -gt $after) { return $r }
    }
    $d = $d.AddDays(1)
  }
  throw "no occurrence found for rule '$rule'"
}
function Reply([string]$r) { $e = [long]($r.Split('|')[0]); 'OK|{0}|{1}' -f $r, (Fmt $e) }

foreach ($req in ([string]$env:REM_REQ).Split(';')) {
  if (-not $req) { continue }
  $f = $req.Split('|')
  try {
    SetZone $f[1]
    switch ($f[0]) {
      'zone' { $out = 'OK|' + $f[1] }
      'fmt' { $out = Reply ('{0}|ok' -f [long]$f[2]) }
      'res' { $out = Reply (Resolve ((ParseDate $f[2]).AddMinutes((ParseTime $f[3])))) }
      'nxt' {
        $after = [long]$f[3]
        if ($f.Count -gt 4 -and $f[4]) {
          $start = [long]((Resolve (ParseDate $f[4])).Split('|')[0]) - 1
          if ($start -gt $after) { $after = $start }
        }
        $out = Reply (NextCal $f[2] $after)
      }
      default { throw "unknown request '$($f[0])'" }
    }
  }
  catch { $out = 'ERR|' + ($_.Exception.Message -replace '[\r\n|;]+', ' ') }
  [Console]::Out.WriteLine($out)
}
