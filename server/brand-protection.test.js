import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { matchProtectedBrand, normaliseBrandList, parseBrandList, protectedBrandMessage } from '../shared/brand-protection.js';
import { protectedBrandRefusal } from './lib/brand-protection.js';
import { assessDeterministic } from './lib/safety-screening.js';
import { invokeInternal } from './function-runner.js';

const LIST = 'minecraft\npaypal\napple\n!pineapple';

test('names that imitate a protected brand are matched', () => {
  for (const name of [
    'minecraft', 'Minecraft', 'mine-craft', 'm1necraft', 'minecr4ft', 'minecraftserver', 'myminecraft',
    'play.minecraft', 'get-minecraft-free', 'paypa1', 'paypal-login', 'snapple',
  ]) {
    assert.ok(matchProtectedBrand(name, LIST), `${name} should be blocked`);
  }
  assert.equal(matchProtectedBrand('minecraft', LIST), 'minecraft');
  assert.equal(matchProtectedBrand('paypa1', LIST), 'paypal');
});

test('unrelated names and explicitly allowed names are not matched', () => {
  for (const name of ['pineapple', 'creative', 'craftmine', 'mine', 'my-site', 'pay', '']) {
    assert.equal(matchProtectedBrand(name, LIST), null, `${name} should be allowed`);
  }
  assert.equal(matchProtectedBrand('anything', ''), null);
});

test('brand lists are parsed and normalised for storage', () => {
  assert.deepEqual(parseBrandList(' Minecraft \n\nnot valid!\n!PineApple,paypal\nminecraft'), {
    brands: ['minecraft', 'paypal'], allowed: ['pineapple'],
  });
  assert.equal(normaliseBrandList('paypal\n!pineapple\nminecraft\npaypal'), 'minecraft\npaypal\n!pineapple');
  assert.match(protectedBrandMessage('minecraft', 'minecraft'), /protected brand "minecraft"/);
});

const entitiesWith = value => ({ PlatformSettings: { filter: async () => (value === null ? [] : [{ value }]) } });

test('users are refused protected names while staff and admins are not', async () => {
  const entities = entitiesWith(LIST);
  assert.match(await protectedBrandRefusal(entities, 'minecraft', { role: 'user' }), /protected brand "minecraft"/);
  assert.match(await protectedBrandRefusal(entities, 'minecraft', null), /protected brand/);
  assert.equal(await protectedBrandRefusal(entities, 'minecraft', { role: 'staff' }), null);
  assert.equal(await protectedBrandRefusal(entities, 'minecraft', { role: 'admin' }), null);
  assert.equal(await protectedBrandRefusal(entities, 'my-blog', { role: 'user' }), null);
  assert.equal(await protectedBrandRefusal(entitiesWith(null), 'minecraft', { role: 'user' }), null);
});

test('risk rules use the same matcher for the protected brand signal', () => {
  const signals = assessDeterministic({ subdomain: 'm1necraft-server', preview_link: 'https://example.org' }, { protectedBrands: LIST }).signals;
  assert.ok(signals.some(item => item.code === 'protected_brand' && item.evidence === 'minecraft'));
});

test('every place a name is requested or checked refuses protected brands', async () => {
  for (const file of ['submitRequest.js', 'checkAvailability.js', 'publicApi.js']) {
    const source = await readFile(new URL(`./functions/${file}`, import.meta.url), 'utf8');
    assert.match(source, /protectedBrandRefusal\(/, `${file} must check protected brands`);
  }
});

test('only staff and admins can view or change the protected brand list', async () => {
  for (const role of ['user', 'domain_provider']) {
    await assert.rejects(
      invokeInternal('manageProtectedBrands', { action: 'get' }, { id: 'u1', email: 'u@example.test', role }),
      error => error.status === 403,
    );
  }
});
