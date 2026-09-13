import test from 'node:test';
import assert from 'node:assert/strict';
import { readAppearance, applyAppearance } from '../src/lib/theme.js';

test('migrates existing color preference without changing the classic style', () => {
  assert.deepEqual(readAppearance({ getItem: key => key === 'od_theme' ? 'dark' : null }), { style: 'classic', mode: 'dark' });
});
test('invalid or unavailable storage falls back safely', () => {
  for (const storage of [null, { getItem() { throw new Error('blocked'); } }, { getItem: () => 'invalid' }]) {
    assert.deepEqual(readAppearance(storage), { style: 'classic', mode: 'system' });
  }
});
test('every style works independently of light, dark, and system mode', () => {
  for (const style of ['classic', 'fieldwork']) {
    for (const mode of ['light', 'dark', 'system']) {
      for (const prefersDark of [true, false]) {
        let dark;
        const root = { dataset: {}, style: {}, classList: { toggle: (name, enabled) => { assert.equal(name, 'dark'); dark = enabled; } } };
        const expected = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
        assert.equal(applyAppearance({ style, mode }, prefersDark, root), expected);
        assert.equal(root.dataset.theme, style);
        assert.equal(root.style.colorScheme, expected);
        assert.equal(dark, expected === 'dark');
      }
    }
  }
});
