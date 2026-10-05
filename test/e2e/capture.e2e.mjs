import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchWithExtension, toolsDir, setSettings, yt } from './harness.mjs';

const RAW = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Secret Person - YouTube</title>
<style>body{color:red}</style><script>window.leak = 1;</script></head>
<body>
<ytd-app><div id="content"><ytd-browse page-subtype="home" role="main"><ytd-rich-grid-renderer><div id="contents">
<ytd-rich-item-renderer><div id="content"><ytd-rich-grid-media>
  <ytd-thumbnail><a id="thumbnail" href="/watch?v=REALVIDEO01"><img src="https://i.ytimg.com/vi/REALVIDEO01/hq720.jpg" srcset="x 1x" alt="Secret Title Here"></a></ytd-thumbnail>
  <h3><a id="video-title-link" href="/watch?v=REALVIDEO01" title="Secret Title Here"><yt-formatted-string id="video-title">Secret Title Here</yt-formatted-string></a></h3>
  <ytd-channel-name><a href="/@realperson">Real Person</a></ytd-channel-name>
  <div id="metadata-line"><span class="inline-metadata-item">1.2M views</span><span class="inline-metadata-item">3 days ago</span></div>
  <ytd-thumbnail-overlay-time-status-renderer overlay-style="LIVE"><span id="text">LIVE</span></ytd-thumbnail-overlay-time-status-renderer>
  <ytd-badge-supported-renderer><div class="badge"><span>Sponsored</span></div></ytd-badge-supported-renderer>
  <a href="https://tracking.example.com/click?u=1">Shop now</a>
  <a href="/channel/UCabcdefghijklmnopqrstuv">Another Real Channel</a>
</ytd-rich-grid-media></div></ytd-rich-item-renderer>
</div></ytd-rich-grid-renderer></ytd-browse></div></ytd-app>
<!-- a comment with Secret in it -->
</body></html>`;

test('capture tool scrubs text, names, ids and images but keeps structure and UI words', async () => {
  const captureSrc = await readFile(path.join(toolsDir, 'capture.js'), 'utf8');
  const context = await launchWithExtension();
  try {
    await setSettings(context, yt({ enabled: false }));
    const page = await context.newPage();
    await page.route('https://www.youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: RAW }));
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { window.__feedoverlayCaptureNoAuto = true; });
    await page.addScriptTag({ content: captureSrc });
    const out = await page.evaluate(() => window.__feedoverlayCapture.scrub());

    // Personal content gone.
    assert.doesNotMatch(out, /Secret/);
    assert.doesNotMatch(out, /Real Person/);
    assert.doesNotMatch(out, /realperson/);
    assert.doesNotMatch(out, /REALVIDEO01/);
    assert.doesNotMatch(out, /UCabcdefghijklmnopqrstuv/);
    assert.doesNotMatch(out, /i\.ytimg\.com/);
    assert.doesNotMatch(out, /tracking\.example\.com/);
    assert.doesNotMatch(out, /<script/);
    assert.doesNotMatch(out, /<style/);
    assert.doesNotMatch(out, /srcset=/);
    assert.doesNotMatch(out, /<!--/);
    assert.doesNotMatch(out, /window\.leak/);

    // Structure and UI words kept.
    assert.match(out, /<ytd-rich-item-renderer>/);
    assert.match(out, /id="video-title"/);
    assert.match(out, /overlay-style="LIVE"/);
    assert.match(out, />LIVE</);
    assert.match(out, />Sponsored</);
    assert.match(out, />1\.2M views</);
    assert.match(out, />3 days ago</);
    assert.match(out, /href="\/watch\?v=[\w-]{11}"/);
    assert.match(out, /href="\/@channel\d+"/);
    assert.match(out, /href="\/channel\/UC[\w-]{22}"/);
    assert.match(out, /data-feedoverlay-capture="\d{4}-\d{2}-\d{2} home \/"/);

    // Same-length lorem, stable across runs.
    const again = await page.evaluate(() => window.__feedoverlayCapture.scrub());
    assert.equal(out, again);
    const title = out.match(/id="video-title">([^<]+)</)[1];
    assert.equal(title.length, 'Secret Title Here'.length);
    assert.match(title, /^[A-Z]/);
  } finally {
    await context.close();
  }
});
