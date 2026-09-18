import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

test('CREATE TABLE definitions have valid column separators', () => {
  const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/g)];
  assert.ok(tables.length > 0, 'expected CREATE TABLE definitions');

  for (const [, name, body] of tables) {
    const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
    lines.forEach((line, index) => {
      const isLast = index === lines.length - 1;
      if (isLast) assert.ok(!line.endsWith(','), `${name}: trailing comma before closing parenthesis`);
      else assert.ok(line.endsWith(',') || line.endsWith('('), `${name}: missing comma after "${line}"`);
    });
  }
});
