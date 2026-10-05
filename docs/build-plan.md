# Feed Overlay: full build map with loop prompts

One browser extension, two surfaces. The **Overlay** rewrites the feed inside
facebook.com (later x.com, youtube.com). **Home** is the extension's own page
that shows everything captured and pulled, sorted into the same tabs. The
cookie jar from the focus timer in `index.html` is the currency that gates the
distracting tabs.

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
- **Browsers:** Chrome and Edge first. Firefox from the same code in Phase 10.
  Safari notes only.
- **Tests:** Node's built-in test runner (`node --test`) for units. Playwright
  for end to end, using the preinstalled Chromium at
  `/opt/pw-browsers/chromium`. Extensions need Chromium's new headless mode,
  so launch with `channel: 'chromium'` and `launchPersistentContext` with
  `--load-extension`.
- **No live Facebook in tests.** Sessions cannot log in. Tests serve saved,
  scrubbed snapshots of the feed at `https://www.facebook.com/` via
  Playwright's `page.route`, so content scripts inject exactly as in
  production.
- **Scrubbing is mandatory** before any snapshot is committed. Text is
  replaced word for word with same-length lorem, names are replaced with
  stable fake names, image URLs are replaced with a 1x1 placeholder. The
  capture tool does this; no raw snapshot is ever committed.
- **Default tabs:** People, Learn, Work, Fun, News, Noise. Users rename, add,
  delete, capped at eight.
- **Precedence** for where a post lands: exact per-post correction, then
  author list, then classifier. Family posting about politics lands in People.
- **Classifier tiers:** rules (author, domain, keyword) always run first and
  are free. Jev runs only on posts the rules did not decide, only when the
  user has opted in, only through our proxy. On-device fallback is a later
  phase.
- **Privacy:** nothing leaves the browser except, with opt in, the text of a
  post sent to the Jev proxy. No analytics. Settings has Export and Delete
  everything.
- **The extension never acts on your behalf.** It hides, reorders, blurs and
  captures. It never clicks, follows, unfollows, likes or posts.

---

## Target repo layout

```
focus-timer/
  index.html                 existing timer (becomes the Earn page in Phase 8)
  docs/build-plan.md         this file
  extension/
    manifest.json
    src/
      content/facebook.js    overlay entry for facebook.com
      content/x.js           Phase 9
      lib/selectors/facebook.js   selector module with fallbacks + health check
      lib/classify/rules.js  author, domain, keyword rules
      lib/classify/jev.js    proxy client, Phase 6
      lib/store.js           IndexedDB + chrome.storage wrappers
      lib/tabs.js            tab definitions, precedence
      ui/tabbar.js           shared tab bar component (overlay + Home)
      ui/postcontrols.js     Save, Wrong tab, Hide author
      ui/jar.js              cookie jar widget, Phase 8
      pages/settings.html    Phase 5, grows into Home
      pages/home.html        Phase 7
      pages/earn.html        Phase 8, wraps the timer
    dist/                    esbuild output, gitignored
  proxy/                     Phase 6, tiny server holding the Jev key
  tools/capture.js           dev tool that snapshots and scrubs a live feed
  test/
    unit/
    e2e/
    fixtures/facebook/*.html scrubbed snapshots, dated
    fixtures/labeled.json    posts with human labels, Phase 6
  package.json               scripts: build, test, test:unit, test:e2e
```

---

## Phase 0: Scaffold and test harness

**Goal.** An extension that loads, does nothing visible, and a test suite that
can prove a content script ran on a fixture served as facebook.com.

**Scope.** `package.json`, esbuild config, MV3 manifest with a content script
for `https://www.facebook.com/*`, Playwright harness that loads `dist/` into
Chromium, one fixture page that is just a hand-written minimal feed skeleton,
`.gitignore` for `dist/` and `node_modules/`.

**Done when**

```
npm install
npm run build            # produces extension/dist with manifest and content script
npm run test:unit        # at least one passing unit test
npm run test:e2e         # loads extension, routes facebook.com to the fixture,
                         # asserts the content script set data-feedoverlay="ready" on <html>
npm test                 # runs both, exit 0
```

**Loop prompt**

```
Phase 0 of docs/build-plan.md. Create the extension scaffold and test harness
described under "Target repo layout" and "Fixed decisions". The e2e test must
launch the preinstalled Chromium at /opt/pw-browsers/chromium with the built
extension loaded, intercept https://www.facebook.com/ with page.route to serve
test/fixtures/facebook/skeleton.html, and assert the content script marked
<html data-feedoverlay="ready">. Make `npm test` run units then e2e and exit 0.
If Chromium refuses to load the extension headless, switch to the new headless
mode (channel 'chromium'); do not fall back to headed. Iterate until npm test
passes, then commit, push, and report.
```

**Human check.** Load `extension/dist` unpacked in Chrome, open Facebook,
confirm the console shows the ready marker and nothing else changed.

---

## Phase 1: Facebook feed anatomy, capture tool, selectors

**Goal.** Know where posts, authors, text, link previews, metrics, sidebars
and the feed container live, and prove it against real scrubbed snapshots.

**Scope.** `tools/capture.js`, runnable from the browser console on a real
feed, that walks the feed, scrubs text and names and images, and downloads a
single HTML file. A selector module with a primary and at least one fallback
strategy per element, plus `healthCheck()` that returns which strategies hit
on the current page. At least two real scrubbed snapshots committed, from
different days. The e2e test runs the selector module against every fixture.

**Done when**

```
npm test
# plus these assertions in e2e, per fixture under test/fixtures/facebook/:
#   finds >= 8 posts
#   every post yields author text, body text (may be empty), and a stable id
#   finds the feed container and the right sidebar
#   healthCheck() reports which strategy matched, none report "none"
#   a fixture with one post's primary class names mangled still finds it via fallback
```

**Loop prompt**

```
Phase 1 of docs/build-plan.md. Build tools/capture.js and
extension/src/lib/selectors/facebook.js. Capture works by being pasted into the
devtools console on facebook.com: it finds the feed, scrubs every text node
(same-length lorem, stable fake author names, 1x1 image placeholders) and
downloads facebook-YYYY-MM-DD.html. The selector module exposes findFeed(),
findPosts(), parsePost(el) returning {id, author, text, links, hasVideo,
isSponsored, isSuggested}, findSidebars(), findMetrics(postEl), and
healthCheck(). Each finder tries a primary strategy (aria roles and structural
position, never bare class names) then a fallback. Add e2e assertions listed
under Done when. If no real fixture exists yet, write the capture tool, build
a realistic synthetic fixture from Facebook's public role structure
(role=feed, role=article, aria-labelledby, aria-posinset), and leave a clear
TODO for the human to drop in real captures. Iterate until npm test passes,
commit, push, report, and tell the human exactly how to run the capture tool.
```

**Human check.** Run the capture tool on your real feed, inspect the file to
confirm no real names or text survived, commit it to fixtures, re-run
`npm test`.

---

## Phase 2: Declutter

**Goal.** Opening Facebook with the extension on gives you the feed and
nothing else. No sidebars, Reels, Stories, Suggested, People You May Know, no
like counts, no view counts, no notification badge number, no autoplay.

**Scope.** Content script applies declutter rules on load and on every
mutation. A per-site settings object in `chrome.storage.sync` with toggles:
sidebars, stories, reels, suggested, metrics, badges, autoplay. All default
on. A single "Show Facebook's extras" link at the top restores everything for
the current page load only. Mutation handling must not thrash: measure and
cap work per animation frame.

**Done when**

```
npm test
# e2e per fixture:
#   right sidebar, stories tray, reels tray, suggested blocks are display:none
#   metric elements inside posts are hidden; post body text is still visible
#   clicking "Show Facebook's extras" restores them; reload hides them again
#   toggling settings.metrics=false via chrome.storage leaves metrics visible
#   appending 50 cloned posts to the feed in one tick is processed within 2 frames
#     and leaves no post un-decluttered
```

**Loop prompt**

```
Phase 2 of docs/build-plan.md. Implement declutter in the facebook content
script using the Phase 1 selectors. Use a single MutationObserver on the feed
container, batch work with requestAnimationFrame, and never query the whole
document per mutation. Read toggles from chrome.storage.sync under
settings.sites.facebook with the defaults listed. Add the "Show Facebook's
extras" link. Write the e2e assertions under Done when, including the 50-post
burst test. Iterate until npm test passes, commit, push, report.
```

**Human check.** Open Facebook. Scroll for two minutes. Nothing but posts.
No layout jumps. Messenger, groups, events, profiles untouched.

---

## Phase 3: Tab bar and rules classifier

**Goal.** Your six tabs across the top of the feed. Each post goes to exactly
one tab. The active tab shows its posts; others collapse to a thin line with a
count that expands on click.

**Scope.** `lib/tabs.js` with the default tab set, names, descriptions and
order, stored in `chrome.storage.sync`. `lib/classify/rules.js` with three
rule types: author list (People, Work), domain list (News from a committed
list of ~300 news domains, Fun from a short list), keyword list per tab.
Sponsored and Suggested always go to Noise. Unmatched posts go to the active
tab's nearest default, which is Learn for long text and Fun for short. The
shared `ui/tabbar.js` component renders in the feed and is reusable in Home.
Active tab is remembered per site.

**Done when**

```
npm test
# unit:
#   classify() on 40 hand-written posts in test/unit/rules.cases.json lands all 40
#     where the case file says (cases cover sponsored, suggested, news domain,
#     author in People, keyword hits, and the long/short fallback)
#   precedence: author list beats keyword and domain
# e2e per fixture:
#   tab bar is rendered above the first post with six tabs
#   every post has exactly one data-feedtab attribute
#   clicking Noise shows only Noise posts; other posts become one collapsed row each
#   clicking a collapsed row expands that post inline
#   active tab survives reload
```

**Loop prompt**

```
Phase 3 of docs/build-plan.md. Implement lib/tabs.js, lib/classify/rules.js
and ui/tabbar.js per the scope. Commit the news domain list as
extension/src/lib/classify/news-domains.json with at least 300 entries from
widely known outlets. Write test/unit/rules.cases.json with 40 cases and make
all pass. Render the tab bar through the Phase 2 mutation pipeline so late
posts are classified too. Add the e2e assertions. Iterate until npm test
passes, commit, push, report.
```

**Human check.** Use Facebook for a day on tabs alone. Note how many posts
land wrong. That number is the baseline Jev must beat in Phase 6.

---

## Phase 4: Post controls and corrections

**Goal.** Every post has Save, Wrong tab, Hide author. Corrections stick and
change future classification.

**Scope.** `ui/postcontrols.js` rendered into each post. Wrong tab shows the
tab list; picking one moves the post immediately and stores a per-post
correction. Hide author adds the author to a hidden list and collapses all
their posts to Noise. Save stores the parsed post with timestamp. All three
stored in IndexedDB through `lib/store.js`. Corrections are also counted per
keyword so Phase 6 can measure classifier error.

**Done when**

```
npm test
# unit:
#   store round-trips corrections, saves, hidden authors
#   precedence: per-post correction beats author list beats classifier
# e2e:
#   Wrong tab -> Learn moves the post and persists across reload of the same fixture
#   Hide author collapses every post by that author into Noise, persists
#   Save adds the post to the saved list; a Saved count appears in the tab bar
#   controls are keyboard reachable and have aria labels
```

**Loop prompt**

```
Phase 4 of docs/build-plan.md. Implement ui/postcontrols.js and lib/store.js
on IndexedDB. Wire precedence in lib/tabs.js: exact post correction, then
author lists, then rules. Record a correction log entry {postId, from, to,
keywordsHit, ts} on every Wrong tab. Add the e2e assertions. Iterate until npm
test passes, commit, push, report.
```

**Human check.** Correct ten posts. Reload. All ten stay put. Hide one noisy
author. They are gone everywhere.

---

## Phase 5: Settings page

**Goal.** One page for everything configurable. This page becomes Home later,
so it uses the same layout shell and theme tokens as `index.html`.

**Scope.** `pages/settings.html` reachable from the toolbar icon. Sections:
Tabs (rename, reorder, edit description, add up to eight, delete), People
list, Work list, Per-site toggles from Phase 2, Privacy (classifier mode:
rules only by default, Jev opt in greyed until Phase 6), Export all data as
JSON, Delete everything. Light and dark via the same tokens as the timer.

**Done when**

```
npm test
# e2e on chrome-extension://<id>/pages/settings.html:
#   renaming a tab updates the tab bar on the facebook fixture
#   adding a ninth tab is refused with a visible message
#   Export produces JSON containing tabs, lists, corrections, saved posts
#   Delete everything clears storage; the facebook fixture then shows defaults
#   page is usable at 375px wide with no horizontal scroll
```

**Loop prompt**

```
Phase 5 of docs/build-plan.md. Build pages/settings.html with the sections in
scope. Reuse the color tokens and font from index.html. Set the toolbar action
to open it. Everything reads and writes through lib/store.js and
chrome.storage.sync so the content script picks up changes live via
storage.onChanged. Add the e2e assertions. Iterate until npm test passes,
commit, push, report.
```

**Human check.** Rename Fun to Hobbies on the settings page with Facebook open
in another tab. The tab bar updates without reload.

---

## Phase 6: Jev classifier with accuracy gate

**Goal.** Posts the rules cannot decide go to Jev, through our proxy, and the
result is measurably better than rules alone.

**Scope.** `proxy/` is a minimal HTTP server that holds the Jev key, accepts
`{posts:[{id,text,linkTitle,domain}], tabs:[{name,description}]}`, asks Jev
one typed question per tab with the tab description as the prompt, caches by
post id for 24 hours, rate limits per client, and returns probabilities.
`lib/classify/jev.js` batches undecided posts, calls the proxy, applies a
threshold from settings (default 0.6), and falls back to rules on any error.
Posts are blurred until a result arrives, with a 400 ms ceiling after which
rules decide. `test/fixtures/labeled.json` holds at least 200 scrubbed posts
with a human-assigned tab. A mock proxy serves canned answers in tests.

**Done when**

```
npm test
# unit:
#   jev client batches up to 20 posts per request, retries once, falls back to rules
#   on a 400 ms timeout a post is assigned by rules and never left blurred
# accuracy (node test, uses labeled.json and recorded Jev answers in
#   test/fixtures/jev-recorded.json when present, else mock):
#   rules-only accuracy is printed
#   rules+jev accuracy is printed and is >= rules-only + 15 points
# e2e:
#   with classifier mode = jev and the mock proxy, posts blur then settle
#     with no post blurred after 500 ms
#   with the proxy unreachable, every post is still assigned
# proxy:
#   npm run test:proxy exercises cache hit, rate limit, malformed body
```

**Loop prompt**

```
Phase 6 of docs/build-plan.md. Build proxy/ and lib/classify/jev.js. If JEV_API_KEY
is set in the environment, run the labeled set through the real proxy once and
save the answers to test/fixtures/jev-recorded.json so later runs are offline
and deterministic. If it is not set, use the mock and say clearly in your
report that the accuracy gate ran against the mock and must be re-run with a
key. Never commit a key. Build the labeled set by taking posts from the
scrubbed fixtures and labeling them yourself by their structure (sponsored,
domain, length) plus 100 synthetic posts you write with unambiguous content
for each tab. Add the assertions under Done when. Iterate until npm test
passes, commit, push, report.
```

**Human check.** Set `JEV_API_KEY` in the session's environment secrets. Rerun
Phase 6's loop prompt so the recorded answers come from real Jev. Read the
printed accuracy numbers. Then use Facebook for a day in Jev mode and count
wrong tabs against the Phase 3 baseline.

---

## Phase 7: Capture and Home

**Goal.** Everything you scroll past on Facebook is saved locally. Home shows
it, plus YouTube channels via RSS, in the same six tabs.

**Scope.** Content script writes every parsed post to IndexedDB with tab,
source, seen timestamp, and the permalink. Retention 14 days, configurable.
`pages/home.html` reuses `ui/tabbar.js` and `ui/postcontrols.js`, lists posts
newest first across sources, shows a source chip and "seen 3h ago" for
captured items, "Open on Facebook" linking to the permalink, and inline
thumbnails. YouTube source: paste a channel URL, the extension resolves the
channel id and polls its RSS feed every 30 minutes from the service worker.
Videos classify by title and description through the same pipeline. Option to
make Home the new tab page.

**Done when**

```
npm test
# unit:
#   capture dedupes by post id, honours retention
#   youtube channel URL -> channel id -> feed URL resolution for the three URL shapes
#   RSS parse of a saved YouTube feed fixture yields items with id, title, published
# e2e:
#   after loading a facebook fixture, home.html lists its posts under the right tabs
#   Wrong tab on Home moves the post on the facebook fixture too (shared store)
#   adding a YouTube channel (fixture RSS served via route) shows its videos
#   Home renders 500 items without jank: scroll test completes under 2 s
```

**Loop prompt**

```
Phase 7 of docs/build-plan.md. Implement capture in the facebook content
script, the YouTube RSS source in the service worker with chrome.alarms, and
pages/home.html reusing the shared components. Commit a YouTube RSS fixture
under test/fixtures/youtube/. Add the new-tab override as an opt in setting,
default off. Add the e2e assertions. Iterate until npm test passes, commit,
push, report.
```

**Human check.** Browse Facebook for ten minutes, open Home, see what you saw,
in tabs. Add two YouTube channels. Come back in an hour.

---

## Phase 8: Cookie jar and timer integration

**Goal.** The timer earns cookies. Fun, News and Noise spend them. People,
Learn and Work are always free.

**Scope.** `pages/earn.html` wraps `index.html` with a thin adapter so a
finished focus session writes one cookie to the shared store. `ui/jar.js`
shows the count on the overlay and Home. Tab pricing in settings, defaults:
Fun 1 cookie per 10 minutes, News 1 per 10 minutes, Noise 1 per minute, others
free. When a paid tab is opened with zero cookies, its posts blur behind the
jar with "Focus for 25 minutes to earn one" and a button to the Earn page.
Spending is a session that counts down only while the tab is visible.

**Done when**

```
npm test
# unit:
#   earn increments, spend decrements, a session pauses when the page is hidden
#   pricing is read from settings; free tabs never charge
# e2e:
#   earn.html finishing a (test-shortened) focus session adds a cookie visible on
#     the facebook fixture's jar without reload
#   with zero cookies, clicking News blurs posts and shows the earn prompt
#   with one cookie, clicking News unblurs and the count drops to zero
#   switching to People with a session running pauses the countdown
```

**Loop prompt**

```
Phase 8 of docs/build-plan.md. Do not fork index.html. Load it inside
pages/earn.html and bridge its "session complete" moment to lib/store.js by
adding one small, well-named hook to index.html that fires a CustomEvent;
keep index.html working standalone. Build ui/jar.js and the gating in the
overlay and Home. Add a test mode that makes a focus session 2 seconds for
e2e. Add the assertions. Iterate until npm test passes, commit, push, report.
```

**Human check.** Run one real 25 minute session. Spend the cookie on News. Feel
whether the price is right. Adjust defaults in settings and note what you
picked.

---

## Phase 9: X overlay, Bluesky and RSS sources

**Goal.** The same experience on x.com, and two more pull sources on Home.

**Scope.** `content/x.js` and `lib/selectors/x.js` with the same interface as
Facebook's, same declutter toggles, same tab bar, same capture. Bluesky source
via its public API with the user's handle, read only. Generic RSS source with
a URL field. Both classify through the same pipeline.

**Done when**

```
npm test
# the Phase 1 through 4 and Phase 7 e2e suites run against x fixtures too,
#   parameterised by site, with at least two scrubbed x snapshots
# unit: bluesky timeline fixture and a generic RSS fixture parse into the common post shape
# e2e: Home shows facebook, x, youtube, bluesky, rss items interleaved by time
```

**Loop prompt**

```
Phase 9 of docs/build-plan.md. Extend tools/capture.js to work on x.com.
Build lib/selectors/x.js to the same interface as facebook.js and content/x.js
by sharing everything that is not a selector. Parameterise the existing e2e
suites by site rather than copying them. Add Bluesky and generic RSS sources
in the service worker with fixtures. Iterate until npm test passes, commit,
push, report, and tell the human to capture two x snapshots.
```

**Human check.** Capture two X snapshots, commit, rerun. Use X for a day.

---

## Phase 10: Hardening and release

**Goal.** It survives a Facebook layout change without a panic, runs on
Firefox, and has a store listing and privacy page you'd put your name on.

**Scope.** Selector health check runs on each page load; if any finder falls
to "none", the overlay shows a one-line notice "Facebook changed its layout,
showing the plain feed" and disables itself for that site rather than
breaking the page. No telemetry; the notice is the signal. Firefox build via a
manifest tweak and `browser.*` shim. Store listing text, screenshots script,
privacy page stating exactly what leaves the browser and when. Version
bumping and a `npm run package` that produces zips for Chrome and Firefox.

**Done when**

```
npm test
# e2e: a fixture with every landmark renamed triggers the graceful-disable notice
#   and leaves Facebook's own layout untouched
# npm run package produces dist/feed-overlay-chrome.zip and -firefox.zip
# npm run lint passes (eslint, no warnings)
# docs/privacy.md exists and matches what the code does (grep for fetch() calls
#   and list every host contacted; the test fails if a host is not in privacy.md)
```

**Loop prompt**

```
Phase 10 of docs/build-plan.md. Implement the graceful-disable path on
selector health failure, the Firefox build, packaging, lint, and
docs/privacy.md with the host-list test described. Write the store listing
in docs/store-listing.md. Iterate until npm test and npm run package
succeed, commit, push, report.
```

**Human check.** Install the Firefox zip. Load the Chrome zip as unpacked.
Read the privacy page as if you were a stranger deciding whether to install.

---

## Later, not scheduled

- On-device classifier (transformers.js or Chrome's built-in AI) as a
  no-network alternative to Jev.
- Image text via OCR for meme-heavy feeds.
- Safari packaging through Xcode.
- Instagram web overlay.
- "Replies owed" tab from notifications.
- Shared People lists across devices via sync.

---

## Status checklist

Tick when the phase's "Done when" passes in a session **and** the human check
is done.

- [ ] Phase 0: Scaffold and test harness
- [ ] Phase 1: Facebook feed anatomy, capture tool, selectors
- [ ] Phase 2: Declutter
- [ ] Phase 3: Tab bar and rules classifier
- [ ] Phase 4: Post controls and corrections
- [ ] Phase 5: Settings page
- [ ] Phase 6: Jev classifier with accuracy gate
- [ ] Phase 7: Capture and Home
- [ ] Phase 8: Cookie jar and timer integration
- [ ] Phase 9: X overlay, Bluesky and RSS sources
- [ ] Phase 10: Hardening and release

## Decisions log

Append a dated line whenever a fixed decision changes, with the reason.

- 2026-10-05: Plan created. Overlay before Home, Facebook before X, rules
  before Jev.
