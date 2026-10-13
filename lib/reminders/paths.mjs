// The one place that decides where the reminder database lives.
// Chat (reminders.sh -> reminders-cli.mjs), the browser app (Next.js) and the reminder checker all
// resolve the path here, from reminders.config.json in the project root. Nothing else may open a
// reminder database by its own path.
import fs from 'node:fs';
import path from 'node:path';

export const CONFIG_NAME = 'reminders.config.json';
export const APP_ID = 'my-software-factory-reminders';

let explicitRoot = null;
let cached = null;

/** Set by entry points that know their own location (the CLI and scripts). The app uses its cwd. */
export function setProjectRoot(dir) {
  explicitRoot = path.resolve(dir);
  cached = null;
}

function readConfig(dir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, CONFIG_NAME), 'utf8'));
    return cfg && cfg.app === APP_ID ? cfg : null;
  } catch {
    return null;
  }
}

/** Project root + parsed config. Throws rather than guessing a location. */
export function project() {
  if (cached) return cached;
  const candidates = [explicitRoot, process.cwd()].filter(Boolean);
  for (const dir of candidates) {
    const config = readConfig(dir);
    if (config) {
      cached = { root: dir, config };
      return cached;
    }
  }
  throw new Error(
    `cannot find ${CONFIG_NAME} (app "${APP_ID}") in ${candidates.join(' or ')}. ` +
      'Start the app and the reminder commands from the project folder; no database was opened.',
  );
}

/** The canonical database file every reader and writer uses. */
export function canonicalDbPath() {
  const { root, config } = project();
  return path.resolve(root, config.database);
}

/**
 * The database path in effect. REMINDERS_DB replaces it for isolated tests only (a scratch file);
 * `isolated` is then true and the app and CLI label their output as test data.
 */
export function dbLocation() {
  const canonical = canonicalDbPath();
  const override = process.env.REMINDERS_DB;
  if (override && override.trim() !== '') {
    const p = path.resolve(override);
    return { path: p, canonical, isolated: p.toLowerCase() !== canonical.toLowerCase() };
  }
  return { path: canonical, canonical, isolated: false };
}

export function pollSeconds() {
  const n = Number(project().config.pollSeconds);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}
