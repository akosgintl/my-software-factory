#!/usr/bin/env node
// End-to-end check of the Reminders app in a real (headless) browser, against ISOLATED data:
// a scratch SQLite database, its own port (3211) and a fixed test clock. The live database and the
// live app on port 3210 are never touched.
//
//   node tests/e2e/run.mjs            (npm run test:e2e)   needs a production build: node scripts/app-control.mjs build
//
// "Chat" here is the chat's command (reminders-cli.mjs, what reminders.sh runs) and "checker" is its
// due/ack commands: the same shared operations the real chat and the real native checker use, but
// not the real conversation. Receipt of a message in the real chat is NOT established by this file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tests', 'e2e', 'output');
const PORT = 3211;
const BASE = `http://localhost:${PORT}`;
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'reminders-e2e-'));
const DB = path.join(SCRATCH, 'e2e.db');
const POLL_MS = 5000;
const WITHIN = POLL_MS + 4000; // the documented refresh interval plus a margin for the request itself

process.env.REMINDERS_DB = DB;
const { setProjectRoot } = await import('../../lib/reminders/paths.mjs');
setProjectRoot(ROOT);
const { openDatabase } = await import('../../lib/reminders/db.mjs');
const ops = await import('../../lib/reminders/ops.mjs');

let clock = '2026-10-13T12:00:00Z';
const setClock = (iso) => {
  clock = iso;
  process.env.REMINDERS_TEST_NOW = iso;
};
setClock(clock);

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err });
    console.log(`FAIL  ${name}\n      ${String(err && err.message ? err.message : err).split('\n').join('\n      ')}`);
  }
};

/** The chat/checker command, as reminders.sh runs it. */
function chat(...args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'reminders-cli.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, REMINDERS_DB: DB, REMINDERS_TEST_NOW: clock } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

let server = null;
function startServer() {
  server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'app-control.mjs'), 'run', '--port', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, REMINDERS_DB: DB, REMINDERS_TEST_NOW: clock },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
}
function stopServer() {
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'app-control.mjs'), 'stop', '--port', String(PORT)], { cwd: ROOT, encoding: 'utf8' });
  server = null;
}
async function waitHealthy(ms = 40000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return res.json();
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('the test server did not come up');
}
const api = async (pathname, init) => {
  const res = await fetch(`${BASE}${pathname}`, init);
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
};
/** A raw request to the test server with a chosen Host header (fetch does not allow setting it). */
const withHost = (pathname, host) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method: 'GET', headers: { Host: host, Accept: 'text/html,application/json' } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
  });
const active = (page) => page.evaluate(() => ({ id: document.activeElement?.id ?? '', tag: document.activeElement?.tagName ?? '', text: (document.activeElement?.textContent?.trim() ?? '').slice(0, 80) }));
const noOverflow = async (page, label) => {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert.ok(m.scroll <= m.client, `${label}: the page scrolls sideways (${m.scroll}px content in ${m.client}px)`);
};
/** Displayed and inside the window as it is scrolled right now: being somewhere in the page is not enough. */
const onScreen = async (page, locator, label) => {
  let seen = 'not in the page';
  for (const until = Date.now() + 2000; Date.now() < until; await page.waitForTimeout(100)) {
    const box = (await locator.count()) === 1 && (await locator.isVisible()) ? await locator.boundingBox() : null;
    const { height } = page.viewportSize();
    if (box && box.y >= 0 && box.y + Math.min(box.height, height) <= height + 1) return;
    seen = box ? `at y ${Math.round(box.y)} to ${Math.round(box.y + box.height)} in a window ${height}px tall` : 'not displayed';
  }
  assert.fail(`${label}: not on screen (${seen})`);
};

// ---------- seed (all synthetic) ----------

openDatabase({ create: true }).close();
ops.setDefaultTimezone('Europe/Budapest');
const LONG = `SYNTHETIC long text: ${'check the migration notes and the delivery log before the Friday review, then '.repeat(6)}open https://example.invalid/a/very/long/path/${'segment-'.repeat(30)}end`;
const seed = {};
seed.note = ops.createReminder({ text: 'SYNTHETIC renew the car insurance' }).reminder.id;
setClock('2026-10-13T08:00:00Z');
seed.done = ops.createReminder({ text: 'SYNTHETIC book the meeting room', schedule: { tz: 'America/New_York', at: '2026-10-13 05:00' } }).reminder.id;
seed.uncertain = ops.createReminder({ text: 'SYNTHETIC water the plants', schedule: { rule: 'every:6h', at: '2026-10-13 11:30' } }).reminder.id;
setClock('2026-10-13T09:00:30Z');
const first = ops.selectDue({ run: 'e2e-seed' });
ops.acknowledge(seed.done, first.items.find((i) => i.id === seed.done).occurrence);
setClock('2026-10-13T09:31:00Z');
ops.selectDue({ run: 'e2e-seed-2' }); // selects "water the plants" and is never acknowledged
setClock('2026-10-13T12:00:00Z');
ops.selectDue({ run: 'e2e-seed-3' }); // older than the grace period: reported once as uncertain
seed.weekly = ops.createReminder({ text: 'SYNTHETIC send the weekly report', schedule: { rule: 'weekly:MO,TH@08:30' } }).reminder.id;
seed.once = ops.createReminder({ text: 'SYNTHETIC call the dentist about Thursday', schedule: { at: '2026-10-14 09:00' } }).reminder.id;
seed.monthly = ops.createReminder({ text: 'SYNTHETIC pay the rent', schedule: { tz: 'America/New_York', rule: 'monthly:31@08:00' } }).reminder.id;
seed.long = ops.createReminder({ text: LONG, schedule: { rule: 'every:90m' } }).reminder.id;

fs.mkdirSync(OUT, { recursive: true });
startServer();
const healthAtStart = await waitHealthy();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Budapest', locale: 'en-GB' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});

const row = (id) => page.locator(`#row-${id}`);
const shot = (name, target = page) => target.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

try {
  await check('isolation: the test server reads the scratch database, not the live one', async () => {
    assert.equal(path.resolve(healthAtStart.databasePath).toLowerCase(), path.resolve(DB).toLowerCase());
    assert.equal(healthAtStart.isolated, true);
    assert.notEqual(path.resolve(healthAtStart.canonicalPath).toLowerCase(), path.resolve(DB).toLowerCase());
  });

  await check('responses are never cached and foreign sites are refused', async () => {
    const list = await api('/api/reminders');
    assert.match(list.headers.get('cache-control') ?? '', /no-store/);
    const html = await fetch(`${BASE}/`);
    assert.match(html.headers.get('cache-control') ?? '', /no-store/);
    const foreign = await api('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: JSON.stringify({ form: { text: 'SYNTHETIC should never save', kind: 'none' } }) });
    assert.equal(foreign.status, 403);
    const form = await api('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(form.status, 415);
    assert.equal(ops.listReminders().reminders.some((r) => r.text.includes('should never save')), false);

    // A foreign name pointed at 127.0.0.1 (DNS rebinding) arrives with that name in the Host header.
    // Neither the API nor the server-rendered page, which contains every reminder, may answer it.
    for (const pathname of ['/', `/?r=${seed.note}`, '/api/reminders', '/api/health']) {
      const refused = await withHost(pathname, `evil.example:${PORT}`);
      assert.equal(refused.status, 403, `${pathname} with a foreign Host`);
      assert.doesNotMatch(refused.text, /SYNTHETIC|R-\d{4}/, `${pathname} with a foreign Host must not carry reminders`);
      assert.match(refused.headers['cache-control'] ?? '', /no-store/);
    }
    for (const host of [`localhost:${PORT}`, `127.0.0.1:${PORT}`]) {
      const served = await withHost('/', host);
      assert.equal(served.status, 200, `the page answers on ${host}`);
      assert.match(served.text, /SYNTHETIC renew the car insurance/);
    }
  });

  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Reminders', level: 1 }).waitFor();

  await check('scanning: groups, IDs, due time, named timezone and recurrence are shown', async () => {
    assert.equal(await page.getByText('Test data, not your reminders').count(), 1);
    for (const title of ['Needs your attention', 'Scheduled', 'Not scheduled', 'Delivered']) assert.equal(await page.getByRole('heading', { name: new RegExp(`^${title}`) }).count(), 1, title);
    const weekly = await row(seed.weekly).innerText();
    assert.match(weekly, new RegExp(seed.weekly));
    assert.match(weekly, /Thu 2026-10-15 08:30/);
    assert.match(weekly, /Europe\/Budapest/);
    assert.match(weekly, /Every Monday and Thursday at 08:30/);
    assert.match(await row(seed.monthly).innerText(), /Sat 2026-10-31 08:00[\s\S]*America\/New_York[\s\S]*Monthly on day 31 at 08:00/);
    assert.match(await row(seed.note).innerText(), /No time set\. Never sent\./);
    assert.match(await row(seed.done).innerText(), /Delivered[\s\S]*was due Tue 2026-10-13 05:00[\s\S]*America\/New_York/);
    assert.match(await row(seed.uncertain).innerText(), /Delivery uncertain/);
    await shot('desktop-list');
  });

  await check('details: stable ID, status, due time with offset, timezone, recurrence, destination', async () => {
    await row(seed.once).click();
    const detail = page.locator('.detail');
    await detail.waitFor();
    const text = await detail.innerText();
    assert.match(text, new RegExp(seed.once));
    assert.match(text, /SYNTHETIC call the dentist about Thursday/);
    assert.match(text, /Scheduled/);
    assert.match(text, /Wed 2026-10-14 09:00 \(UTC\+02:00\)/);
    assert.match(text, /Europe\/Budapest/);
    assert.match(text, /Once\./);
    assert.match(text, /reminder checker/);
    assert.match(text, /2026-10-14 07:00 UTC/);
    assert.match(text, /Reminder ID\s+R-\d{4}/);
    assert.match(page.url(), new RegExp(`\\?r=${seed.once}`));
    await shot('desktop-detail');
  });

  await check('long text wraps without sideways scrolling (desktop)', async () => {
    await row(seed.long).click();
    await page.locator('.detail').getByText('SYNTHETIC long text').waitFor();
    await noOverflow(page, 'desktop detail of the long reminder');
    assert.ok((await page.locator('.detail-text').innerText()).endsWith('end'), 'the full text is shown in details');
    await shot('desktop-long-text');
  });

  let created = null;
  await check('invalid input: explained, entries kept, nothing saved', async () => {
    const before = ops.listReminders().reminders.length;
    await page.getByRole('button', { name: 'New reminder' }).first().click();
    await page.getByRole('heading', { name: 'New reminder' }).waitFor();
    await page.getByRole('button', { name: 'Save reminder' }).click();
    await page.getByText('Write what you want to be reminded of.').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'f-text', 'focus moves to the first refused field');

    await page.getByLabel('Remind me to').fill('SYNTHETIC browser-created reminder');
    await page.getByLabel('When').selectOption('once');
    await page.getByRole('button', { name: 'Save reminder' }).click();
    await page.getByText('Choose the date.').waitFor();
    await page.getByText('Enter the time, for example 09:00.').waitFor();
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC browser-created reminder');

    await page.getByLabel('Date', { exact: true }).fill('2026-10-12'); // yesterday on the test clock
    await page.getByLabel('Time', { exact: true }).fill('09:00');
    await page.getByLabel('Timezone', { exact: true }).fill('Mars/Olympus');
    await page.getByRole('button', { name: 'Save reminder' }).click();
    await page.locator('#f-tz-error').getByText(/Unknown timezone 'Mars\/Olympus'/).waitFor();
    assert.equal(await page.getByLabel('Timezone', { exact: true }).inputValue(), 'Mars/Olympus');

    await page.getByLabel('Timezone', { exact: true }).fill('Europe/Budapest');
    await page.getByRole('button', { name: 'Save reminder' }).click();
    await page.locator('#f-date-error').getByText(/is not in the future/).waitFor();
    assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2026-10-12');
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC browser-created reminder');
    await shot('desktop-form-errors');
    assert.equal(ops.listReminders().reminders.length, before, 'no record was saved by the refused attempts');
  });

  await check('ambiguous time: a clock-change note is shown before saving', async () => {
    await page.getByLabel('Date', { exact: true }).fill('2027-03-28');
    await page.getByLabel('Time', { exact: true }).fill('02:30');
    await page.locator('.preview').getByText(/does not exist on that date/).waitFor();
    await page.locator('.preview').getByText(/Sun 2027-03-28 03:30 \+02:00/).first().waitFor();
  });

  await check('browser create -> committed values confirmed -> chat reads the same ID and values', async () => {
    await page.getByLabel('Date', { exact: true }).fill('2026-10-16');
    await page.getByLabel('Time', { exact: true }).fill('17:45');
    await page.locator('.preview').getByText(/Fri 2026-10-16 17:45 \+02:00/).waitFor();
    await page.getByRole('button', { name: 'Save reminder' }).click();
    const notice = page.locator('.list-notice');
    await notice.getByText(/Created\./).waitFor();
    const text = await notice.innerText();
    created = /R-\d{4}/.exec(text)[0];
    assert.match(text, /Next due Fri 2026-10-16 17:45 \(UTC\+02:00, Europe\/Budapest\)/);
    await onScreen(page, notice, 'the "Created." notice on a wide window');
    await shot('desktop-notice-created');
    const listed = chat('list').out;
    assert.match(listed, new RegExp(`${created}: SYNTHETIC browser-created reminder\\n    active; next due Fri 2026-10-16 17:45 \\+02:00 \\(Europe/Budapest\\) = 2026-10-16T15:45:00Z; rule once`));
  });

  await check('chat modifies and reschedules the browser-created record -> the open page shows it within the interval', async () => {
    assert.equal(chat('modify', created, 'SYNTHETIC browser-created, renamed in chat').code, 0);
    assert.equal(chat('schedule', created, '--tz', 'America/New_York', '--rule', 'daily@07:15').code, 0);
    await row(created).getByText('SYNTHETIC browser-created, renamed in chat').waitFor({ timeout: WITHIN });
    await row(created).getByText('Every day at 07:15').waitFor({ timeout: WITHIN });
    const detail = await page.locator('.detail').innerText();
    assert.match(detail, /renamed in chat/);
    assert.match(detail, /America\/New_York/);
  });

  let chatMade = null;
  await check('chat create -> appears in the open page (no reload) within the interval, same ID and values', async () => {
    const added = chat('add', 'SYNTHETIC chat-created reminder', '--at', '2026-10-20 10:00');
    assert.equal(added.code, 0, added.err);
    chatMade = /Added (R-\d{4})/.exec(added.out)[1];
    await row(chatMade).waitFor({ timeout: WITHIN });
    const text = await row(chatMade).innerText();
    assert.match(text, /SYNTHETIC chat-created reminder/);
    assert.match(text, /Tue 2026-10-20 10:00[\s\S]*Europe\/Budapest[\s\S]*Once/);
  });

  await check('browser modify of the chat-created record -> chat reads the fresh values', async () => {
    await row(chatMade).click();
    await page.locator('.detail').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('heading', { name: `Edit ${chatMade}` }).waitFor();
    await page.getByLabel('Remind me to').fill('SYNTHETIC chat-created, edited in the browser');
    await page.getByLabel('When').selectOption('weekly');
    await page.getByLabel('Friday').check();
    await page.getByLabel('Time of day').fill('16:00');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.locator('.list-notice').getByText(/Changes saved\./).waitFor();
    const listed = chat('list').out;
    assert.match(listed, new RegExp(`${chatMade}: SYNTHETIC chat-created, edited in the browser\\n    active; next due Fri 2026-10-16 16:00 \\+02:00 \\(Europe/Budapest\\) = 2026-10-16T14:00:00Z; rule weekly:FR@16:00`));
  });

  await check('an in-progress edit survives refreshes while chat and the checker change records', async () => {
    await row(seed.weekly).click();
    await page.locator('.detail').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('heading', { name: `Edit ${seed.weekly}` }).waitFor();
    await page.getByLabel('Remind me to').fill('SYNTHETIC half-typed edit that must survive');
    await page.getByLabel('Time of day').fill('10:10');

    // chat changes another record and this very record; the checker selects and acknowledges a due one
    assert.equal(chat('modify', seed.note, 'SYNTHETIC renew the car insurance (changed in chat)').code, 0);
    assert.equal(chat('modify', seed.weekly, 'SYNTHETIC weekly report, changed in chat meanwhile').code, 0);
    setClock('2026-10-14T07:00:20Z');
    const due = chat('due', '--run', 'e2e-checker');
    assert.match(due.out, new RegExp(`DELIVER ${seed.once} 2026-10-14T07:00:00Z`));
    assert.match(due.out, new RegExp(`MESSAGE Reminder ${seed.once}: SYNTHETIC call the dentist about Thursday`));
    assert.equal(chat('ack', seed.once, '2026-10-14T07:00:00Z').code, 0);

    await row(seed.note).getByText('(changed in chat)').waitFor({ timeout: WITHIN });
    await row(seed.once).getByText('Delivered').waitFor({ timeout: WITHIN });
    await page.getByText(`${seed.weekly} was changed`).waitFor({ timeout: WITHIN });
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC half-typed edit that must survive');
    assert.equal(await page.getByLabel('Time of day').inputValue(), '10:10');
    await page.waitForTimeout(POLL_MS + 1500); // one more full refresh cycle
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC half-typed edit that must survive');
    await shot('desktop-edit-changed-elsewhere');

    // saving against the stale revision is refused, not merged
    const stale = await api(`/api/reminders/${seed.weekly}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRev: 1, text: 'SYNTHETIC stale overwrite' }) });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'conflict');
    assert.match(chat('list').out, /weekly report, changed in chat meanwhile/);

    await page.getByRole('button', { name: 'Load the latest values' }).click();
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC weekly report, changed in chat meanwhile');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  // "Keep my entries" after a change made elsewhere: what the user changed stays, what the user did
  // not change shows the latest value, and Save stores exactly what the form shows.
  {
    const stored = (id) => JSON.parse(chat('list', '--json').out).reminders.find((r) => r.id === id);
    const text = page.getByLabel('Remind me to');
    const openEdit = async (id) => {
      await row(id).waitFor({ timeout: WITHIN });
      await row(id).click();
      await page.locator('.detail').getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('heading', { name: `Edit ${id}` }).waitFor();
    };
    const keepMine = async (id) => {
      await page.getByText(`${id} was changed`).waitFor({ timeout: WITHIN });
      await page.getByRole('button', { name: 'Keep my entries' }).click();
      await page.getByText(`${id} was changed`).waitFor({ state: 'detached' });
    };
    const save = async () => {
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.locator('.list-notice').getByText(/Changes saved\./).waitFor();
      return page.locator('.list-notice').innerText();
    };
    /** Runs one case on its own synthetic reminder; a failure part-way never leaves a form or the record behind. */
    const keepCase = (name, schedule, fn) =>
      check(name, async () => {
        const id = ops.createReminder({ text: 'SYNTHETIC keep-my-entries case', schedule }).reminder.id;
        try {
          await openEdit(id);
          await fn(id);
        } finally {
          if (await page.locator('form.form').count()) {
            await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
            await page.getByRole('button', { name: 'Discard entries' }).click({ timeout: 1000 }).catch(() => {});
          }
          chat('remove', id);
        }
      });

    await keepCase('"Keep my entries", text typed here and schedule changed in chat: the form shows the schedule that Save stores', { at: '2027-03-10 09:00' }, async (id) => {
      await text.fill('SYNTHETIC text typed in the browser');
      assert.equal(chat('schedule', id, '--at', '2027-05-05 17:45').code, 0);
      await page.getByText(`${id} was changed`).waitFor({ timeout: WITHIN });
      assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2027-03-10', 'nothing in the form changes before the user chooses');
      await keepMine(id);
      assert.equal(await text.inputValue(), 'SYNTHETIC text typed in the browser', 'the typed text is kept');
      assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2027-05-05', 'the untouched date shows the latest value');
      assert.equal(await page.getByLabel('Time', { exact: true }).inputValue(), '17:45', 'the untouched time shows the latest value');
      await page.locator('.preview').getByText('The schedule is unchanged and will be kept as it is.').waitFor();
      assert.equal((await active(page)).id, 'form-title', 'after "Keep my entries", focus is on the form heading, not the page body');
      assert.match(await save(), /Next due Wed 2027-05-05 17:45 \(UTC\+02:00, Europe\/Budapest\)/);
      const rec = stored(id);
      assert.equal(rec.text, 'SYNTHETIC text typed in the browser');
      assert.match(rec.nextLocal, /2027-05-05 17:45/, 'the stored schedule is the one the form displayed');
    });

    await keepCase('"Keep my entries", time typed here and text changed in chat: the form shows the text that Save stores', { rule: 'weekly:MO@08:30' }, async (id) => {
      await page.getByLabel('Time of day').fill('10:10');
      assert.equal(chat('modify', id, 'SYNTHETIC text rewritten in chat').code, 0);
      await keepMine(id);
      assert.equal(await text.inputValue(), 'SYNTHETIC text rewritten in chat', 'the untouched text shows the latest value');
      assert.equal(await page.getByLabel('Time of day').inputValue(), '10:10', 'the typed time is kept');
      assert.equal(await page.getByLabel('Monday').isChecked(), true);
      assert.match(await save(), /Every Monday at 10:10/);
      const rec = stored(id);
      assert.equal(rec.text, 'SYNTHETIC text rewritten in chat', 'the stored text is the one the form displayed');
      assert.equal(rec.rule, 'weekly:MO@10:10');
    });

    await keepCase('"Keep my entries", text and time typed here and both changed in chat: every entry is kept and saved', { rule: 'weekly:MO@08:30' }, async (id) => {
      await text.fill('SYNTHETIC both typed in the browser');
      await page.getByLabel('Time of day').fill('11:20');
      assert.equal(chat('modify', id, 'SYNTHETIC text rewritten in chat').code, 0);
      assert.equal(chat('schedule', id, '--rule', 'weekly:TU@07:00').code, 0);
      await page.locator('.form .banner-warn').getByText(/rewritten in chat[\s\S]*Every Tuesday at 07:00/).waitFor({ timeout: WITHIN });
      await keepMine(id);
      assert.equal(await text.inputValue(), 'SYNTHETIC both typed in the browser');
      assert.equal(await page.getByLabel('Time of day').inputValue(), '11:20');
      assert.equal(await page.getByLabel('Monday').isChecked(), true);
      assert.equal(await page.getByLabel('Tuesday').isChecked(), false);
      await save();
      const rec = stored(id);
      assert.equal(rec.text, 'SYNTHETIC both typed in the browser');
      assert.equal(rec.rule, 'weekly:MO@11:20');
    });
  }

  await check('result notice: a clock-change note is a capitalised sentence, as in the preview', async () => {
    await page.getByRole('button', { name: 'New reminder' }).first().click();
    await page.getByLabel('Remind me to').fill('SYNTHETIC one-off in the missing hour');
    await page.getByLabel('When').selectOption('once');
    await page.getByLabel('Date', { exact: true }).fill('2027-03-28');
    await page.getByLabel('Time', { exact: true }).fill('02:30');
    await page.locator('.preview').getByText(/^That local time does not exist on that date/).waitFor();
    await page.getByRole('button', { name: 'Save reminder' }).click();
    const notice = page.locator('.list-notice');
    await notice.getByText(/Created\./).waitFor();
    const said = await notice.locator('p').innerText();
    assert.equal(chat('remove', /R-\d{4}/.exec(said)[0]).code, 0);
    assert.match(said, /Europe\/Budapest\)\. Once\. That local time does not exist on that date in Europe\/Budapest \(clocks go forward\); it was moved forward to Sun 2027-03-28 03:30 \+02:00\./);
    assert.doesNotMatch(said, /NOTE:|\. [a-z]/, 'no label and no sentence starting in lower case');
  });

  await check('leaving a form with unsaved entries asks first', async () => {
    await page.getByRole('button', { name: 'New reminder' }).first().click();
    await page.getByLabel('Remind me to').fill('SYNTHETIC unsaved');
    await row(seed.note).click();
    await page.getByText('This form has entries that are not saved.').waitFor();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC unsaved');
    await row(seed.note).click();
    await page.getByRole('button', { name: 'Discard entries' }).click();
    await page.locator('.detail').getByText('(changed in chat)').waitFor();
  });

  await check('checker: a recurring reminder advances to the correct next occurrence and the page shows it', async () => {
    setClock('2026-10-15T06:30:10Z'); // Thu 08:30 Budapest
    const due = chat('due', '--run', 'e2e-checker-2');
    assert.match(due.out, new RegExp(`DELIVER ${seed.weekly} 2026-10-15T06:30:00Z`));
    await row(seed.weekly).getByText('Being delivered').waitFor({ timeout: WITHIN });
    const ack = chat('ack', seed.weekly, '2026-10-15T06:30:00Z');
    assert.match(ack.out, /advanced to Mon 2026-10-19 08:30 \+02:00 \(Europe\/Budapest\) = 2026-10-19T06:30:00Z; rule weekly:MO,TH@08:30/);
    await row(seed.weekly).getByText('Mon 2026-10-19 08:30').waitFor({ timeout: WITHIN });
  });

  await check('stopping in the browser makes a due reminder ineligible for the checker', async () => {
    // created (the browser-created one) is daily at 07:15 New York = 11:15Z; stop it before it is due
    await row(created).click();
    await page.locator('.detail').getByRole('button', { name: 'Stop sending' }).click();
    await page.getByText(`Stop sending ${created}?`).waitFor();
    await page.locator('.confirm').getByRole('button', { name: 'Stop sending' }).click();
    await page.locator('.list-notice').getByText(/Stopped\./).waitFor();
    await page.locator('.detail').getByText('Not scheduled').first().waitFor();
    setClock('2026-10-15T11:16:00Z');
    const due = chat('due', '--run', 'e2e-checker-3');
    assert.doesNotMatch(due.out, new RegExp(created), 'a stopped reminder must not be selected');
    assert.match(chat('list').out, new RegExp(`${created}: SYNTHETIC browser-created, renamed in chat\\n(?!    )`));
  });

  await check('removing in the browser deletes the record; chat no longer has it; removal in chat shows in the page', async () => {
    await row(seed.monthly).click();
    await page.locator('.detail').getByRole('button', { name: 'Remove' }).click();
    await page.getByText(`Remove ${seed.monthly} for good?`).waitFor();
    await page.getByRole('button', { name: 'Remove reminder' }).click();
    await page.locator('.list-notice').getByText(`Removed ${seed.monthly}.`).waitFor();
    assert.equal(await row(seed.monthly).count(), 0);
    assert.doesNotMatch(chat('list').out, new RegExp(seed.monthly));
    assert.equal(chat('ack', seed.monthly, '2026-10-31T12:00:00Z').code, 4, 'an acknowledgement for a removed reminder is refused');

    await row(created).click();
    await page.locator('.detail').waitFor();
    assert.equal(chat('remove', created).code, 0);
    await page.getByText(`${created} is not saved`).waitFor({ timeout: WITHIN });
    assert.equal(await row(created).count(), 0);
    await page.getByRole('button', { name: 'Back to all reminders' }).click();
  });

  await check('keyboard only: reach the controls, open a reminder, create one', async () => {
    await page.goto(BASE);
    await page.getByRole('heading', { name: 'Reminders', level: 1 }).waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Refresh');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'New reminder');
    await page.keyboard.press('Tab');
    const firstRow = await page.evaluate(() => document.activeElement?.id ?? '');
    assert.match(firstRow, /^row-R-\d{4}$/, 'the next stop is the first reminder');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid', 'keyboard focus is visible');
    await page.keyboard.press('Enter');
    await page.locator('.detail').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'detail-title', 'focus moves to the opened details');

    await page.keyboard.press('Shift+Tab'); // hidden "All reminders" back button is skipped on desktop; go to the header instead
    await page.getByRole('button', { name: 'New reminder' }).first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'New reminder' }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'form-title');
    await page.keyboard.press('Tab');
    await page.keyboard.type('SYNTHETIC made with the keyboard');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Every day'); // typeahead in the native select
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'f-time');
    await page.keyboard.type('6:45'); // a plain text field: typed as shown everywhere else, padded to 06:45 on leaving it
    for (let i = 0; i < 12 && (await page.evaluate(() => document.activeElement?.textContent?.trim())) !== 'Save reminder'; i++) await page.keyboard.press('Tab');
    assert.equal(await page.locator('#f-time').inputValue(), '06:45');
    await page.keyboard.press('Enter');
    await page.locator('.list-notice').getByText(/Created\./).waitFor();
    assert.match(chat('list').out, /SYNTHETIC made with the keyboard\n    active; next due \w{3} 2026-10-1\d 06:45 \+02:00 \(Europe\/Budapest\) = [^;]+; rule daily@06:45/);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'detail-title', 'after saving, focus is on the saved reminder');
  });

  await check('keyboard focus is never dropped: cancelled and completed confirmations, dismissed notice', async () => {
    // continues from the reminder just created with the keyboard: its details are open, the "Created." notice is shown
    const madeId = await page.locator('#detail-title').innerText();
    const detail = page.locator('.detail');
    const press = async (name, scope = detail) => {
      await scope.getByRole('button', { name, exact: true }).focus();
      await page.keyboard.press('Enter');
    };

    await press('Dismiss', page.locator('.list-notice'));
    assert.equal(await page.locator('.list-notice').count(), 0);
    assert.equal((await active(page)).id, `row-${madeId}`, 'after Dismiss, focus is on the row of the open reminder');

    await press('Remove');
    assert.equal((await active(page)).text, 'Remove reminder', 'the confirming button takes focus');
    await page.keyboard.press('Tab');
    assert.equal((await active(page)).text, 'Keep it');
    await page.keyboard.press('Enter');
    assert.equal((await active(page)).text, 'Remove', 'after "Keep it", focus is back on Remove');

    await press('Stop sending');
    assert.equal((await active(page)).text, 'Stop sending');
    assert.equal(await page.locator('.confirm').count(), 1);
    await page.keyboard.press('Tab');
    assert.equal((await active(page)).text, 'Keep the schedule');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.confirm').count(), 0);
    assert.equal((await active(page)).text, 'Stop sending', 'after "Keep the schedule", focus is back on Stop sending');

    await page.keyboard.press('Enter'); // open the confirmation again and go through with it
    await page.keyboard.press('Enter');
    await page.locator('.list-notice').getByText(/Stopped\./).waitFor();
    await detail.getByText('Not scheduled').first().waitFor();
    assert.equal((await active(page)).id, 'detail-title', 'after a completed stop, focus is on the record heading');
    await page.keyboard.press('Tab');
    assert.equal((await active(page)).text, 'Edit', 'the next stop is the record\'s first action, not the top of the page');

    await press('Dismiss', page.locator('.list-notice'));
    assert.equal((await active(page)).id, `row-${madeId}`);
    assert.notEqual((await active(page)).tag, 'BODY');

    // with nothing open, Dismiss still lands on something: remove through the page, then dismiss "Removed"
    await press('Remove');
    await page.keyboard.press('Enter');
    await page.locator('.list-notice').getByText(`Removed ${madeId}.`).waitFor();
    assert.notEqual((await active(page)).tag, 'BODY', 'after a completed removal focus is in the page');
    await press('Dismiss', page.locator('.list-notice'));
    assert.match((await active(page)).id, /^row-R-\d{4}$/, 'after Dismiss with nothing open, focus is on the first reminder');
  });

  await check('keyboard focus is never dropped: "Keep editing" in the unsaved-entries prompt, timezone controls', async () => {
    const enterOn = async (name, scope = page.locator('.panel-pane')) => {
      await scope.getByRole('button', { name, exact: true }).focus();
      await page.keyboard.press('Enter');
    };
    const guard = page.locator('.guard');
    await row(seed.note).click();
    await enterOn('Edit');
    await page.getByRole('heading', { name: `Edit ${seed.note}` }).waitFor();
    await page.getByLabel('Remind me to').fill('SYNTHETIC unsaved, typed before Cancel');

    // opened from Cancel with the keyboard
    await enterOn('Cancel');
    await guard.waitFor();
    assert.equal((await active(page)).text, 'Keep editing', 'the prompt takes focus');
    await page.keyboard.press('Enter');
    assert.equal(await guard.count(), 0);
    assert.equal((await active(page)).text, 'Cancel', 'after "Keep editing", focus is back on Cancel, which opened the prompt');
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC unsaved, typed before Cancel');

    // the same with the mouse
    await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
    await guard.getByRole('button', { name: 'Keep editing' }).click();
    assert.equal(await guard.count(), 0);
    assert.equal((await active(page)).text, 'Cancel', 'after a clicked "Keep editing", focus is back on Cancel');

    // opened from a row of the list
    await row(seed.weekly).focus();
    await page.keyboard.press('Enter');
    await guard.waitFor();
    await page.keyboard.press('Enter');
    assert.equal((await active(page)).id, `row-${seed.weekly}`, 'after "Keep editing", focus is back on the row that opened the prompt');

    // "Use this browser's timezone" removes itself: focus goes to the field it filled
    await page.getByLabel('When').selectOption('daily');
    await page.getByLabel('Timezone', { exact: true }).fill('');
    await enterOn('Use Europe/Budapest, this browser’s timezone');
    assert.equal(await page.getByLabel('Timezone', { exact: true }).inputValue(), 'Europe/Budapest');
    assert.equal((await active(page)).id, 'f-tz', 'after "Use this browser\'s timezone", focus is in the timezone field');

    await enterOn('Cancel');
    await guard.waitFor();
    await page.keyboard.press('Tab');
    assert.equal((await active(page)).text, 'Discard entries');
    await page.keyboard.press('Enter');
    await page.locator('.detail').waitFor();
    assert.equal((await active(page)).id, 'detail-title', 'after "Discard entries", focus is on the record heading');

    // the default timezone in the footer: Cancel removes the form it sits in
    await enterOn('Change', page.locator('.foot'));
    assert.equal((await active(page)).id, 'default-tz');
    await enterOn('Cancel', page.locator('.foot'));
    assert.equal(await page.locator('#default-tz').count(), 0);
    assert.equal((await active(page)).text, 'Change', 'after Cancel in the default timezone form, focus is back on Change');
  });

  await check('text contrast is at least 4.5:1 on list, details, form, banners and header', async () => {
    await page.goto(`${BASE}/?r=${seed.weekly}`);
    await page.locator('.detail').waitFor();
    const measure = () =>
      page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rgba = (css) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return { r, g, b, a: a / 255 };
        };
        const lum = ({ r, g, b }) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const background = (el) => {
          for (let node = el; node; node = node.parentElement) {
            const c = rgba(getComputedStyle(node).backgroundColor);
            if (c.a > 0.99) return c;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        };
        const low = [];
        const selector = 'h1, h2, h3, p, dt, dd, label, legend, .btn, .row-text, .row-meta span, .callno, .status, .hint, .field-error, input, select, textarea, .tab-count, .shell-status, time';
        for (const el of document.querySelectorAll(selector)) {
          if (!el.getClientRects().length || !el.textContent.trim()) continue;
          const fg = rgba(getComputedStyle(el).color);
          const bg = background(el);
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
          const ratio = (a + 0.05) / (b + 0.05);
          if (ratio < 4.5) low.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}"`);
        }
        return [...new Set(low)];
      });
    assert.deepEqual(await measure(), [], 'list and details');
    await page.locator('.detail').getByRole('button', { name: 'Remove' }).click();
    assert.deepEqual(await measure(), [], 'remove confirmation');
    await page.getByRole('button', { name: 'Keep it' }).click();
    await page.getByRole('button', { name: 'New reminder' }).first().click();
    await page.getByLabel('When').selectOption('weekly');
    await page.getByRole('button', { name: 'Save reminder' }).click();
    await page.getByText('Choose at least one weekday.').waitFor();
    assert.deepEqual(await measure(), [], 'form with errors');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await check('control boundaries are at least 3:1: fields, selects, weekday chips, buttons, card and list outlines', async () => {
    // WCAG 2.2 non-text contrast. An outlined control needs its border to stand out from what is
    // around it and from its own fill; a filled control needs its fill to stand out from what is around it.
    const measure = () =>
      page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rgba = (css) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return { r, g, b, a: a / 255 };
        };
        const lum = ({ r, g, b }) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (x, y) => {
          const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
          return (a + 0.05) / (b + 0.05);
        };
        const background = (el) => {
          for (let node = el; node; node = node.parentElement) {
            const c = rgba(getComputedStyle(node).backgroundColor);
            if (c.a > 0.99) return c;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        };
        const low = [];
        let seen = 0;
        // .btn-quiet is a text button (underlined words, no box), so it has no boundary to measure
        const controls = '.btn:not(.btn-quiet), input:not([type=checkbox]), select, textarea, .day';
        const outlines = '.card, .rows, .tab, .empty';
        for (const el of document.querySelectorAll(`${controls}, ${outlines}`)) {
          if (!el.getClientRects().length) continue;
          seen++;
          const style = getComputedStyle(el);
          const outside = background(el.parentElement);
          const own = rgba(style.backgroundColor);
          const fill = own.a > 0.99 ? own : outside;
          const edge = parseFloat(style.borderTopWidth) > 0 && rgba(style.borderTopColor).a > 0.99 ? rgba(style.borderTopColor) : fill;
          const vsOutside = ratio(edge, outside);
          const vsFill = ratio(edge, fill);
          // a card, list or tab outline only has to stand out from the page around it
          const ok = vsOutside >= 3 && (el.matches(outlines) || vsFill >= 3 || ratio(fill, outside) >= 3);
          if (!ok) low.push(`${el.tagName.toLowerCase()}.${String(el.className).trim() || el.id}: edge ${vsOutside.toFixed(2)} against its surroundings, ${vsFill.toFixed(2)} against its fill`);
        }
        return { low: [...new Set(low)], seen };
      });
    const settle = () => page.waitForTimeout(250); // colour transitions take 150 ms
    await page.mouse.move(0, 0);
    await page.goto(`${BASE}/?r=${seed.weekly}`);
    await page.locator('.detail').waitFor();
    await settle();
    let m = await measure();
    assert.ok(m.seen >= 8, `list and details were measured (${m.seen} elements)`);
    assert.deepEqual(m.low, [], 'list and details');

    await page.locator('.detail').getByRole('button', { name: 'Stop sending' }).click();
    await page.mouse.move(0, 0);
    await settle();
    assert.deepEqual((await measure()).low, [], 'stop-sending confirmation');
    await page.getByRole('button', { name: 'Keep the schedule' }).click();
    await page.locator('.detail').getByRole('button', { name: 'Remove' }).click();
    await page.mouse.move(0, 0);
    await settle();
    assert.deepEqual((await measure()).low, [], 'remove confirmation');
    await page.getByRole('button', { name: 'Keep it' }).click();

    await page.getByRole('button', { name: 'New reminder' }).first().click();
    for (const kind of ['weekly', 'monthly', 'every', 'once']) {
      await page.getByLabel('When').selectOption(kind);
      if (kind === 'weekly') await page.getByLabel('Friday').check();
      await page.locator('#form-title').focus(); // no field holds focus, so resting borders are measured
      await page.mouse.move(0, 0);
      await settle();
      m = await measure();
      assert.ok(m.seen >= 10, `the ${kind} form was measured (${m.seen} elements)`);
      assert.deepEqual(m.low, [], `form, ${kind}`);
    }
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard entries' }).click().catch(() => {});

    await page.getByRole('button', { name: 'Change' }).click();
    await page.mouse.move(0, 0);
    await settle();
    assert.deepEqual((await measure()).low, [], 'default timezone form in the footer');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await check('dates and times are entered as they are shown (YYYY-MM-DD, 24-hour), also in a US-English browser', async () => {
    const before = ops.listReminders().reminders.length;
    const us = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Chicago', locale: 'en-US' });
    const p = await us.newPage();
    try {
      await p.goto(BASE);
      assert.equal(await p.evaluate(() => navigator.language), 'en-US');
      await p.getByRole('button', { name: 'New reminder' }).first().click();
      await p.getByLabel('Remind me to').fill('SYNTHETIC entered in a US-English browser');
      await p.getByLabel('When').selectOption('once');
      const date = p.getByLabel('Date', { exact: true });
      const time = p.getByLabel('Time', { exact: true });

      // the controls do not take the browser's locale format: they are plain fields with the format beside them
      assert.equal(await date.getAttribute('type'), 'text');
      assert.equal(await time.getAttribute('type'), 'text');
      assert.match(await p.locator('#f-date-hint').innerText(), /YYYY-MM-DD, for example 2026-11-02/);
      assert.match(await p.locator('#f-time-hint').innerText(), /24-hour HH:MM, for example 09:00 or 17:30/);

      // a two-way numeric date and a 12-hour time are refused and explained, never guessed
      await date.pressSequentially('03/04/2027');
      await time.pressSequentially('2:30 PM');
      await p.getByRole('button', { name: 'Save reminder' }).click();
      assert.match(await p.locator('#f-date-error').innerText(), /"03\/04\/2027" is not a date\. Use the form YYYY-MM-DD/);
      assert.match(await p.locator('#f-time-error').innerText(), /"2:30 PM" is not a time\. Use 24-hour hours and minutes/);
      assert.equal(await date.inputValue(), '03/04/2027', 'the refused entry stays in the field');
      assert.equal(ops.listReminders().reminders.length, before, 'nothing was saved');

      // typed as displayed, the fields show exactly what was typed and the preview agrees
      await date.fill('');
      await date.pressSequentially('2027-03-04');
      await time.fill('');
      await time.pressSequentially('14:30');
      assert.equal(await date.inputValue(), '2027-03-04');
      assert.equal(await time.inputValue(), '14:30');
      await p.locator('.preview').getByText(/Thu 2027-03-04 14:30 \+01:00/).waitFor();
      assert.equal(await p.locator('.form').getByText(/\d{2}\/\d{2}\/\d{4}|\b[AP]M\b/).count(), 0, 'no US-format date or 12-hour time anywhere in the form');
      await p.screenshot({ path: path.join(OUT, 'desktop-form-en-US.png'), fullPage: true });

      // the recurring kinds use the same entry
      await p.getByLabel('When').selectOption('daily');
      assert.equal(await p.getByLabel('Time of day').getAttribute('type'), 'text');
      assert.equal(await p.getByLabel('Starting from (optional)').getAttribute('type'), 'text');
      assert.match(await p.locator('#f-from-hint').innerText(), /YYYY-MM-DD/);
      assert.equal(ops.listReminders().reminders.length, before);
    } finally {
      await us.close();
    }
  });

  await check('default timezone can be changed and is used to prefill new reminders', async () => {
    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByLabel('Default timezone for new reminders').fill('Nowhere/Land');
    await page.getByRole('button', { name: 'Save default' }).click();
    await page.getByText(/Unknown timezone 'Nowhere\/Land'/).waitFor();
    assert.equal(await page.getByLabel('Default timezone for new reminders').inputValue(), 'Nowhere/Land');
    await page.getByLabel('Default timezone for new reminders').fill('europe/vienna');
    await page.getByRole('button', { name: 'Save default' }).click();
    await page.getByText('Europe/Vienna').first().waitFor();
    assert.match(chat('tz').out, /Default timezone: Europe\/Vienna/);
    assert.equal(chat('tz', 'Europe/Budapest').code, 0);
    await page.locator('.tz-default').getByText('Europe/Budapest').waitFor({ timeout: WITHIN });
  });

  await check('narrow layout (360 px): list, details, form; nothing scrolls sideways', async () => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(BASE);
    await page.getByRole('heading', { name: 'Reminders', level: 1 }).waitFor();
    await noOverflow(page, 'narrow list');
    assert.equal(await page.locator('.panel-pane').isVisible(), false, 'only the list is shown first');
    await shot('narrow-list');
    await row(seed.long).click();
    await page.locator('.detail').waitFor();
    assert.equal(await page.locator('.list-pane').isVisible(), false, 'the details replace the list');
    await noOverflow(page, 'narrow details of the long reminder');
    await shot('narrow-detail-long');
    await page.locator('.detail').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('heading', { name: `Edit ${seed.long}` }).waitFor();
    await page.getByLabel('When').selectOption('weekly');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Choose at least one weekday.').waitFor();
    await noOverflow(page, 'narrow form with errors');
    await shot('narrow-form-errors');
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.btn, select, input:not([type=checkbox]), .row-link, .day')].filter((el) => el.getClientRects().length).map((el) => Math.round(el.getBoundingClientRect().height)));
    assert.ok(Math.min(...sizes) >= 44, `touch targets are at least 44 px tall (smallest: ${Math.min(...sizes)})`);

    // each message sits directly under its own field, also when the date and time fields stack
    for (const [kind, width] of [['once', 360], ['once', 375], ['every', 360]]) {
      await page.setViewportSize({ width, height: 740 });
      await page.getByLabel('When').selectOption(kind);
      await page.locator('#f-date').fill('');
      await page.locator('#f-time').fill(kind === 'every' ? '09:00' : ''); // "every": a time without a date makes the date required
      if (kind === 'every') await page.locator('#f-every-n').fill('3');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.locator('#f-date-error').waitFor();
      const box = async (selector) => (await page.locator(selector).boundingBox()) ?? assert.fail(`${selector} is not shown`);
      const [dateInput, dateError, timeLabel] = [await box('#f-date'), await box('#f-date-error'), await box('label[for="f-time"]')];
      assert.ok(dateError.y >= dateInput.y + dateInput.height, `${kind} at ${width}px: the date message is below the date field`);
      assert.ok(dateError.y + dateError.height <= timeLabel.y, `${kind} at ${width}px: the date message is above the time field, not after it`);
      assert.equal(await page.locator('#f-date').getAttribute('aria-describedby'), 'f-date-hint f-date-error');
      if (kind === 'once') {
        const [timeInput, timeError] = [await box('#f-time'), await box('#f-time-error')];
        assert.ok(timeError.y >= timeInput.y + timeInput.height, 'the time message is below the time field');
      }
      await noOverflow(page, `narrow ${kind} form with errors at ${width}px`);
    }
    await shot('narrow-form-date-error');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard entries' }).click();
    await page.getByRole('button', { name: 'All reminders' }).click();
    assert.equal(await page.locator('.list-pane').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), `row-${seed.long}`, 'focus returns to the row that was open');
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  await check('narrow layout (360 px): result notices and refusals are on screen after create, save, stop and a refused change', async () => {
    const notice = page.locator('.list-notice');
    const made = [];
    await page.setViewportSize({ width: 360, height: 740 });
    try {
      await page.goto(BASE);
      await page.getByRole('heading', { name: 'Reminders', level: 1 }).waitFor();

      // create: the card of the new reminder replaces the list, and the notice is shown with it
      await page.getByRole('button', { name: 'New reminder' }).first().click();
      await page.getByLabel('Remind me to').fill('SYNTHETIC narrow notice check');
      await page.getByLabel('When').selectOption('once');
      await page.getByLabel('Date', { exact: true }).fill('2027-03-28');
      await page.getByLabel('Time', { exact: true }).fill('02:30'); // in the missing hour: the notice carries a clock-change note
      await page.getByRole('button', { name: 'Save reminder' }).click();
      await page.locator('.detail').waitFor();
      await notice.getByText(/Created\./).waitFor();
      const id = /R-\d{4}/.exec(await notice.innerText())[0];
      made.push(id);
      assert.equal(await page.locator('.list-pane').isVisible(), false, 'the card is open, the list is not shown');
      await onScreen(page, notice, 'the "Created." notice at 360 px');
      await onScreen(page, notice.getByText(/it was moved forward to Sun 2027-03-28 03:30 \+02:00\./), 'the clock-change note of the "Created." notice at 360 px');
      assert.equal((await active(page)).id, 'detail-title', 'focus is on the saved reminder');
      await shot('narrow-notice-created');

      // dismissing it with a card open keeps focus in what is shown, not in the hidden list
      await notice.getByRole('button', { name: 'Dismiss' }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await notice.count(), 0);
      assert.equal((await active(page)).id, 'detail-title', 'after Dismiss at 360 px, focus is on the open record');

      // a refusal that belongs to no field is shown where the user is, at the bottom of a long form
      await page.locator('.detail').getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('heading', { name: `Edit ${id}` }).waitFor();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await onScreen(page, page.locator('#form-summary').getByText('Nothing has been changed, so there is nothing to save.'), 'the "nothing to save" message at 360 px');

      // save
      await page.getByLabel('Remind me to').fill('SYNTHETIC narrow notice check, edited');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.locator('.detail').waitFor();
      await notice.getByText(/Changes saved\./).waitFor();
      await onScreen(page, notice, 'the "Changes saved." notice at 360 px');
      assert.match(await notice.innerText(), new RegExp(`Changes saved\\. ${id} is saved\\.`));
      assert.match(chat('list').out, new RegExp(`${id}: SYNTHETIC narrow notice check, edited`));

      // stop, while the checker is delivering an occurrence: the warning must be read
      const pending = ops.createReminder({ text: 'SYNTHETIC narrow stop while being delivered', schedule: { rule: 'every:6h', at: '2026-10-15 14:00' } }).reminder.id;
      made.push(pending);
      setClock('2026-10-15T12:00:20Z');
      assert.match(chat('due', '--run', 'e2e-narrow').out, new RegExp(`DELIVER ${pending} 2026-10-15T12:00:00Z`));
      await page.goto(`${BASE}/?r=${pending}`);
      const detail = page.locator('.detail');
      await detail.getByText('Occurrence in delivery').waitFor();
      await detail.getByRole('button', { name: 'Stop sending' }).click();
      await page.locator('.confirm').getByRole('button', { name: 'Stop sending' }).click();
      await notice.getByText(/Stopped\./).waitFor();
      await onScreen(page, notice, 'the "Stopped." notice at 360 px');
      await onScreen(page, notice.getByText(/Occurrence 2026-10-15T12:00:00Z was being delivered when this change was saved/), 'the delivery warning of the "Stopped." notice at 360 px');
      assert.equal((await active(page)).id, 'detail-title');
      await shot('narrow-notice-stopped-while-delivering');

      // a refused change says so next to the button that was pressed, at the bottom of the card
      await page.route(`**/api/reminders/${pending}`, (route) =>
        route.request().method() === 'DELETE'
          ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'conflict', message: 'changed elsewhere', field: null, fields: null, current: null } }) })
          : route.continue(),
      );
      await detail.getByRole('button', { name: 'Remove' }).click();
      await page.getByRole('button', { name: 'Remove reminder' }).click();
      await onScreen(page, detail.locator('.banner-error').getByText(`${pending} was changed in chat or another window just now, so nothing was done.`), 'the refusal of a change at 360 px');
      assert.equal((await active(page)).text, 'Remove', 'after a refused removal, focus is back on Remove');
      await page.unroute(`**/api/reminders/${pending}`);
      await noOverflow(page, 'narrow details with a notice and a refusal');
    } finally {
      await page.unrouteAll().catch(() => {});
      for (const id of made) chat('remove', id);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });

  await check('messages do not outlive what they say: the result notice on Edit and after a change in chat, form refusals after a correction', async () => {
    const notice = page.locator('.list-notice');
    const detail = page.locator('.detail');
    const summary = page.locator('#form-summary');
    const made = [];
    try {
      await page.goto(BASE);
      await page.getByRole('button', { name: 'New reminder' }).first().click();
      await page.getByLabel('Remind me to').fill('SYNTHETIC stale notice check');
      await page.getByLabel('When').selectOption('weekly');
      await page.getByLabel('Tuesday').check();
      await page.getByLabel('Thursday').check();
      await page.getByLabel('Time of day').fill('07:30');
      await page.getByRole('button', { name: 'Save reminder' }).click();
      await notice.getByText(/Created\./).waitFor();
      const said = await notice.innerText();
      const id = /R-\d{4}/.exec(said)[0];
      made.push(id);
      assert.match(said, /Every Tuesday and Thursday at 07:30\./);

      // the reviewed case: Edit opens under a notice that describes the record as it was saved
      await detail.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('heading', { name: `Edit ${id}` }).waitFor();
      assert.equal(await notice.count(), 0, 'the result notice is gone once Edit is open');
      assert.equal(chat('schedule', id, '--rule', 'daily@06:15').code, 0);
      await page.locator('.form .banner-warn').getByText(/Every day at 06:15/).waitFor({ timeout: WITHIN });
      assert.equal(await page.getByText(/Every Tuesday and Thursday at 07:30/).count(), 0, 'nothing on screen still states the replaced schedule');
      await page.getByRole('button', { name: 'Load the latest values' }).click();

      // a refusal that belongs to no field goes when the entries change; a count of values to
      // correct goes when they are corrected
      await page.getByRole('button', { name: 'Save changes' }).click();
      await summary.getByText('Nothing has been changed, so there is nothing to save.').waitFor();
      await page.getByLabel('Remind me to').fill('');
      assert.equal(await summary.count(), 0, '"nothing to save" is gone once something was changed');
      await page.getByLabel('Time of day').fill('');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await summary.getByText('Some values need correcting. Nothing was saved.').waitFor();
      await page.getByLabel('Time of day').fill('06:15');
      await summary.getByText('One value needs correcting. Nothing was saved.').waitFor();
      await page.getByLabel('Remind me to').fill('SYNTHETIC stale notice check');
      assert.equal(await summary.count(), 0, 'the count of values to correct is gone once they are corrected');
      assert.equal(await page.locator('.field-error').count(), 0);
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Discard entries' }).click({ timeout: 1000 }).catch(() => {});

      // a notice about a record that chat changes afterwards goes within the interval, and hands on
      // keyboard focus if its Dismiss button held it
      await detail.getByRole('button', { name: 'Stop sending' }).click();
      await page.locator('.confirm').getByRole('button', { name: 'Stop sending' }).click();
      await notice.getByText(new RegExp(`Stopped\\. ${id} is saved without a schedule\\.`)).waitFor();
      await notice.getByRole('button', { name: 'Dismiss' }).focus();
      assert.equal(chat('schedule', id, '--rule', 'daily@06:15').code, 0);
      await detail.getByText('Every day at 06:15').first().waitFor({ timeout: WITHIN });
      await notice.waitFor({ state: 'detached', timeout: 2000 });
      assert.equal((await active(page)).id, `row-${id}`, 'the notice went away with focus on its Dismiss: focus moves to the row of the open reminder');

      // the unsaved-entries prompt goes when there are no unsaved entries left
      await detail.getByRole('button', { name: 'Edit' }).click();
      await page.getByLabel('Remind me to').fill('SYNTHETIC stale notice check, typed');
      await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
      await page.locator('.guard').waitFor();
      await page.getByLabel('Remind me to').fill('SYNTHETIC stale notice check');
      await page.locator('.guard').waitFor({ state: 'detached', timeout: 2000 }); // the prompt about unsaved entries goes once nothing is unsaved
      await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
      await detail.waitFor();

      // a notice that stays true stays: a removal is not undone by later refreshes
      await detail.getByRole('button', { name: 'Remove' }).click();
      await page.getByRole('button', { name: 'Remove reminder' }).click();
      await notice.getByText(`Removed ${id}.`).waitFor();
      const other = /Added (R-\d{4})/.exec(chat('add', 'SYNTHETIC added after a removal').out)[1];
      made.push(other);
      await row(other).waitFor({ timeout: WITHIN });
      await page.waitForTimeout(POLL_MS + 1000);
      assert.equal(await notice.getByText(`Removed ${id}.`).count(), 1, 'the "Removed" notice is still shown after later refreshes');
    } finally {
      if (await page.locator('form.form').count()) {
        await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
        await page.getByRole('button', { name: 'Discard entries' }).click({ timeout: 1000 }).catch(() => {});
      }
      for (const id of made) chat('remove', id);
    }
  });

  // A list longer than the window, a card taller than the window. The fillers stay for the next
  // check (a failed reread seen from the bottom of a long list) and go with the empty-state check.
  await check('long list and tall card: the card\'s buttons are reached from the list position at 1280x900 and 1366x650; narrow keeps one scroll', async () => {
    const TALL = `SYNTHETIC tall card: ${'a sentence that fills the card of a very long reminder, '.repeat(40)}`.slice(0, 1990) + ' end';
    const tall = ops.createReminder({ text: TALL }).reminder.id; // oldest note: the last row of "Not scheduled"
    for (let i = 1; i <= 45; i++) ops.createReminder({ text: `SYNTHETIC filler ${i} of 45` });
    const pane = page.locator('.panel-pane');
    const detail = page.locator('.detail');
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
    const listStill = async (y0, label) => {
      const y = await scrollY();
      assert.ok(Math.abs(y - y0) <= 2, `${label}: the list moved (page scrolled from ${y0}px to ${y}px)`);
    };
    /**
     * Really on screen: inside the window, and not cut off by the pane it scrolls in or covered by
     * anything (its top, middle and bottom are what a pointer would hit there).
     */
    const inView = async (locator) =>
      (await locator.count()) === 1 &&
      (await locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.top < 0 || r.bottom > window.innerHeight + 1) return false;
        const x = r.left + r.width / 2;
        return [r.top + 2, r.top + r.height / 2, r.bottom - 2].every((y) => {
          const hit = document.elementFromPoint(x, y);
          return hit !== null && (hit === el || el.contains(hit));
        });
      }));
    const shown = async (locator, label) => {
      for (const until = Date.now() + 2000; Date.now() < until; await page.waitForTimeout(100)) if (await inView(locator)) return;
      assert.fail(`${label}: not on screen`);
    };
    /**
     * Turn the mouse wheel with the pointer in the card's pane until the control is on screen. The
     * pointer is at the pane's edge, beside the card, so that a text field holding a long text
     * does not take the wheel for itself. One turn at a time, each left to finish: a turn made
     * after the card has reached its end scrolls the list, as in any nested scroll.
     */
    const wheelTo = async (locator, label) => {
      const box = await pane.boundingBox();
      await page.mouse.move(box.x + 5, Math.max(box.y, 0) + 120);
      for (let i = 0; i < 40 && !(await inView(locator)); i++) {
        await page.mouse.wheel(0, 150);
        await page.waitForTimeout(250); // let the scroll finish before looking again
      }
      assert.ok(await inView(locator), `${label}: not reached with the mouse wheel over the card's pane`);
    };
    /**
     * Click where the control is on screen, as a person does. Playwright's own click scrolls the
     * page to the control when it finds it moving or covered, which would hide exactly what this
     * check measures: whether the list stays where it is.
     */
    const press = async (locator, label) => {
      await page.waitForTimeout(300); // the card's 220 ms rise
      assert.ok(await inView(locator), `${label}: not on screen, so it cannot be clicked without scrolling`);
      const box = await locator.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    try {
      for (const [width, height] of [[1280, 900], [1366, 650]]) {
        const at = `${width}x${height}`;
        await page.setViewportSize({ width, height });
        await page.goto(BASE);
        await row(tall).waitFor();
        const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        assert.ok(pageHeight > 3 * height, `${at}: the list is several windows long (${pageHeight}px)`);

        // deep in the list: open the long reminder and reach its actions without moving the list
        await row(tall).evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const y0 = await scrollY();
        assert.ok(y0 > 2 * height, `${at}: the row is far down the list (scrolled ${y0}px)`);
        await press(row(tall), `${at}: the row of the long reminder`);
        await detail.waitFor();
        await shown(page.locator('#detail-title'), `${at}: the heading of the opened card`);
        await listStill(y0, `${at}, the long card opened`);
        const cardHeight = await detail.evaluate((el) => Math.round(el.getBoundingClientRect().height));
        assert.ok(cardHeight > height, `${at}: the card is taller than the window (${cardHeight}px)`);
        await wheelTo(detail.getByRole('button', { name: 'Remove' }), `${at}: Remove on the long reminder`);
        assert.ok(await inView(detail.getByRole('button', { name: 'Edit' })), `${at}: Edit is on screen with Remove`);
        await listStill(y0, `${at}, the long card scrolled to its buttons`);
        assert.ok(await inView(row(tall)), `${at}: the row of the open reminder is still on screen`);

        // the edit form of the same reminder with the tallest schedule
        await press(detail.getByRole('button', { name: 'Edit' }), `${at}: Edit`);
        await page.getByRole('heading', { name: `Edit ${tall}` }).waitFor();
        await shown(page.locator('#form-title'), `${at}: the heading of the edit form`);
        await page.getByLabel('When').selectOption('weekly');
        await wheelTo(page.getByRole('button', { name: 'Save changes' }), `${at}: Save changes on a weekly form`);
        await listStill(y0, `${at}, the weekly form scrolled to Save changes`);
        // the prompt about unsaved entries opens above the form, which is scrolled to its end
        await press(page.locator('form.form').getByRole('button', { name: 'Cancel' }), `${at}: Cancel`);
        await shown(page.locator('.guard').getByRole('button', { name: 'Keep editing' }), `${at}: the unsaved-entries prompt`);
        await listStill(y0, `${at}, the unsaved-entries prompt shown`);
        await press(page.getByRole('button', { name: 'Discard entries' }), `${at}: Discard entries`);
        await detail.waitFor();
        await shown(page.locator('#detail-title'), `${at}: the heading of the card after the form closed`);
        await listStill(y0, `${at}, the form closed`);

        // with the pointer over a card that fits, the wheel scrolls the list
        await press(row(tall), `${at}: the row of the long reminder, again`);
        const short = page.locator('.row-link').filter({ hasText: 'SYNTHETIC filler 1 of 45' });
        await press(short, `${at}: a short reminder's row`);
        await detail.getByText('SYNTHETIC filler 1 of 45').waitFor();
        {
          const box = await detail.boundingBox();
          assert.ok(box.height < height - 100, `${at}: the short card fits the window`);
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, -300);
          await page.waitForTimeout(300);
          assert.ok((await scrollY()) <= y0 - 250, `${at}: the wheel over a short card scrolls the list (page at ${await scrollY()}px, was ${y0}px)`);
        }

        // from the top of the page: the ordinary "New reminder" form, every week
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole('button', { name: 'New reminder' }).first().click();
        await page.getByLabel('When').selectOption('weekly');
        await wheelTo(page.getByRole('button', { name: 'Save reminder' }), `${at}: Save reminder on a new weekly reminder`);
        const moved = await scrollY();
        assert.ok(moved <= 2, `${at}: Save reminder is reached at the top of the list without scrolling the page (page scrolled ${moved}px of ${pageHeight}px)`);
        await noOverflow(page, `${at} with a long list and a tall form`);
        if (height === 900) await page.screenshot({ path: path.join(OUT, 'desktop-long-list-tall-form.png') });
        await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
        await page.getByRole('button', { name: 'Discard entries' }).click();
      }

      // narrow: the card is the only pane, so it scrolls with the page and has no scroll of its own
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(BASE);
      await row(tall).click();
      await detail.waitFor();
      const own = await pane.evaluate((el) => ({ position: getComputedStyle(el).position, scrolls: el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible' }));
      assert.deepEqual(own, { position: 'static', scrolls: false }, 'the card has no scroll of its own in a narrow window');
      await page.mouse.move(180, 400);
      for (let i = 0; i < 60 && !(await inView(detail.getByRole('button', { name: 'Remove' }))); i++) {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(60);
      }
      assert.ok(await inView(detail.getByRole('button', { name: 'Remove' })), 'narrow: Remove is reached by scrolling the page');
      await noOverflow(page, 'narrow details of a 2000-character reminder');
      await page.getByRole('button', { name: 'All reminders' }).click();
      await shown(row(tall), 'narrow: back in the list, the row that was open');
    } finally {
      if (await page.locator('form.form').count()) {
        await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
        await page.getByRole('button', { name: 'Discard entries' }).click({ timeout: 1000 }).catch(() => {});
      }
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });

  await check('refresh failure is shown, also at the end of a long list; an open form is kept; a restart serves the same saved records', async () => {
    await page.goto(BASE);
    await page.getByRole('button', { name: 'New reminder' }).first().click();
    await page.getByLabel('Remind me to').fill('SYNTHETIC typed while the app is down');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    assert.ok((await page.evaluate(() => window.scrollY)) > 1800, 'the page is scrolled far down a long list');
    const before = chat('list').out;
    stopServer();
    await page.getByText('The list could not be reread').waitFor({ timeout: WITHIN + 9000 });
    assert.match(await page.locator('.page-banner').innerText(), /may be out of date/);
    await onScreen(page, page.locator('.page-banner'), 'the failed-reread message at the end of a long list');
    await onScreen(page, page.locator('.page-banner').getByRole('button', { name: 'Try now' }), '"Try now" at the end of a long list');
    {
      const banner = await page.locator('.page-banner').boundingBox();
      const card = await page.locator('form.form').boundingBox();
      assert.ok(card.y >= banner.y + banner.height, `the message does not cover the open form (message ends at ${Math.round(banner.y + banner.height)}, form starts at ${Math.round(card.y)})`);
      await page.getByLabel('Remind me to').focus();
      await onScreen(page, page.getByLabel('Remind me to'), 'the focused field under the failed-reread message');
      const field = await page.getByLabel('Remind me to').boundingBox();
      assert.ok(field.y >= banner.y + banner.height, 'the focused field is not behind the message');
    }
    await page.screenshot({ path: path.join(OUT, 'desktop-refresh-failed-long-list.png') });
    await shot('desktop-refresh-failed');
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC typed while the app is down');
    assert.equal(chat('list').out, before, 'chat keeps working while the app is stopped');
    const added = chat('add', 'SYNTHETIC added while the app was stopped');
    const viaChat = /Added (R-\d{4})/.exec(added.out)[1];
    await page.locator('.page-banner').getByRole('button', { name: 'Try now' }).focus();

    startServer();
    await waitHealthy();
    await row(viaChat).waitFor({ timeout: WITHIN + 5000 });
    assert.equal(await page.locator('.page-banner').count(), 0, 'the failure notice clears once rereading works');
    assert.equal((await active(page)).text, 'Refresh', 'the notice went away with focus on its "Try now": focus moves to Refresh, not the page body');
    assert.equal(await page.getByLabel('Remind me to').inputValue(), 'SYNTHETIC typed while the app is down');
    const afterApi = (await api('/api/reminders')).body.reminders;
    const afterChat = JSON.parse(chat('list', '--json').out).reminders;
    assert.deepEqual(afterApi, afterChat, 'browser API and chat read identical records after the restart');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard entries' }).click();
  });

  await check('empty state teaches what to do', async () => {
    for (const r of ops.listReminders().reminders) assert.equal(chat('remove', r.id).code, 0);
    await page.getByRole('heading', { name: 'No reminders yet' }).waitFor({ timeout: WITHIN });
    await shot('desktop-empty');
    assert.equal(ops.listReminders().reminders.length, 0);
  });

  // A list shorter than the open card: the card's extra height must not push the list down. The
  // list starts directly under the notice row (which takes no room while empty), level with the card.
  await check('short list and taller card: the list starts directly under the notice row at 1440x900 and 1280x720', async () => {
    const detail = page.locator('.detail');
    const measure = async (label, { level }) => {
      await page.waitForTimeout(350); // the card's 220 ms rise
      const m = await page.evaluate(() => {
        const box = (s) => document.querySelector(s).getBoundingClientRect();
        return { notice: box('.notice-region'), list: box('.list-pane'), content: document.querySelector('.list-pane').firstElementChild.getBoundingClientRect(), card: box('.panel-pane .card') };
      });
      assert.ok(m.card.height > m.list.height, `${label}: the card (${Math.round(m.card.height)}px) is taller than the list (${Math.round(m.list.height)}px)`);
      assert.ok(Math.abs(m.list.top - m.notice.bottom) <= 1, `${label}: the list starts ${Math.round(m.list.top - m.notice.bottom)}px below the notice row`);
      assert.ok(Math.abs(m.content.top - m.list.top) <= 1, `${label}: the list's content starts ${Math.round(m.content.top - m.list.top)}px below the top of its pane`);
      if (level) {
        assert.ok(m.notice.height <= 1, `${label}: the empty notice row takes ${Math.round(m.notice.height)}px`);
        assert.ok(Math.abs(m.list.top - m.card.top) <= 1, `${label}: the list starts ${Math.round(m.list.top - m.card.top)}px below the top of the card`);
      } else {
        assert.ok(m.notice.height > 20, `${label}: the result notice is shown`);
      }
    };
    const leaveForm = async () => {
      await page.locator('form.form').getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Discard entries' }).click({ timeout: 1500 }).catch(() => {});
    };
    try {
      for (const [width, height] of [[1440, 900], [1280, 720]]) {
        const at = `${width}x${height}`;
        assert.equal(ops.listReminders().reminders.length, 0);
        await page.setViewportSize({ width, height });
        await page.goto(BASE);
        await page.getByRole('heading', { name: 'No reminders yet' }).waitFor();
        await measure(`${at}, empty list and the explanatory card`, { level: true });
        await page.getByRole('button', { name: 'New reminder' }).first().click();
        await page.getByLabel('When').selectOption('weekly');
        await measure(`${at}, empty list and a new weekly reminder`, { level: true });
        await leaveForm();

        const one = ops.createReminder({ text: 'SYNTHETIC short list one', schedule: { at: '2026-10-20 09:00' } }).reminder.id;
        const two = ops.createReminder({ text: 'SYNTHETIC short list two' }).reminder.id;
        await page.goto(`${BASE}/?r=${one}`);
        await detail.waitFor();
        await measure(`${at}, two reminders and details`, { level: true });
        await detail.getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('When').selectOption('weekly');
        await measure(`${at}, two reminders and a weekly edit form`, { level: true });
        await leaveForm();

        // after a removal the notice takes its row; the list follows it without a gap
        await detail.getByRole('button', { name: 'Remove' }).click();
        await page.getByRole('button', { name: 'Remove reminder' }).click();
        await page.locator('.list-notice').getByText(`Removed ${one}.`).waitFor();
        await measure(`${at}, a result notice over one reminder`, { level: false });
        await row(two).click();
        await detail.getByText('SYNTHETIC short list two').waitFor();
        await detail.getByRole('button', { name: 'Remove' }).click();
        await page.getByRole('button', { name: 'Remove reminder' }).click();
        await page.locator('.list-notice').getByText(`Removed ${two}.`).waitFor();
        await page.getByRole('heading', { name: 'No reminders yet' }).waitFor();
        await measure(`${at}, a result notice over a short list`, { level: false });
        if (width === 1440) await page.screenshot({ path: path.join(OUT, 'desktop-short-list-notice.png') });
        await page.locator('.list-notice').getByRole('button', { name: 'Dismiss' }).click();
        await page.locator('.list-notice').waitFor({ state: 'detached' });
        await page.getByRole('button', { name: 'New reminder' }).first().click();
        await page.getByLabel('When').selectOption('weekly');
        await measure(`${at}, the notice gone again`, { level: true });
        if (width === 1440) await page.screenshot({ path: path.join(OUT, 'desktop-short-list-tall-form.png') });
        await leaveForm();
      }
    } finally {
      for (const r of ops.listReminders().reminders) chat('remove', r.id);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });

  await check('no script errors were raised in the page', async () => {
    const real = pageErrors.filter((e) => !/Failed to load resource|ERR_CONNECTION_REFUSED|Failed to fetch/i.test(e));
    assert.deepEqual(real, []);
  });
} finally {
  await browser.close().catch(() => {});
  stopServer();
  fs.rmSync(SCRATCH, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots: ${OUT}`);
process.exitCode = failed.length ? 1 : 0;
