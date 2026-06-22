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
