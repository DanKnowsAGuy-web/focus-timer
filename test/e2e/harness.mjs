// Launches the preinstalled Chromium with the built extension loaded.
// Extensions need Chromium's new headless mode, which the full chromium
// binary provides; the headless shell does not. We point at the full binary.
import { chromium } from 'playwright-core';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const dist = path.join(root, 'extension', 'dist');
export const fixtures = path.join(root, 'test', 'fixtures');

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

export async function launchWithExtension() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'feedoverlay-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: true,
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  return context;
}

/** Serve a fixture file for every request under the given origin. */
export async function routeOriginToFixture(page, origin, fixtureRelPath) {
  const body = await readFile(path.join(fixtures, fixtureRelPath), 'utf8');
  await page.route(`${origin}/**`, (route) => {
    const url = route.request().url();
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    }
    // Anything else the fixture asks for is answered empty so nothing hits the network.
    return route.fulfill({ status: 204, body: '' });
  });
  // Belt and braces: block every other host too.
  await page.route(/^(?!about:|chrome-extension:|data:).*/, (route) => {
    if (route.request().url().startsWith(origin)) return route.fallback();
    return route.fulfill({ status: 204, body: '' });
  });
}
