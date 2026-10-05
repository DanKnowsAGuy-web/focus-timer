// Feed Overlay capture tool.
//
// Paste this whole file into the devtools console on a youtube.com page
// (home, a watch page, /shorts/..., or /feed/subscriptions). It clones the
// page, scrubs it, and downloads youtube-<page>-<date>.html. Drop that file
// into test/fixtures/youtube/ and commit it.
//
// Scrubbing: every word of text is replaced with a same-length lorem word,
// chosen by hash so the same input always gives the same output. Channel
// handles, channel ids and video ids are replaced with stable fakes. Images
// become a 1x1 gif. Scripts, styles and inline handlers are removed. Short UI
// words that selectors rely on (LIVE, Sponsored, 1.2M views, 3 days ago,
// 12:34) are kept because they carry no personal information.
//
// In tests, set window.__feedoverlayCaptureNoAuto = true before injecting to
// skip the download and use window.__feedoverlayCapture.scrub() instead.
(function () {
  const KEEP = [
    /^(LIVE|Sponsored|Ad|Ads|Promoted|Shorts|Subscribe|Subscribed|Home|Trending|Explore|Subscriptions|Notifications|Comments|Autoplay is (on|off)|Mix|Playlist|Premiere|Upcoming|New|CC|4K|HD)$/i,
    /^[\d.,]+\s?[KMB]?\+?\s+(views?|watching|subscribers?|likes?|comments?|videos?)$/i,
    /^(Streamed |Premiered |Updated )?\d+ (second|minute|hour|day|week|month|year)s? ago$/i,
    /^\d+:\d\d(:\d\d)?$/,
    /^[\d.,]+[KMB]?\+?$/,
    /^(Premieres|Scheduled for) .*$/i,
  ];
  const WORDS = {
    1: ['a', 'i', 'o'],
    2: ['et', 'ut', 'ad', 'in', 'ex', 'id'],
    3: ['sit', 'sed', 'qui', 'eos', 'aut', 'nam', 'rem', 'vel'],
    4: ['amet', 'enim', 'quia', 'illo', 'vero', 'odio', 'nisi', 'modi'],
    5: ['lorem', 'ipsum', 'dolor', 'magna', 'autem', 'nihil', 'ipsam', 'quasi'],
    6: ['tempor', 'labore', 'veniam', 'nobis', 'fugiat', 'soluta', 'omnis', 'minima'],
    7: ['aliquam', 'eiusmod', 'laboris', 'nostrud', 'dolores', 'maxime', 'placeat'],
    8: ['adipisci', 'incidunt', 'voluptas', 'corrupti', 'quisquam', 'sapiente'],
    9: ['consequat', 'molestiae', 'provident', 'similique', 'accusamus'],
    10: ['occaecatus', 'cupiditate', 'recusandae', 'distinctio'],
    11: ['exercitatio', 'consectetur', 'repudiandae'],
    12: ['perspiciatis', 'voluptatibus', 'necessitatib'],
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function loremWord(word) {
    const len = word.length;
    const h = hash(word);
    let out;
    if (len <= 12) {
      const bucket = WORDS[len];
      out = bucket[h % bucket.length];
    } else {
      const a = WORDS[12][h % WORDS[12].length];
      out = a + loremWord(word.slice(12));
    }
    if (/^[A-Z]/.test(word)) out = out[0].toUpperCase() + out.slice(1);
    if (/^[A-Z]+$/.test(word) && len > 1) out = out.toUpperCase();
    return out;
  }

  function scrubText(text) {
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (KEEP.some((re) => re.test(trimmed))) return text;
    return text.replace(/[\p{L}\p{N}_']+/gu, (w) => (/^\d+$/.test(w) ? w : loremWord(w)));
  }

  const ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  function fakeId(seed, len) {
    let out = '';
    let h = hash(seed);
    for (let i = 0; i < len; i++) {
      h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
      out += ALPHANUM[h % ALPHANUM.length];
    }
    return out;
  }

  function scrubHref(href) {
    if (!href) return href;
    let out = href;
    out = out.replace(/([?&]v=)([\w-]{11})/g, (m, p, id) => p + fakeId('v' + id, 11));
    out = out.replace(/\/shorts\/([\w-]{11})/g, (m, id) => '/shorts/' + fakeId('v' + id, 11));
    out = out.replace(/\/@([\w.-]+)/g, (m, h) => '/@channel' + (hash(h) % 100000));
    out = out.replace(/\/channel\/(UC[\w-]{22})/g, (m, id) => '/channel/UC' + fakeId('c' + id, 22));
    out = out.replace(/\/(c|user)\/([\w.-]+)/g, (m, kind, name) => '/' + kind + '/channel' + (hash(name) % 100000));
    out = out.replace(/([?&]list=)([\w-]+)/g, (m, p, id) => p + fakeId('l' + id, id.length));
    if (/^https?:\/\//.test(out) && !/^https?:\/\/(www\.)?youtube\.com/.test(out)) out = 'https://example.invalid/';
    return out;
  }

  const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'IFRAME', 'TEMPLATE', 'VIDEO', 'SOURCE', 'TRACK', 'META']);
  const TEXT_ATTRS = ['title', 'aria-label', 'alt', 'placeholder', 'aria-description', 'label'];

  function scrubElement(el) {
    for (const child of [...el.children]) {
      if (DROP_TAGS.has(child.tagName) && !(child.tagName === 'META' && child.getAttribute('charset'))) {
        child.remove();
        continue;
      }
      if (child.tagName === 'SVG' || child.tagName === 'svg') { child.innerHTML = ''; continue; }
      scrubElement(child);
    }
    for (const attr of [...el.attributes]) {
      const n = attr.name;
      if (n.startsWith('on') || n === 'style' || n === 'srcset' || n === 'nonce' || n === 'integrity') { el.removeAttribute(n); continue; }
      if (n === 'src' || n === 'poster') { el.setAttribute(n, GIF); continue; }
      if (n === 'href') { el.setAttribute(n, scrubHref(attr.value)); continue; }
      if (TEXT_ATTRS.includes(n)) { el.setAttribute(n, scrubText(attr.value)); continue; }
      if (n.startsWith('data-') && /\S{20,}/.test(attr.value)) { el.removeAttribute(n); continue; }
    }
    for (const node of el.childNodes) {
      if (node.nodeType === 3) node.nodeValue = scrubText(node.nodeValue);
      if (node.nodeType === 8) node.remove();
    }
  }

  function pageType() {
    const p = location.pathname;
    if (p === '/') return 'home';
    if (p.startsWith('/watch')) return 'watch';
    if (p.startsWith('/shorts')) return 'shorts';
    if (p.startsWith('/feed/subscriptions')) return 'subscriptions';
    if (p.startsWith('/feed/channels')) return 'channels';
    return 'other';
  }

  function scrub(doc) {
    doc = doc || document;
    const clone = doc.documentElement.cloneNode(true);
    scrubElement(clone);
    const head = clone.querySelector('head');
    if (head) {
      head.innerHTML = '<meta charset="utf-8"><title>YouTube</title>';
    }
    clone.setAttribute('data-feedoverlay-capture', new Date().toISOString().slice(0, 10) + ' ' + pageType() + ' ' + location.pathname);
    return '<!doctype html>\n' + clone.outerHTML;
  }

  function download(filename) {
    const html = scrub();
    const name = filename || ('youtube-' + pageType() + '-' + new Date().toISOString().slice(0, 10) + '.html');
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return name;
  }

  window.__feedoverlayCapture = { scrub, download, scrubText, scrubHref, pageType };
  if (!window.__feedoverlayCaptureNoAuto) {
    const name = download();
    console.log('Feed Overlay: downloaded ' + name + '. Rename to <page>-<date>.html and put it in test/fixtures/youtube/.');
  }
})();
