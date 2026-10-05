// Smoke test against the real, logged-out youtube.com. Not part of `npm test`.
// Exit 0: the overlay ran on the live site.
// Exit 2: YouTube changed, or is unreachable from here. Message, not a stack trace.
import { launchWithExtension } from '../e2e/harness.mjs';

const LIVE_FAIL = 2;
let context;
try {
  context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('html[data-feedoverlay="ready"]', { timeout: 15_000 });
  console.log('LIVE: overlay ready on youtube.com');
  await context.close();
  process.exit(0);
} catch (err) {
  const reason = err && err.message ? err.message.split('\n')[0] : String(err);
  console.error(`LIVE: YouTube changed or unreachable (${reason})`);
  if (context) await context.close().catch(() => {});
  process.exit(LIVE_FAIL);
}
