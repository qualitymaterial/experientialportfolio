# Persistent Audio Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a visitor-selected soundtrack playing continuously while same-site navigation moves between the portfolio homepage and any Field Note.

**Architecture:** Add a fixed audio host and a progressive router that remain outside each document's route root. The router fetches and parses same-origin HTML, replaces only route markup/styles/metadata, and uses explicit lifecycle hooks to start and stop homepage visual effects without touching the live `<audio>` element.

**Tech Stack:** Static HTML, CSS, browser Fetch API, DOMParser, History API, sessionStorage, Node built-in test runner.

---

## File Structure

- Create: `assets/persistent-audio.css` — fixed player UI and route-transition styles shared by all documents.
- Create: `assets/persistent-navigation.mjs` — audio state, same-origin router, metadata replacement, accessibility/focus behavior, and pure helpers exported for Node tests.
- Create: `assets/home-experience.mjs` — homepage-only visual effect mount/unmount registry.
- Create: `tests/persistent-navigation.test.mjs` — Node tests for link interception and URL/hash routing helpers.
- Modify: `index.html` — mark route-only styles/content/scripts, remove the embedded player, load shared assets, and register homepage effects.
- Modify: `v3-experiential.html` — mirror `index.html` while the duplicate remains published in the repository.
- Modify: `notes/*.html` — add route markers and shared assets to all nine Field Notes.

### Task 1: Add Route Helper Tests

**Files:**
- Create: `tests/persistent-navigation.test.mjs`
- Create: `assets/persistent-navigation.mjs`

- [ ] **Step 1: Write the failing helper tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRoutableLocation,
  shouldInterceptLink,
  targetScrollId,
} from '../assets/persistent-navigation.mjs';

test('routes only same-origin portfolio documents', () => {
  assert.equal(isRoutableLocation(new URL('https://site.test/notes/test.html'), new URL('https://site.test/')), true);
  assert.equal(isRoutableLocation(new URL('https://cal.com/example'), new URL('https://site.test/')), false);
  assert.equal(isRoutableLocation(new URL('mailto:hello@example.com'), new URL('https://site.test/')), false);
});

test('preserves native behavior for modified, download, and new-tab links', () => {
  const link = { target: '', hasAttribute: (name) => name === 'download' };
  assert.equal(shouldInterceptLink({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, link), false);
  assert.equal(shouldInterceptLink({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }, { target: '', hasAttribute: () => false }), false);
  assert.equal(shouldInterceptLink({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, { target: '_blank', hasAttribute: () => false }), false);
});

test('extracts a hash target without the leading hash', () => {
  assert.equal(targetScrollId(new URL('https://site.test/index.html#notes')), 'notes');
  assert.equal(targetScrollId(new URL('https://site.test/notes/test.html')), '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/persistent-navigation.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` because `assets/persistent-navigation.mjs` does not exist.

- [ ] **Step 3: Add the minimal exported helpers**

```js
export function isRoutableLocation(target, current) {
  return target.origin === current.origin && /^\/(?:index\.html|notes\/[^/]+\.html)?$/.test(target.pathname);
}

export function shouldInterceptLink(event, link) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    link.target !== '_blank' && !link.hasAttribute('download');
}

export function targetScrollId(url) {
  return url.hash.slice(1);
}
```

- [ ] **Step 4: Run the helper tests**

Run: `node --test tests/persistent-navigation.test.mjs`

Expected: all three tests pass.

- [ ] **Step 5: Commit the test foundation**

```bash
git add tests/persistent-navigation.test.mjs assets/persistent-navigation.mjs
git commit -m "test: cover persistent navigation helpers"
```

### Task 2: Create the Persistent Player And Shared Route Shell

**Files:**
- Create: `assets/persistent-audio.css`
- Modify: `index.html`
- Modify: `v3-experiential.html`
- Modify: `notes/infrastructure-that-pays-for-itself.html`
- Modify: `notes/making-a-room-respond-to-its-own-energy.html`
- Modify: `notes/reading-a-room-with-wifi.html`
- Modify: `notes/screens-that-stay-alive.html`
- Modify: `notes/sub-250ms-latency-in-a-live-telemetry-platform.html`
- Modify: `notes/the-overlap-is-the-job.html`
- Modify: `notes/the-room-already-has-sensors.html`
- Modify: `notes/why-your-av-system-should-have-an-api.html`
- Modify: `notes/zone-audio-without-a-sound-engineer.html`

- [ ] **Step 1: Add the shared player stylesheet**

```css
#persistent-audio-host {
  position: fixed;
  z-index: 100;
  right: max(20px, 3vw);
  top: 68px;
}

.persistent-audio__button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(233, 229, 220, .18);
  border-radius: 999px;
  padding: 9px 12px;
  background: rgba(11, 11, 12, .76);
  backdrop-filter: blur(12px);
  color: #8c877c;
  font: 11px 'IBM Plex Mono', monospace;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.persistent-audio__button[data-playing="true"] { color: var(--signal, #9dff3f); }
#route-root { transition: opacity .18s ease, transform .18s ease; }
#route-root[data-loading="true"] { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) { #route-root { transition: none; } }
```

- [ ] **Step 2: Mark every page's replaceable content and load the shared assets**

Add to each document head:

```html
<link rel="stylesheet" href="/assets/persistent-audio.css" />
<script type="module" src="/assets/persistent-navigation.mjs"></script>
```

Wrap every page-specific body node in:

```html
<div id="route-root" data-route-kind="home">
  <!-- homepage-only body content -->
</div>
```

Use `data-route-kind="article"` for every Field Note. Keep the shared player host outside this wrapper:

```html
<div id="persistent-audio-host" aria-live="polite">
  <button class="persistent-audio__button" id="persistent-audio-button" type="button" aria-label="Play music" data-playing="false">
    <span aria-hidden="true">♪</span><span id="persistent-audio-track">MUSIC</span>
  </button>
  <audio id="persistent-audio-element" preload="metadata"></audio>
</div>
```

Replace the homepage status-bar `#audio-btn`, `#audio-track`, and `#audio-el` markup and CSS with this shared host. Remove the existing inline audio-player IIFE.

- [ ] **Step 3: Run static structural assertions**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
for (const file of ['index.html', 'v3-experiential.html', ...fs.readdirSync('notes').filter((f) => f.endsWith('.html')).map((f) => `notes/${f}`)]) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('id="route-root"') || !html.includes('id="persistent-audio-host"') || !html.includes('/assets/persistent-navigation.mjs')) throw new Error(`Missing route shell in ${file}`);
}
console.log('route shell present in every document');
NODE
```

Expected: `route shell present in every document`.

- [ ] **Step 4: Commit the shared shell**

```bash
git add assets/persistent-audio.css index.html v3-experiential.html notes/*.html
git commit -m "feat: add persistent audio shell"
```

### Task 3: Implement Audio State And Progressive Navigation

**Files:**
- Modify: `assets/persistent-navigation.mjs`

- [ ] **Step 1: Implement a persistent audio controller**

Use this track definition and storage key:

```js
const TRACKS = [
  { src: '/audio/shadows-of-the-samurai.mp3', label: 'SHADOWS OF THE SAMURAI' },
  { src: '/audio/clean-windows.mp3', label: 'CLEAN WINDOWS' },
];
const AUDIO_STATE_KEY = 'persistent-audio-state';
```

The controller must save `{ trackIndex, currentTime, volume, wasPlaying }` on
`timeupdate`, `pause`, `play`, and `pagehide`. It restores a track/time on load,
but calls `audio.play()` only when the session state says `wasPlaying: true` and
the browser allows the resumed user-initiated media session. A rejected play
promise leaves the player paused with an accurate accessible label.

- [ ] **Step 2: Implement document parsing and asset replacement**

Add these functions to `assets/persistent-navigation.mjs`:

```js
function parseRoute(html) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const root = document.querySelector('#route-root');
  if (!root) throw new Error('Destination has no route root');
  return { document, root };
}

function replaceRoute(nextRoot) {
  const currentRoot = document.querySelector('#route-root');
  currentRoot.replaceWith(document.importNode(nextRoot, true));
  return document.querySelector('#route-root');
}

function replaceMetadata(nextDocument) {
  document.title = nextDocument.title;
  for (const selector of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[type="application/ld+json"]']) {
    document.head.querySelectorAll(selector).forEach((node) => node.remove());
    nextDocument.head.querySelectorAll(selector).forEach((node) => document.head.append(document.importNode(node, true)));
  }
}
```

Mark each page's existing inline route stylesheet as `data-route-style`, then
replace it before swapping content:

```js
function replaceRouteStyle(nextDocument) {
  const nextStyle = nextDocument.head.querySelector('style[data-route-style]');
  const currentStyle = document.head.querySelector('style[data-route-style]');
  if (!nextStyle || !currentStyle) throw new Error('Route style is missing');
  currentStyle.replaceWith(document.importNode(nextStyle, true));
}
```

- [ ] **Step 3: Implement safe link interception and history behavior**

Attach one `document` click handler that uses `closest('a[href]')`, the exported
helper functions, and `navigate(url, { historyMode })`. Do not intercept
`mailto:`, Cal.com, X, hash-only, download, target blank, or modified clicks.

Use this navigation sequence:

```js
async function navigate(target, { historyMode }) {
  const currentRoot = document.querySelector('#route-root');
  currentRoot.dataset.loading = 'true';
  try {
    const response = await fetch(target.href, { headers: { 'X-Requested-With': 'persistent-navigation' } });
    if (!response.ok) throw new Error(`Route fetch failed: ${response.status}`);
    const { document: nextDocument, root: nextRoot } = parseRoute(await response.text());
    window.homeExperience?.unmount?.();
    replaceRouteStyle(nextDocument);
    const mountedRoot = replaceRoute(nextRoot);
    replaceMetadata(nextDocument);
    if (historyMode === 'push') history.pushState({}, '', target.href);
    window.homeExperience?.mount?.(mountedRoot);
    mountedRoot.removeAttribute('data-loading');
    focusAndScroll(target, mountedRoot);
  } catch (error) {
    window.location.assign(target.href);
  }
}
```

Implement `popstate` with `historyMode: 'none'`. It must use the current
location and must not add another history entry.

- [ ] **Step 4: Run the helper tests**

Run: `node --test tests/persistent-navigation.test.mjs`

Expected: all helper tests pass.

- [ ] **Step 5: Commit router and audio state**

```bash
git add assets/persistent-navigation.mjs tests/persistent-navigation.test.mjs
git commit -m "feat: preserve music across internal navigation"
```

### Task 4: Give Homepage Effects A Lifecycle

**Files:**
- Create: `assets/home-experience.mjs`
- Modify: `index.html`
- Modify: `v3-experiential.html`

- [ ] **Step 1: Move the existing homepage visual runtime behind mount/unmount hooks**

`assets/home-experience.mjs` must expose `window.homeExperience` with these
methods:

```js
window.homeExperience = {
  mount(root) {
    if (root.dataset.routeKind !== 'home') return;
    // Register event listeners with one AbortController and start the canvas/SVG loops.
  },
  unmount() {
    // Abort listeners, disconnect observers, and cancel every requestAnimationFrame id.
  },
};
```

Move the current cursor, field canvas, telemetry canvas, Wi-Fi canvas, SVG pulse,
mesh, DOOH chart, reveal observer, clock, and accent-control initializers out of
the homepage inline script. Store every animation-frame id and every observer so
`unmount()` can stop them before an article becomes active.

- [ ] **Step 2: Add a lifecycle smoke test hook**

At the end of `mount()` set `root.dataset.experienceMounted = 'true'`; at the end
of `unmount()` delete that attribute and set `window.__homeExperienceActive = false`.
Set `window.__homeExperienceActive = true` during a successful home mount. This
gives browser verification a stable assertion without changing visitor-facing UI.

- [ ] **Step 3: Run executable-script parsing**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
for (const file of ['index.html', 'v3-experiential.html', ...fs.readdirSync('notes').filter((f) => f.endsWith('.html')).map((f) => `notes/${f}`)]) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/g)) new Function(match[1]);
}
console.log('all executable inline scripts parse');
NODE
```

Expected: `all executable inline scripts parse`.

- [ ] **Step 4: Commit homepage lifecycle work**

```bash
git add assets/home-experience.mjs index.html v3-experiential.html
git commit -m "refactor: lifecycle homepage visual effects"
```

### Task 5: Verify End-To-End Behavior

**Files:**
- Test: `index.html`
- Test: `notes/*.html`
- Test: `sitemap.xml`

- [ ] **Step 1: Start the static site**

Run: `python3 -m http.server 4173`

Expected: `Serving HTTP on ... port 4173`.

- [ ] **Step 2: Run static integrity checks**

Run:

```bash
node --test tests/persistent-navigation.test.mjs
git diff --check
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const links = [...html.matchAll(/href="(notes\/[^"#?]+\.html)"/g)].map((m) => m[1]);
const missing = links.filter((link) => !fs.existsSync(link));
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const absent = fs.readdirSync('notes').filter((f) => f.endsWith('.html') && !sitemap.includes(`/notes/${f}`));
if (missing.length || absent.length) throw new Error(JSON.stringify({ missing, absent }));
console.log('article links and sitemap are complete');
NODE
```

Expected: all tests pass, no whitespace errors, and `article links and sitemap are complete`.

- [ ] **Step 3: Verify in a real browser**

1. Open `http://localhost:4173/` and press the music button.
2. Record the current track and playback time.
3. Open a Field Note, wait three seconds, and confirm the same audio element is still playing with a later time.
4. Move between two Field Notes, then use back and forward; confirm uninterrupted playback and correct URL/title/focus/scroll behavior.
5. Open Cal.com, mailto, X, and an article link with Cmd/Ctrl-click; confirm native browser behavior.
6. Enable reduced motion and repeat one homepage/article transition; confirm no fade animation.

- [ ] **Step 4: Commit verification fixes only if needed**

```bash
git add assets index.html v3-experiential.html notes tests
git commit -m "fix: harden persistent audio navigation"
```

- [ ] **Step 5: Push the completed feature**

```bash
git push origin main
```
