export function isRoutableLocation(target, current) {
  return target.origin === current.origin && /^(?:\/|\/index\.html|\/notes\/[^/]+\.html)$/.test(target.pathname);
}

export function shouldInterceptLink(event, link) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    link.target !== '_blank' && !link.hasAttribute('download');
}

export function targetScrollId(url) {
  return url.hash.slice(1);
}

const TRACKS = [
  { src: '/audio/shadows-of-the-samurai.mp3', label: 'SHADOWS OF THE SAMURAI' },
  { src: '/audio/clean-windows.mp3', label: 'CLEAN WINDOWS' },
];
const AUDIO_STATE_KEY = 'persistent-audio-state';

function getStoredAudioState() {
  try {
    return JSON.parse(sessionStorage.getItem(AUDIO_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function persistAudioState(audio, trackIndex) {
  try {
    sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify({
      trackIndex,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      volume: audio.volume,
      wasPlaying: !audio.paused,
    }));
  } catch {}
}

function ensureRouteRoot(sourceDocument = document) {
  const existing = sourceDocument.querySelector('#route-root');
  if (existing) return existing;

  const root = sourceDocument.createElement('div');
  root.id = 'route-root';
  root.dataset.routeKind = sourceDocument.querySelector('article') ? 'article' : 'home';
  [...sourceDocument.body.childNodes].forEach((node) => root.append(node));
  sourceDocument.body.append(root);
  return root;
}

function markRouteStyle(sourceDocument = document) {
  const existing = sourceDocument.head.querySelector('style[data-route-style]');
  if (existing) return existing;

  const style = sourceDocument.head.querySelector('style');
  if (style) style.dataset.routeStyle = '';
  return style;
}

function createPersistentAudioHost() {
  const oldButton = document.getElementById('audio-btn');
  if (oldButton) oldButton.remove();

  let host = document.getElementById('persistent-audio-host');
  if (host) return host;

  host = document.createElement('div');
  host.id = 'persistent-audio-host';
  host.setAttribute('aria-live', 'polite');
  host.innerHTML = `
    <button class="persistent-audio__button" id="persistent-audio-button" type="button" aria-label="Play music" data-playing="false">
      <span aria-hidden="true">♪</span><span class="persistent-audio__track" id="persistent-audio-track">MUSIC</span>
    </button>
  `;

  const audio = document.getElementById('audio-el') || document.createElement('audio');
  audio.id = 'persistent-audio-element';
  audio.preload = 'metadata';
  host.append(audio);
  document.body.append(host);
  return host;
}

function mountAudioController() {
  const host = createPersistentAudioHost();
  const button = host.querySelector('#persistent-audio-button');
  const trackLabel = host.querySelector('#persistent-audio-track');
  const audio = host.querySelector('audio');
  const state = getStoredAudioState();
  let trackIndex = Number.isInteger(state.trackIndex) ? state.trackIndex % TRACKS.length : 0;

  function updateButton() {
    const playing = !audio.paused;
    button.dataset.playing = String(playing);
    button.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    trackLabel.textContent = TRACKS[trackIndex].label;
  }

  function loadTrack(index, time = 0) {
    trackIndex = (index + TRACKS.length) % TRACKS.length;
    if (!audio.src.endsWith(TRACKS[trackIndex].src)) audio.src = TRACKS[trackIndex].src;
    audio.currentTime = time;
    updateButton();
  }

  loadTrack(trackIndex, Number.isFinite(state.currentTime) ? state.currentTime : 0);
  if (Number.isFinite(state.volume)) audio.volume = state.volume;

  audio.addEventListener('play', updateButton);
  audio.addEventListener('pause', updateButton);
  audio.addEventListener('timeupdate', () => persistAudioState(audio, trackIndex));
  audio.addEventListener('volumechange', () => persistAudioState(audio, trackIndex));
  audio.addEventListener('ended', () => {
    loadTrack(trackIndex + 1);
    audio.play().catch(updateButton);
  });
  button.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(updateButton);
    else audio.pause();
  });
  addEventListener('pagehide', () => persistAudioState(audio, trackIndex));

  if (state.wasPlaying) audio.play().catch(updateButton);
  updateButton();
}

function parseRoute(html) {
  const nextDocument = new DOMParser().parseFromString(html, 'text/html');
  const root = ensureRouteRoot(nextDocument);
  markRouteStyle(nextDocument);
  return { document: nextDocument, root };
}

function replaceMetadata(nextDocument) {
  document.title = nextDocument.title;
  const selectors = [
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property^="og:"]',
    'meta[name^="twitter:"]',
    'script[type="application/ld+json"]',
  ];

  selectors.forEach((selector) => {
    document.head.querySelectorAll(selector).forEach((node) => node.remove());
    nextDocument.head.querySelectorAll(selector).forEach((node) => {
      document.head.append(document.importNode(node, true));
    });
  });
}

function replaceRouteStyle(nextDocument) {
  const currentStyle = markRouteStyle();
  const nextStyle = markRouteStyle(nextDocument);
  if (!currentStyle || !nextStyle) return;
  currentStyle.replaceWith(document.importNode(nextStyle, true));
}

function focusAndScroll(target, root) {
  const targetId = targetScrollId(target);
  const scrollTarget = targetId ? document.getElementById(targetId) : null;
  window.scrollTo({ top: scrollTarget ? scrollTarget.getBoundingClientRect().top + window.scrollY : 0, behavior: 'auto' });
  const heading = root.querySelector('h1, h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function replayRouteScripts(nextDocument) {
  nextDocument.body.querySelectorAll('script:not([type]), script[type="text/javascript"]').forEach((script) => {
    const replay = document.createElement('script');
    replay.textContent = script.textContent;
    document.body.append(replay);
    replay.remove();
  });
}

function startRouter() {
  let cachedHome = null;

  async function navigate(target, historyMode) {
    const currentRoot = ensureRouteRoot();
    currentRoot.dataset.loading = 'true';

    try {
      const response = await fetch(target.href, { headers: { 'X-Requested-With': 'persistent-navigation' } });
      if (!response.ok) throw new Error(`Route fetch failed: ${response.status}`);
      const { document: nextDocument, root: nextRoot } = parseRoute(await response.text());
      const wantsHome = nextRoot.dataset.routeKind === 'home';

      if (currentRoot.dataset.routeKind === 'home') {
        cachedHome = { root: currentRoot, style: markRouteStyle() };
      }

      let mountedRoot;
      if (wantsHome && cachedHome) {
        markRouteStyle().replaceWith(cachedHome.style);
        currentRoot.replaceWith(cachedHome.root);
        mountedRoot = cachedHome.root;
      } else {
        replaceRouteStyle(nextDocument);
        const importedRoot = document.importNode(nextRoot, true);
        importedRoot.querySelectorAll('script').forEach((script) => script.remove());
        currentRoot.replaceWith(importedRoot);
        mountedRoot = importedRoot;
        if (wantsHome) replayRouteScripts(nextDocument);
      }

      replaceMetadata(nextDocument);
      if (historyMode === 'push') history.pushState({}, '', target.href);
      mountedRoot.removeAttribute('data-loading');
      focusAndScroll(target, mountedRoot);
    } catch (error) {
      window.location.assign(target.href);
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !shouldInterceptLink(event, link)) return;
    const target = new URL(link.href, window.location.href);
    if (!isRoutableLocation(target, window.location)) return;
    if (target.pathname === window.location.pathname && target.hash) return;
    event.preventDefault();
    navigate(target, 'push');
  });

  addEventListener('popstate', () => navigate(new URL(window.location.href), 'none'));
}

if (typeof document !== 'undefined') {
  ensureRouteRoot();
  markRouteStyle();
  mountAudioController();
  startRouter();
}
