# Persistent Audio Navigation Design

## Goal

Keep the selected soundtrack playing without interruption while a visitor moves
between the homepage and Field Notes. The browser URL, browser history, direct
article URLs, SEO metadata, and no-JavaScript behavior must continue to work.

## Decision

Use progressive same-origin navigation rather than an iframe shell or a
best-effort resume after a full document load.

The site stays static HTML. JavaScript enhances only internal navigation once a
visitor has loaded the site. The audio element remains mounted outside the
replaceable route content, so its media stream is never destroyed during a
navigation.

## Non-Goals

- Do not move the site to React, a static-site generator, or a server runtime.
- Do not alter canonical URLs, article HTML URLs, or sitemap entries.
- Do not autoplay music for a visitor who has not explicitly pressed play.
- Do not intercept external, hash-only, download, modified-click, or new-tab
  links.

## Architecture

### Persistent Audio Host

Each document gets a shared audio host containing the existing audio element,
track control, and persistent state controller. The host is excluded from the
route swap.

The controller owns:

- Current track index
- Playback state
- Current time
- Volume
- Button label and accessible state

State is saved in session storage on track change, play/pause, time updates,
and before a fallback full-page navigation. It is restored only after a user
has started playback in the current browsing session.

### Route Root

Each page identifies one replaceable route root. The homepage route root
contains its site content; an article route root contains the article content.
The persistent audio host and global router are siblings of that root.

Route-specific styles are marked and replaced with the destination document's
marked route styles. Shared base styling and the audio controller styles remain
mounted.

### Navigation Lifecycle

1. A same-origin, ordinary left-click on a document link is intercepted.
2. The router fetches the destination HTML and parses it with `DOMParser`.
3. It validates that the destination has a route root. If not, the browser uses
   ordinary navigation.
4. It fades the current route root out, swaps route content and route-specific
   styles, updates the document title, then fades the new route in.
5. It calls `history.pushState()` and restores scroll to the top, or the hash
   target when present.
6. Back and forward repeat the same lifecycle through `popstate` without
   adding another history entry.

The persistent audio element is never removed, recreated, or reassigned while
this happens. Playback continues at its existing time and volume.

### Fallback Behavior

- JavaScript disabled: every link remains an ordinary static HTML link.
- Fetch failure, parse failure, or an unmarked destination: browser performs a
  normal navigation.
- External and intentionally new-tab links: browser behavior is untouched.
- A visitor landing directly on an article can start music there; subsequent
  internal navigation remains uninterrupted.

## Accessibility And UX

- The audio toggle remains a native button with an accurate accessible label.
- The route root gets a short `aria-busy` state during swaps.
- Focus moves to the destination page's primary heading after navigation.
- Reduced-motion users receive no fade animation.
- A brief visual route transition should not pause, restart, or change the
  volume of active music.

## Files Expected To Change

- `index.html`
- `v3-experiential.html` while it remains a maintained duplicate
- All nine `notes/*.html` Field Notes
- A shared, static JavaScript file for the audio controller/router
- A shared, static stylesheet for the persistent player and route transition

## Verification

1. Start a track on the homepage, open each Field Note, and return home: audio
   stays audible, on the same track, with continuously increasing time.
2. Repeat between two articles and with browser back/forward.
3. Confirm direct article loads still render with their original title,
   canonical URL, JSON-LD, and article markup.
4. Confirm external, mailto, Cal.com, hash, and modified-click links retain
   native browser behavior.
5. Confirm navigation works with JavaScript disabled.
6. Test desktop and mobile layouts, keyboard navigation, and reduced-motion.
7. Run script parsing and link/sitemap integrity checks.

## Risks

The pages currently have individually embedded styles and scripts. The router
must separate route-specific assets from persistent ones deliberately; blindly
replacing the full document would destroy the audio node and defeat the goal.
The first implementation should favor reliable behavior over aggressively
intercepting every possible link.
