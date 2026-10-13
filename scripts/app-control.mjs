#!/usr/bin/env node
// Controls for the Reminders browser app (the Next.js server). Application runtime only: this
// starts and stops a web server; it schedules nothing and sends no reminders.
//
//   node scripts/app-control.mjs status     is it running, on which address, reading which database
//   node scripts/app-control.mjs build      next build (needed after the code changes)
//   node scripts/app-control.mjs run        run the server in the foreground (for a terminal kept open by hand)
//   node scripts/app-control.mjs start      start it detached in the background, wait until it answers
//   node scripts/app-control.mjs stop       stop it (however it was started)
//   node scripts/app-control.mjs restart    stop, then start detached
//
// Wrappers: `bash app.sh <command>` (Git Bash) and `.\app.cmd <command>` (PowerShell / cmd).
// Options: --port <n> (default: reminders.config.json). Tests also set REMINDERS_DB.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'reminders.config.json'), 'utf8'));
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'status';
const portArg = args.indexOf('--port');
const PORT = portArg >= 0 ? Number(args[portArg + 1]) : Number(config.port);
const HOST = config.host ?? '127.0.0.1';
const RUN_DIR = path.join(ROOT, '.app');
const STATE = path.join(RUN_DIR, `server-${PORT}.json`);
const LOG = path.join(RUN_DIR, `server-${PORT}.log`);
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const ADDRESS = `http://localhost:${PORT}`;
const ENV = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };

// Output may go to a pipe whose reader stops early (`status | head -1`). That must not crash the
// command or change its exit code: once the pipe is closed, stop writing and carry on.
const PIPE_CLOSED = new Set(['EPIPE', 'EOF', 'ERR_STREAM_DESTROYED']);
let outputClosed = false;
process.stdout.on('error', (err) => {
  if (!PIPE_CLOSED.has(err.code)) throw err;
  outputClosed = true;
});
const say = (line) => {
  if (outputClosed) return;
  try {
    process.stdout.write(`${line}\n`);
  } catch (err) {
    if (!PIPE_CLOSED.has(err.code)) throw err;
    outputClosed = true;
  }
};

async function health() {
  try {
    const res = await fetch(`http://${HOST}:${PORT}/api/health`, { signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    return { answered: true, ok: res.ok && body?.app === 'reminders', status: res.status, body };
  } catch {
    return { answered: false, ok: false };
  }
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(pid, mode) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ pid, mode, port: PORT, started: new Date().toISOString() }, null, 2));
}

/** PIDs listening on the app's port (Windows: netstat; elsewhere: lsof when present). */
function listeners() {
  const pids = new Set();
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true }).stdout ?? '';
    for (const line of out.split(/\r?\n/)) {
      const m = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/.exec(line);
      if (m && Number(m[1]) === PORT) pids.add(Number(m[2]));
    }
  } else {
    const out = spawnSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout ?? '';
    for (const line of out.split('\n')) if (/^\d+$/.test(line.trim())) pids.add(Number(line.trim()));
  }
  return [...pids];
}

/** The command line of a running process, or null when it cannot be read. */
function commandLine(pid) {
  const r =
    process.platform === 'win32'
      ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
      : spawnSync('ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' });
  const line = (r.stdout ?? '').trim();
  return r.status === 0 && line ? line : null;
}

/**
 * Is this process the server these controls started for this port? A recorded PID proves nothing by
 * itself: the state file survives a crash or a shutdown, and the system gives old PIDs to new
 * processes. Only a process whose command line is this project's `next start` on this port counts.
 * When the command line cannot be read the answer is no, so nothing is killed on a guess.
 */
function isOurServer(pid) {
  const line = commandLine(pid);
  if (!line) return false;
  const flat = line.replaceAll('\\', '/').toLowerCase();
  const bin = NEXT_BIN.replaceAll('\\', '/').toLowerCase();
  const at = flat.indexOf(bin);
  if (at < 0) return false;
  const rest = flat.slice(at + bin.length).replaceAll('"', ' ').trim().split(/\s+/);
  return rest[0] === 'start' && rest[rest.indexOf('-p') + 1] === String(PORT) && rest.includes('-p');
}

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureBuilt() {
  if (fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) return;
  say('No production build found; building first...');
  build();
}

function build() {
  const result = spawnSync(process.execPath, [NEXT_BIN, 'build'], { cwd: ROOT, env: ENV, stdio: 'inherit' });
  if (result.status !== 0) {
    say('Build failed.');
    process.exit(result.status ?? 1);
  }
}

async function refuseIfTaken() {
  const h = await health();
  if (h.ok) {
    say(`Already running at ${ADDRESS} (database ${h.body.databasePath}). Nothing started.`);
    return true;
  }
  if (h.answered || listeners().length > 0) {
    say(`Port ${PORT} is in use by something that is not this app. Nothing started; free the port or choose another in reminders.config.json.`);
    process.exit(1);
  }
  return false;
}

async function status() {
  const state = readState();
  const h = await health();
  if (h.ok) {
    const b = h.body;
    say(`RUNNING  ${ADDRESS}  (also http://127.0.0.1:${PORT}; this computer only)`);
    say(`Process: ${listeners().join(', ') || state?.pid || 'unknown'}${state ? `  (started ${state.started}, mode ${state.mode})` : ''}`);
    say(`Database: ${b.databasePath}${b.isolated ? '  (ISOLATED TEST DATABASE)' : '  (the live store)'}`);
    say(`Migration stage: ${b.migrationStage}; reminders: ${b.counts.total} (active ${b.counts.active}, unscheduled ${b.counts.unscheduled}, completed ${b.counts.completed}); page rereads every ${b.pollSeconds} s`);
    return 0;
  }
  if (h.answered) {
    say(`UNHEALTHY  something answers on port ${PORT} but not as a working Reminders app (HTTP ${h.status}${h.body?.error?.message ? `: ${h.body.error.message}` : ''}).`);
    return 2;
  }
  say(`STOPPED  nothing answers at ${ADDRESS}.${state && alive(state.pid) && isOurServer(state.pid) ? ` (process ${state.pid} from the last start still exists; run "stop")` : ''}`);
  return 1;
}

async function run() {
  if (await refuseIfTaken()) return 0;
  ensureBuilt();
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT), '-H', HOST], { cwd: ROOT, env: ENV, stdio: 'inherit' });
  writeState(child.pid, 'foreground');
  say(`Reminders app starting at ${ADDRESS} (foreground; it stops when this process ends).`);
  const forward = (signal) => () => child.kill(signal);
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  return new Promise((resolve) => {
    child.on('exit', (code) => {
      if (readState()?.pid === child.pid) fs.rmSync(STATE, { force: true });
      resolve(code ?? 0);
    });
  });
}

async function start() {
  if (await refuseIfTaken()) return 0;
  ensureBuilt();
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const log = fs.openSync(LOG, 'a');
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT), '-H', HOST], { cwd: ROOT, env: ENV, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.unref();
  writeState(child.pid, 'detached');
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if ((await health()).ok) {
      say(`Started (process ${child.pid}, detached). Log: ${LOG}`);
      return status();
    }
    if (!alive(child.pid)) break;
  }
  say(`The app did not come up. See ${LOG}.`);
  return 1;
}

async function stop() {
  const state = readState();
  const h = await health();
  const pids = new Set();
  if (h.ok) for (const pid of listeners()) pids.add(pid); // only a port that answers as this app
  // The recorded process is stopped only when it is verifiably this app's server. Otherwise the
  // record is stale (its PID now belongs to something else): say so and leave that process alone.
  if (state?.pid && !pids.has(state.pid) && alive(state.pid)) {
    if (isOurServer(state.pid)) pids.add(state.pid);
    else say(`The state file names process ${state.pid}, which is not this app (a stale record from an earlier start). That process was left alone and the record discarded.`);
  }
  if (pids.size === 0) {
    fs.rmSync(STATE, { force: true });
    if (h.answered && !h.ok) {
      say(`Port ${PORT} is held by something that is not this app; it was left alone.`);
      return 1;
    }
    say('Not running. Nothing to stop.');
    return 0;
  }
  for (const pid of pids) killTree(pid);
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    if (!(await health()).answered && [...pids].every((pid) => !alive(pid))) break;
  }
  fs.rmSync(STATE, { force: true });
  if ((await health()).answered) {
    say(`Still answering on port ${PORT} after stopping process ${[...pids].join(', ')}.`);
    return 1;
  }
  say(`Stopped (process ${[...pids].join(', ')}). Reminders stay saved; chat and the reminder checker keep working without the app.`);
  return 0;
}

const commands = {
  status,
  build: async () => (build(), 0),
  run,
  start,
  stop,
  restart: async () => {
    const stopped = await stop();
    if (stopped !== 0) return stopped;
    return start();
  },
};

if (!Object.hasOwn(commands, command) || !Number.isInteger(PORT) || PORT < 1) {
  say(`usage: app-control.mjs status | build | run | start | stop | restart [--port <n>]`);
  process.exitCode = 1;
} else {
  process.exitCode = await commands[command]();
}
