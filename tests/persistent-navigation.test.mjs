import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRoutableLocation,
  shouldInterceptLink,
  targetScrollId,
} from '../assets/persistent-navigation.mjs';

test('routes only same-origin portfolio documents', () => {
  const current = new URL('https://site.test/');

  assert.equal(isRoutableLocation(new URL('https://site.test/notes/test.html'), current), true);
  assert.equal(isRoutableLocation(new URL('https://site.test/'), current), true);
  assert.equal(isRoutableLocation(new URL('https://cal.com/example'), current), false);
  assert.equal(isRoutableLocation(new URL('mailto:hello@example.com'), current), false);
});

test('preserves native behavior for modified, download, and new-tab links', () => {
  const ordinaryClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  const link = (target = '', download = false) => ({ target, hasAttribute: (name) => name === 'download' && download });

  assert.equal(shouldInterceptLink(ordinaryClick, link('', true)), false);
  assert.equal(shouldInterceptLink({ ...ordinaryClick, metaKey: true }, link()), false);
  assert.equal(shouldInterceptLink(ordinaryClick, link('_blank')), false);
  assert.equal(shouldInterceptLink(ordinaryClick, link()), true);
});

test('extracts a hash target without the leading hash', () => {
  assert.equal(targetScrollId(new URL('https://site.test/index.html#notes')), 'notes');
  assert.equal(targetScrollId(new URL('https://site.test/notes/test.html')), '');
});
