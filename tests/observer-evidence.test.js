import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeEntities, readableEvidence } from '../src/lib/observer-evidence.js';

// Evidence stored before Observer decoded entities, copied from a real finding.
const LEGACY = 'Matched multiple rules (6.4 Commercial Use, 5.5 Gambling). 6.4 Commercial Use: ; &mdash; &nbsp;1-6 PICK NOTHING EQUIPPED&nbsp; &mdash; &nbsp;BUY EMOTES IN THE SHOP GENERATING ISLAND&hellip; WEBGL UNAVAILABLE ISLE ROYALE This game needs WebGL 2; 5.5 Gambling: V Aim down sights (V rebindable, toggle optional) R Reload 1 &hellip; 5 Weapon slots (wheel cycles) G Throw frag grenade ITEMS &amp; INTERFACE E / F Open a chest, o';

test('legacy mixed evidence is decoded and split one rule per line', () => {
  const lines = readableEvidence(LEGACY).split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'Matched multiple rules (6.4 Commercial Use, 5.5 Gambling).');
  assert.match(lines[1], /^• 6\.4 Commercial Use: ; — 1-6 PICK NOTHING EQUIPPED — BUY EMOTES IN THE SHOP GENERATING ISLAND… WEBGL/);
  assert.match(lines[2], /^• 5\.5 Gambling: V Aim down sights .* ITEMS & INTERFACE E \/ F Open a chest, o$/);
  assert.doesNotMatch(readableEvidence(LEGACY), /&[a-z]+;/);
});

test('new Observer evidence passes through with its line breaks', () => {
  const text = 'Matched 2 rules (6.4 Commercial Use, 5.5 Gambling).\n• 6.4 Commercial Use: Matched "shop": "…THE SHOP…"\n• 5.5 Gambling: Matched "slots": "…Weapon slots…"';
  assert.equal(readableEvidence(text), text);
});

test('entity decoding is single-pass and leaves unknown entities alone', () => {
  assert.equal(decodeEntities('&amp;lt;b&amp;gt;'), '&lt;b&gt;');
  assert.equal(decodeEntities('&#8212; &#x2026; &unknown; &#0;'), '— … &unknown; &#0;');
  assert.equal(decodeEntities(null), '');
});
