// Checks of the app controls (scripts/app-control.mjs) that need no running app: `stop` must never
// kill a process it cannot prove is this app, and a closed output pipe must not crash a command.
// Uses its own ports and state files (.app/server-329x.json); port 3210 and the live app are not touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTROL = path.join(ROOT, 'scripts', 'app-control.mjs');
const stateFile = (port) => path.join(ROOT, '.app', `server-${port}.json`);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};

/** Runs a control command and resolves with its exit code and output. */
function control(args, { closeStdout = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CONTROL, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    if (closeStdout) child.stdout.destroy();
    else child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

/** A long-lived process that has nothing to do with the app. */
function bystander() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  return child;
}

function writeState(port, pid) {
  fs.mkdirSync(path.dirname(stateFile(port)), { recursive: true });
  fs.writeFileSync(stateFile(port), JSON.stringify({ pid, mode: 'detached', port, started: '2026-10-01T08:00:00.000Z' }));
}

test('stop leaves a process alone when a stale state file names its PID (nothing on the port)', async () => {
  const port = 3297;
  const other = bystander();
  try {
    writeState(port, other.pid);
    const result = await control(['stop', '--port', String(port)]);
    assert.equal(alive(other.pid), true, `the unrelated process must survive; output: ${result.out}${result.err}`);
    assert.equal(result.code, 0, result.out + result.err);
    assert.match(result.out, new RegExp(`process ${other.pid}, which is not this app.*left alone`));
    assert.doesNotMatch(result.out, /Stopped \(process/);
    assert.equal(fs.existsSync(stateFile(port)), false, 'the stale state file is discarded');
  } finally {
    other.kill();
    fs.rmSync(stateFile(port), { force: true });
  }
});

test('stop leaves the port and the recorded process alone when something else listens there', async () => {
  const port = 3298;
  const other = bystander();
  const server = http.createServer((req, res) => res.end('hi'));
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  try {
    writeState(port, other.pid);
    const result = await control(['stop', '--port', String(port)]);
    assert.equal(alive(other.pid), true, 'the unrelated process must survive');
    assert.equal(server.listening, true, 'the foreign listener must survive');
    assert.equal(result.code, 1, result.out + result.err);
    assert.match(result.out, /not this app; it was left alone/);
    assert.equal(fs.existsSync(stateFile(port)), false);
  } finally {
    other.kill();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(stateFile(port), { force: true });
  }
});

test('status reports a stale state file without offering to stop the unrelated process', async () => {
  const port = 3297;
  const other = bystander();
  try {
    writeState(port, other.pid);
    const result = await control(['status', '--port', String(port)]);
    assert.equal(result.code, 1);
    assert.match(result.out, /^STOPPED/);
    assert.doesNotMatch(result.out, /run "stop"/);
  } finally {
    other.kill();
    fs.rmSync(stateFile(port), { force: true });
  }
});

test('a closed output pipe does not crash a command or change its exit code', async () => {
  const result = await control(['status', '--port', '3296'], { closeStdout: true });
  assert.equal(result.err, '', 'no stack trace is printed');
  assert.equal(result.code, 1, 'STOPPED still exits 1');
});
