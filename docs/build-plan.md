# Feed Overlay: full build map with loop prompts

One browser extension, two surfaces. The **Overlay** rewrites the feed inside
youtube.com first, then facebook.com and x.com. **Home** is the extension's own
page that shows everything captured and pulled, sorted into the same tabs. The
cookie jar from the focus timer in `index.html` is the currency that gates the
distracting surfaces.

**Order of attack: YouTube, then Facebook, then X.** YouTube first because its
pages load logged out, so sessions can test against the live site; its DOM is
built from stable named elements; subscriptions come through free RSS; and the
Unhook feature set is a known target to match before we add what Unhook lacks,
which is categories and a budget.

This file is the plan of record. Each phase has a goal, the acceptance checks
a session must make pass, a loop prompt to paste into a session, and the one
thing a human checks in a real browser afterwards. Phases are ordered so each
one is shippable on its own.

---

## How to use this file

1. Open a session on branch `claude/feed-overlay-extensions-oluwg0`.
2. Paste the **master loop prompt** below, or the prompt for one phase.
3. The session works until every check in that phase's "Done when" passes,
   commits, pushes, and reports. It does not start the next phase.
4. You do the "Human check" in your own browser and tick the box.

Each phase's status lives in the checklist at the bottom. Keep it current.

### Master loop prompt

```
You are in /home/user/focus-timer on branch claude/feed-overlay-extensions-oluwg0.
Read docs/build-plan.md. Find the first phase whose box in the status checklist
is not ticked. Work only that phase. Run every command under its "Done when"
and iterate until all of them pass. Never edit a test to make it pass; fix the
code. Never weaken a selector fallback to make a fixture pass. When everything
passes: tick the phase in the checklist, commit with a message naming the
phase, push with `git push -u origin claude/feed-overlay-extensions-oluwg0`,
and report what passed, what you could not verify, and what the human check
is. Do not begin the next phase.
```

---

## Fixed decisions

These are settled so sessions do not relitigate them.

- **Manifest V3**, plain JavaScript ES modules, bundled with esbuild. No
  framework. TypeScript only if a phase finds it pays for itself.
- **Browsers:** Chrome and Edge first. Firefox from the same code in the
  hardening phase. Safari notes only.
- **Tests:** Node's built-in test runner (`node --test`) for units. Playwright
  for end to end, using the preinstalled Chromium at
  `/opt/pw-browsers/chromium`. Extensions need Chromium's new headless mode,
  so launch with `channel: 'chromium'` and `launchPersistentContext` with
  `--load-extension`.
- **YouTube tests run two ways.** Against committed fixtures for determinism,
  and against live logged-out youtube.com as a smoke test that is allowed to
  fail with a clear "YouTube changed" message rather than a stack trace. The
  live smoke test is what tells us selectors drifted.
- **No live Facebook or X in tests.** Sessions cannot log in. Tests serve
  saved, scrubbed snapshots at the real origin via Playwright's `page.route`,
  so content scripts inject exactly as in production.
- **Scrubbing is mandatory** before any snapshot is committed. Text is
  replaced word for word with same-length lorem, names and channel names with
  stable fake names, image URLs with a 1x1 placeholder. The capture tool does
  this; no raw snapshot is ever committed. Logged-out YouTube fixtures carry
  no personal data but are scrubbed anyway for consistency.
- **Default tabs:** People, Learn, Work, Fun, News, Noise. Users rename, add,
  delete, capped at eight. On YouTube, "People" means channels the user marks
  as personal, and the Noise tab holds Shorts, ads, and anything from the
  recommendation feed the user did not subscribe to.
- **Precedence** for where an item lands: exact per-item correction, then
  author or channel list, then classifier.
- **Classifier tiers:** rules (channel or author, domain, keyword) always run
  first and are free. Jev runs only on items the rules did not decide, only
  when the user has opted in to Smart sorting, only through our proxy or the
  user's own key. On-device fallback is a later phase.
- **Jev for a product, not a hobby.** The proxy is a Cloudflare Worker with a
  KV cache keyed by a hash of the text, anonymous install tokens with daily
  caps, origin check against the extension id, and no logging of bodies.
  Rules-only is free for everyone. Smart sorting is an opt-in paid toggle.
  Bring-your-own-key is a hidden advanced setting that bypasses the proxy.
- **Privacy:** nothing leaves the browser except, with opt in, the text of an
  item sent to the Jev proxy, and the RSS and Bluesky fetches the user
  configured. No analytics. Settings has Export and Delete everything.
- **The extension never acts on your behalf.** It hides, reorders, blurs and
  captures. It never clicks, follows, unfollows, likes, subscribes or posts.

---

## Target repo layout

```
focus-timer/
  index.html                  existing timer (becomes the Earn page)
  docs/build-plan.md          this file
  docs/privacy.md             hardening phase
  extension/
    manifest.json
    src/
      content/youtube.js      overlay entry for youtube.com
      content/facebook.js     Phase 9
      content/x.js            Phase 10
      lib/selectors/youtube.js   selector module with fallbacks + health check
      lib/selectors/facebook.js  Phase 9
      lib/selectors/x.js         Phase 10
      lib/classify/rules.js   channel/author, domain, keyword rules
      lib/classify/jev.js     proxy client, Phase 7
      lib/sources/youtube-rss.js  Phase 6
      lib/store.js            IndexedDB + chrome.storage wrappers
      lib/tabs.js             tab definitions, precedence
      ui/tabbar.js            shared tab bar component (overlay + Home)
      ui/itemcontrols.js      Save, Wrong tab, Hide channel/author
      ui/jar.js               cookie jar widget, Phase 8
      pages/settings.html     Phase 5, grows into Home
      pages/home.html         Phase 6
      pages/earn.html         Phase 8, wraps the timer
    dist/                     esbuild output, gitignored
  proxy/                      Phase 7, Cloudflare Worker holding the Jev key
  tools/capture.js            dev tool that snapshots and scrubs a live page
  test/
    unit/
    e2e/
    fixtures/youtube/*.html   scrubbed snapshots: home, watch, subscriptions, shorts
    fixtures/facebook/*.html  Phase 9
    fixtures/x/*.html         Phase 10
    fixtures/labeled.json     items with human labels, Phase 7
  package.json                scripts: build, test, test:unit, test:e2e, test:live
```

---

## Phase 0: Scaffold and test harness

**Goal.** An extension that loads, does nothing visible, and a test suite that
can prove a content script ran on a fixture served as youtube.com and on the
live logged-out site.

**Scope.** `package.json`, esbuild config, MV3 manifest with a content script
for `https://www.youtube.com/*`, Playwright harness that loads `dist/` into
Chromium, one hand-written minimal fixture, a `test:live` script that opens
real youtube.com and is excluded from `npm test`, `.gitignore` for `dist/` and
`node_modules/`.

**Done when**

```
npm install
npm run build            # produces extension/dist with manifest and content script
npm run test:unit        # at least one passing unit test
npm run test:e2e         # loads extension, routes youtube.com to the fixture,
                         # asserts the content script set data-feedoverlay="ready" on <html>
npm run test:live        # same assertion against live https://www.youtube.com/ logged out;
                         # on failure prints "LIVE: YouTube changed or unreachable" and exits 2
npm test                 # runs unit then e2e, exit 0
```

**Loop prompt**

```
Phase 0 of docs/build-plan.md. Create the extension scaffold and test harness
described under "Target repo layout" and "Fixed decisions". The e2e test must
launch the preinstalled Chromium at /opt/pw-browsers/chromium with the built
extension loaded, intercept https://www.youtube.com/ with page.route to serve
test/fixtures/youtube/skeleton.html, and assert the content script marked
<html data-feedoverlay="ready">. Add test:live doing the same against the real
site with no routing, exiting 2 with the LIVE message on any failure. Make
`npm test` run units then e2e and exit 0. If Chromium refuses to load the
extension headless, switch to the new headless mode (channel 'chromium'); do
not fall back to headed. Iterate until npm test passes and test:live either
passes or exits 2 with the message, then commit, push, and report.
```

**Human check.** Load `extension/dist` unpacked in Chrome, open YouTube,
confirm the console shows the ready marker and nothing else changed.

---

## Phase 1: YouTube anatomy, capture tool, selectors

**Goal.** Know where every surface lives on the four page types (home, watch,
subscriptions, shorts) and prove it against fixtures and the live site.

**Scope.** `tools/capture.js`, runnable from the devtools console, that
scrubs and downloads the current page. `lib/selectors/youtube.js` with a
primary and a fallback per element and `healthCheck()`. Elements: home feed
grid and its items, Shorts shelf and Shorts page, watch-page recommended
sidebar, end-screen grid, autoplay toggle, comments section, subscriptions
feed and its items, channel name and link per item, view and like counts,
subscriber counts, notification bell count. Per-item parse returns
`{id, channelId, channelName, title, isShort, isAd, isLive, url}`. Fixtures
for all four page types committed by the session from the live logged-out
site through the capture tool run in Playwright.

**Done when**

```
npm test
# e2e per fixture under test/fixtures/youtube/:
#   home: finds the feed grid and >= 12 items, every item parses with id, channel, title
#   home: finds the Shorts shelf
#   watch: finds recommended sidebar, end-screen container, autoplay toggle, comments
#   subscriptions: finds the feed and >= 12 items, every item parses
#   healthCheck() reports which strategy matched; none report "none"
#   a fixture with primary element names mangled still finds items via fallback
npm run test:live   # passes or exits 2 with the LIVE message; must pass at least once in this phase
```

**Loop prompt**

```
Phase 1 of docs/build-plan.md. Build tools/capture.js and
extension/src/lib/selectors/youtube.js to the interface in scope. Prefer
YouTube's custom element tag names (ytd-*) and aria attributes as primary
strategies and structural position as fallback; never bare generated class
names. Use Playwright against live logged-out youtube.com to run the capture
tool and commit scrubbed fixtures for home, a watch page, the shorts page, and
/feed/subscriptions (logged out it may be an empty state; capture it anyway
and also build a synthetic subscriptions fixture from the home item structure).
Add the e2e assertions and make test:live pass once. Iterate until npm test
passes, commit, push, report.
```

**Human check.** Run the capture tool on your logged-in subscriptions page,
confirm the scrub left no channel names, commit it, re-run `npm test`.

---

## Phase 2: Declutter to Unhook parity

**Goal.** Opening YouTube with the extension on gives you the video you came
for and nothing that pulls you elsewhere. Every toggle Unhook offers, we offer.

**Scope.** Toggles in `chrome.storage.sync` under `settings.sites.youtube`,
all default on except where noted: hide home feed, hide Shorts everywhere,
hide recommended sidebar, hide end screens, disable autoplay, hide comments
(default off), hide view and like counts, hide subscriber counts, hide
notification count, hide trending and explore links, redirect home to
subscriptions (default on). A single "Show YouTube's extras" link restores
everything for this page load. Mutation handling batched per animation frame.
YouTube is a single-page app, so navigation must be detected and rules
reapplied without reload.

**Done when**

```
npm test
# e2e:
#   home fixture: feed grid and Shorts shelf are hidden; with redirect on, location becomes /feed/subscriptions
#   watch fixture: recommended sidebar, end screens hidden; autoplay toggle is off; comments visible by default
#   metrics hidden across all fixtures; titles and channel names still visible
#   "Show YouTube's extras" restores; a simulated SPA navigation (history.pushState +
#     yt-navigate-finish event) re-hides
#   each toggle off leaves its element visible
#   50 items appended in one tick are processed within 2 frames
npm run test:live   # passes or exits 2
```

**Loop prompt**

```
Phase 2 of docs/build-plan.md. Implement declutter in content/youtube.js using
the Phase 1 selectors. One MutationObserver scoped to the app container, work
batched with requestAnimationFrame, listen for yt-navigate-finish and
popstate to reapply on SPA navigation. Read toggles from chrome.storage.sync
with the listed defaults and react to storage.onChanged live. Add the e2e
assertions including the SPA navigation and 50-item burst tests. Iterate until
npm test passes, commit, push, report.
```

**Human check.** Install alongside Unhook, compare toggle by toggle, then
uninstall Unhook. Use YouTube for a day. Note anything Unhook did that we
don't.

---

## Phase 3: Tab bar and rules classifier on YouTube

**Goal.** Your six tabs across the top of the subscriptions feed and, when
revealed, the home feed. Each video goes to exactly one tab. The active tab
shows its videos; others collapse to a thin row with a count.

**Scope.** `lib/tabs.js` with the default set, names, descriptions, order,
stored in `chrome.storage.sync`. `lib/classify/rules.js` with three rule
types: channel list per tab (the primary signal on YouTube), keyword list per
tab matched against title, and structural rules: Shorts, ads, and anything on
the home feed from an unsubscribed channel go to Noise. Unmatched videos go to
Learn when the title reads as explanatory (how, why, explained, lecture,
sermon, tutorial) and Fun otherwise, as a placeholder until Jev. The shared
`ui/tabbar.js` component renders above the feed and is reused in Home. Active
tab remembered per site. A "Sort this channel into…" affordance on every item
is the fast way to build channel lists.

**Done when**

```
npm test
# unit:
#   classify() on 40 cases in test/unit/rules.cases.json lands all 40 where the file says
#     (covers shorts, ads, channel list hits, keyword hits, unsubscribed-on-home, fallback)
#   precedence: channel list beats keyword
# e2e:
#   subscriptions fixture: tab bar above the feed with six tabs
#   every item has exactly one data-feedtab attribute
#   clicking Noise shows only Noise; others collapse to one row each; a row expands inline
#   active tab survives SPA navigation and reload
#   home fixture with feed revealed: unsubscribed items carry data-feedtab="noise"
```

**Loop prompt**

```
Phase 3 of docs/build-plan.md. Implement lib/tabs.js, lib/classify/rules.js
and ui/tabbar.js per scope. Render through the Phase 2 mutation pipeline so
late-loaded items are classified too. Write test/unit/rules.cases.json with 40
cases and make all pass. Add the e2e assertions. Iterate until npm test
passes, commit, push, report.
```

**Human check.** Sort your subscribed channels into tabs using the affordance.
Use the subscriptions page for a day on tabs alone. Count videos that landed
wrong. That is the baseline Jev must beat.

---

## Phase 4: Item controls and corrections

**Goal.** Every video has Save, Wrong tab, Hide channel. Corrections stick
and change future classification.

**Scope.** `ui/itemcontrols.js` rendered into each item. Wrong tab shows the
tab list; picking one moves the item and stores a per-item correction, and
offers "always for this channel" which writes the channel list. Hide channel
collapses all its videos to Noise. Save stores the parsed item. All stored in
IndexedDB through `lib/store.js`. A correction log entry is written per Wrong
tab so Phase 7 can measure classifier error.

**Done when**

```
npm test
# unit: store round-trips corrections, saves, hidden channels; precedence order holds
# e2e:
#   Wrong tab -> Learn moves the item and persists across reload
#   "always for this channel" moves every item from that channel now and after reload
#   Hide channel collapses its items into Noise, persists
#   Save adds to the saved list; a Saved count appears in the tab bar
#   controls are keyboard reachable with aria labels
```

**Loop prompt**

```
Phase 4 of docs/build-plan.md. Implement ui/itemcontrols.js and lib/store.js
on IndexedDB. Wire precedence in lib/tabs.js: exact item correction, then
channel list, then rules. Log {itemId, channelId, from, to, keywordsHit, ts}
on every Wrong tab. Add the e2e assertions. Iterate until npm test passes,
commit, push, report.
```

**Human check.** Correct ten videos, two of them with "always for this
channel". Reload. All stay put.

---

## Phase 5: Settings page

**Goal.** One page for everything configurable, built on the same layout
shell and theme tokens as `index.html`, because it becomes Home.

**Scope.** `pages/settings.html` from the toolbar icon. Sections: Tabs
(rename, reorder, description, add to eight, delete), Channel lists per tab,
Per-site toggles from Phase 2, Privacy (Smart sorting toggle greyed until
Phase 7, with its plain-language sentence already written), Export JSON,
Delete everything. Light and dark via the timer's tokens.

**Done when**

```
npm test
# e2e on chrome-extension://<id>/pages/settings.html:
#   renaming a tab updates the tab bar on the youtube fixture live
#   adding a ninth tab is refused with a visible message
#   Export contains tabs, channel lists, corrections, saved items
#   Delete everything clears storage; the fixture then shows defaults
#   usable at 375px wide with no horizontal scroll
```

**Loop prompt**

```
Phase 5 of docs/build-plan.md. Build pages/settings.html with the sections in
scope, reusing index.html's color tokens and font. Set the toolbar action to
open it. Everything reads and writes through lib/store.js and
chrome.storage.sync so content scripts pick up changes via storage.onChanged.
Add the e2e assertions. Iterate until npm test passes, commit, push, report.
```

**Human check.** Rename Fun to Hobbies with YouTube open in another tab. The
tab bar updates without reload.

---

## Phase 6: Home with YouTube subscriptions via RSS

**Goal.** A page of your own that replaces YouTube's home: every subscribed
channel's latest videos, in your tabs, no recommendations anywhere.

**Scope.** `lib/sources/youtube-rss.js`: resolve channel URLs of the three
shapes to channel ids, fetch each channel's RSS feed every 30 minutes from the
service worker with `chrome.alarms`, parse into the common item shape,
classify through the same pipeline. Channel import: the content script on
`/feed/channels` captures the user's subscription list in one click, since
YouTube no longer offers OPML export. `pages/home.html` reuses `ui/tabbar.js`
and `ui/itemcontrols.js`, newest first, thumbnail, title, channel, age, opens
the watch page in a tab where the Phase 2 overlay applies. Option to make Home
the new tab page, default off. Option to redirect youtube.com home to Home
instead of subscriptions.

**Done when**

```
npm test
# unit:
#   channel URL -> id for /channel/UC…, /@handle, /c/name (handle and name via a fetch
#     of the channel page, fixture-served)
#   RSS fixture parses to items with id, channelId, title, published, thumbnail
#   alarms schedule and dedupe by video id; retention 30 days
# e2e:
#   the /feed/channels fixture import adds >= 10 channels to settings
#   home.html shows fixture RSS items under tabs decided by channel lists
#   Wrong tab on Home moves the item on the youtube subscriptions fixture too
#   500 items render and scroll under 2 s
```

**Loop prompt**

```
Phase 6 of docs/build-plan.md. Implement the RSS source in the service worker,
the one-click subscription import from /feed/channels, and pages/home.html on
the shared components. Commit RSS fixtures under test/fixtures/youtube/rss/.
Add the new-tab and home-redirect options, both default off. Add the
assertions. Iterate until npm test passes, commit, push, report.
```

**Human check.** Import your subscriptions. Sort channels into tabs. Live on
Home instead of YouTube's home for three days.

---

## Phase 7: Jev Smart sorting with accuracy gate

**Goal.** Items the rules cannot decide go to Jev through our Worker, and the
result is measurably better than rules alone.

**Scope.** `proxy/` is a Cloudflare Worker holding the Jev key. It accepts
`{items:[{id,text,channel}], tabs:[{name,description}]}`, asks Jev one typed
question per tab using the tab description as the prompt, caches by hash of
text for 7 days in KV, requires an install token, caps each token per day,
checks the request origin against the extension id, logs counts and errors
only. `lib/classify/jev.js` batches undecided items up to 20 per call,
applies the threshold from settings (default 0.6), falls back to rules on any
error, and never leaves an item blurred past 400 ms. Bring-your-own-key in
advanced settings calls Jev directly. `test/fixtures/labeled.json` has at
least 200 items with human labels. A mock proxy serves canned answers in
tests; with `JEV_API_KEY` set, real answers are recorded once to
`test/fixtures/jev-recorded.json`.

**Done when**

```
npm test
# unit:
#   batching, one retry, rules fallback, 400 ms ceiling honoured
#   accuracy test prints rules-only and rules+jev accuracy on labeled.json;
#     rules+jev >= rules-only + 15 points (against recorded answers when present, else mock)
# e2e:
#   Smart sorting on with mock proxy: items blur then settle, none blurred after 500 ms
#   proxy unreachable: every item still assigned
# proxy:
#   npm run test:proxy exercises cache hit, token cap, bad origin, malformed body
```

**Loop prompt**

```
Phase 7 of docs/build-plan.md. Build proxy/ as a Cloudflare Worker with
wrangler config and local tests via miniflare or wrangler dev. Build
lib/classify/jev.js and the BYOK path. If JEV_API_KEY is set, record real
answers for labeled.json to test/fixtures/jev-recorded.json; otherwise use the
mock and state plainly in your report that the gate ran against the mock.
Never commit a key. Build labeled.json from the scrubbed fixtures' structure
plus 100 synthetic items with unambiguous content per tab. Enable the Smart
sorting toggle in settings with its sentence. Add the assertions. Iterate
until npm test passes, commit, push, report.
```

**Human check.** Add `JEV_API_KEY` as an environment secret, rerun the Phase 7
prompt so answers are real, read the accuracy numbers. Verify TypeSafe's terms
allow proxied consumer use and note data retention in docs/privacy.md.

---

## Phase 8: Cookie jar, timer, and the budget

**Goal.** The timer earns cookies. YouTube's home feed, Shorts and recommended
sidebar cost them. Subscriptions, Home, and the video you came for are free.

**Scope.** `pages/earn.html` wraps `index.html` through one small hook that
fires a CustomEvent on session complete; `index.html` keeps working
standalone. `ui/jar.js` on overlay and Home. Pricing in settings, defaults:
YouTube home feed and recommended sidebar 1 cookie per 10 minutes, Shorts 1
per minute, Fun and News tabs 1 per 10 minutes, Noise 1 per minute, everything
else free. A paid surface opened with zero cookies blurs behind the jar with
"Focus for 25 minutes to earn one" and a button to Earn. Spending counts down
only while the surface is visible.

**Done when**

```
npm test
# unit: earn, spend, pause when hidden, free surfaces never charge, pricing from settings
# e2e:
#   earn.html finishing a test-shortened session adds a cookie visible on the youtube
#     fixture's jar without reload
#   zero cookies: revealing the home feed blurs it with the earn prompt
#   one cookie: reveal works, count drops to zero, a countdown is visible
#   navigating to a watch page pauses the countdown; back to home resumes it
```

**Loop prompt**

```
Phase 8 of docs/build-plan.md. Do not fork index.html; add one well-named hook
that dispatches a CustomEvent on focus session completion, load it inside
pages/earn.html, and bridge to lib/store.js. Build ui/jar.js and gating in the
youtube overlay and Home. Add a test mode making a focus session 2 seconds.
Add the assertions. Iterate until npm test passes, commit, push, report.
```

**Human check.** Run a real 25 minute session. Spend the cookie on Shorts.
Decide whether a cookie a minute is the right price. Record your choice in
the decisions log.

---

## Phase 9: Facebook overlay and capture

**Goal.** The same six tabs, controls, declutter and jar on facebook.com, plus
passive capture into Home.

**Scope.** Everything from Phases 1 to 4 and 8, parameterised by site. The
capture tool extended to Facebook. `lib/selectors/facebook.js` to the same
interface, built on aria roles (feed, article, posinset) and structure, never
class names. Declutter: right sidebar, Stories, Reels, Suggested, People You
May Know, Marketplace, metrics, badges, autoplay. Rules add a domain list of
about 300 news outlets for the News tab; Sponsored and Suggested go to Noise;
author lists drive People and Work. Every post scrolled past is captured to
IndexedDB with permalink and seen time, retention 14 days, and appears in Home
with a "seen 3h ago" chip and "Open on Facebook". Jar pricing: Fun and News
tabs and Noise as on YouTube.

**Done when**

```
npm test
# e2e suites from Phases 1-4 and 8 run against facebook fixtures, parameterised by site,
#   with at least two scrubbed snapshots from different days
# e2e: after loading a facebook fixture, home.html lists its posts under the right tabs
#   interleaved by time with youtube items
# unit: news-domains.json has >= 300 entries; sponsored/suggested cases land in Noise
```

**Loop prompt**

```
Phase 9 of docs/build-plan.md. Extend tools/capture.js to facebook.com, build
lib/selectors/facebook.js and content/facebook.js sharing everything that is
not a selector with the youtube overlay. Parameterise the existing e2e suites
by site instead of copying them. Add capture to IndexedDB and surface it in
Home. If no real facebook fixture exists yet, build a synthetic one from
Facebook's public role structure and leave a clear TODO for the human to drop
in captures. Iterate until npm test passes, commit, push, report, and tell the
human exactly how to run the capture tool on Facebook.
```

**Human check.** Capture two scrubbed Facebook snapshots on different days,
inspect them, commit, rerun. Then use Facebook for a day on tabs alone.

---

## Phase 10: X overlay, Bluesky and generic RSS

**Goal.** The same experience on x.com, and two more pull sources on Home.

**Scope.** `content/x.js` and `lib/selectors/x.js` to the shared interface.
Bluesky source via its public API with the user's handle, read only. Generic
RSS source with a URL field. Both classify through the same pipeline.

**Done when**

```
npm test
# the parameterised e2e suites run against x fixtures with at least two scrubbed snapshots
# unit: bluesky timeline fixture and a generic RSS fixture parse into the common item shape
# e2e: Home shows youtube, facebook, x, bluesky, rss items interleaved by time
```

**Loop prompt**

```
Phase 10 of docs/build-plan.md. Extend tools/capture.js to x.com, build
lib/selectors/x.js and content/x.js on the shared code, add x to the
parameterised suites, and add Bluesky and generic RSS sources in the service
worker with fixtures. Iterate until npm test passes, commit, push, report, and
tell the human to capture two x snapshots.
```

**Human check.** Capture two X snapshots, commit, rerun. Use X for a day.

---

## Phase 11: Hardening and release

**Goal.** Survives a layout change without breaking the page, runs on
Firefox, ships with a store listing and a privacy page you'd put your name on.

**Scope.** Selector health check on each page load; if any finder falls to
"none", a one-line notice "YouTube changed its layout, showing the plain
page" and the overlay disables itself for that site. The `test:live` script
runs on a schedule you choose and is the early warning. Firefox build via a
manifest tweak and `browser.*` shim. Store listing, screenshot script,
`docs/privacy.md` stating exactly what leaves the browser and when, with a
test that greps every `fetch(` host and fails if one is missing from the
policy. `npm run package` produces Chrome and Firefox zips.

**Done when**

```
npm test
# e2e: a fixture with every landmark renamed triggers graceful disable and leaves the page untouched
npm run package     # dist/feed-overlay-chrome.zip and -firefox.zip
npm run lint        # eslint, no warnings
# docs/privacy.md host-list test passes
```

**Loop prompt**

```
Phase 11 of docs/build-plan.md. Implement graceful disable on selector health
failure for every site, the Firefox build, packaging, lint, docs/privacy.md
with the host-list test, and docs/store-listing.md. Iterate until npm test and
npm run package succeed, commit, push, report.
```

**Human check.** Install the Firefox zip. Load the Chrome zip unpacked. Read
the privacy page as a stranger deciding whether to install.

---

## Later, not scheduled

- On-device classifier (transformers.js or Chrome's built-in AI) as the
  no-network middle tier between rules and Jev.
- Image text via OCR for meme-heavy Facebook feeds.
- Safari packaging through Xcode.
- Instagram web overlay.
- "Replies owed" tab from notifications.
- Shared channel and People lists across devices via sync.

---

## Status checklist

Tick when the phase's "Done when" passes in a session **and** the human check
is done.

- [x] Phase 0: Scaffold and test harness (session checks passed 2026-10-05; human check pending)
- [x] Phase 1: YouTube anatomy, capture tool, selectors (session checks passed 2026-10-05 on synthetic fixtures; test:live not runnable in cloud; human check pending: real captures)
- [ ] Phase 2: Declutter to Unhook parity
- [ ] Phase 3: Tab bar and rules classifier on YouTube
- [ ] Phase 4: Item controls and corrections
- [ ] Phase 5: Settings page
- [ ] Phase 6: Home with YouTube subscriptions via RSS
- [ ] Phase 7: Jev Smart sorting with accuracy gate
- [ ] Phase 8: Cookie jar, timer, and the budget
- [ ] Phase 9: Facebook overlay and capture
- [ ] Phase 10: X overlay, Bluesky and generic RSS
- [ ] Phase 11: Hardening and release

## Decisions log

Append a dated line whenever a fixed decision changes, with the reason.

- 2026-10-05: Plan created. Overlay before Home, Facebook before X, rules
  before Jev.
- 2026-10-05: Reordered to YouTube first. Reasons: pages load logged out so
  sessions can test live; stable named elements; subscriptions via free RSS;
  Unhook gives a known parity target before we add categories and the
  budget. Facebook moves to Phase 9, X to Phase 10.
- 2026-10-05: Jev proxy specified for a product: Cloudflare Worker, text-hash
  cache, install tokens with daily caps, origin check, no body logging,
  rules-only free, Smart sorting opt-in paid, BYOK as advanced setting.
- 2026-10-05: Phase 0 built in a cloud session. The egress policy there
  denies www.youtube.com, so `test:live` exits 2 with its message as
  designed. To run it from a cloud session, add www.youtube.com under the
  environment's Allowed domains. Headless Chromium loaded the extension with
  no headed fallback needed.
- 2026-10-05: Phase 1 built against synthetic fixtures generated from
  YouTube's known element structure (tools/make-synthetic-fixtures.mjs),
  because the cloud session cannot reach youtube.com. The "test:live must pass
  once" check is deferred to the human or to a session with www.youtube.com
  allowed. Real captures go in test/fixtures/youtube/ per its README.
