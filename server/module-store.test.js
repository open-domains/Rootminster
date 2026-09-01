import assert from 'node:assert/strict';
import test from 'node:test';
import { validateModuleManifest, validateRegistry } from './module-store.js';

const catalog = {
  id: 'cloudflare-dns', name: 'Cloudflare DNS', version: '1.0.0',
  description: 'Reviewed DNS adapter',
  manifestUrl: 'https://raw.githubusercontent.com/open-domains/Rootminster-modules/main/modules/cloudflare-dns/module.json',
  manifestSha256: 'a'.repeat(64),
};

test('validates a curated declarative registry and manifest', () => {
  const registry = validateRegistry({ schemaVersion: 1, name: 'Official', publisher: 'open-domains', modules: [catalog] });
  assert.equal(registry.modules[0].id, 'cloudflare-dns');
  const manifest = validateModuleManifest({
    schemaVersion: 1, id: 'cloudflare-dns', name: 'Cloudflare DNS', version: '1.0.0',
    publisher: 'open-domains', description: 'Reviewed DNS adapter', runtime: 'declarative-v1',
    target: 'cloudflare', permissions: ['dns.read', 'dns.write'], minimumCoreVersion: '0.0.0',
  }, catalog);
  assert.deepEqual(manifest.permissions, ['dns.read', 'dns.write']);
});

test('rejects executable and unreviewed module manifests', () => {
  assert.throws(() => validateModuleManifest({
    schemaVersion: 1, id: 'cloudflare-dns', name: 'Cloudflare DNS', version: '1.0.0',
    publisher: 'open-domains', description: 'Unsafe', runtime: 'node', target: 'cloudflare',
    permissions: ['dns.read'], minimumCoreVersion: '0.0.0', entrypoint: 'index.js',
  }, catalog), /unsupported fields|publisher or runtime/i);
  assert.throws(() => validateModuleManifest({
    schemaVersion: 1, id: 'cloudflare-dns', name: 'Cloudflare DNS', version: '1.0.0',
    publisher: 'open-domains', description: 'Unsafe', runtime: 'declarative-v1', target: 'cloudflare',
    permissions: ['process.exec'], minimumCoreVersion: '0.0.0',
  }, catalog), /unsupported permissions/i);
});

test('rejects registry URLs outside the official repository', () => {
  assert.throws(() => validateRegistry({
    schemaVersion: 1, name: 'Official', publisher: 'open-domains',
    modules: [{ ...catalog, manifestUrl: 'https://evil.example/module.json' }],
  }), /untrusted manifest URL/i);
});
