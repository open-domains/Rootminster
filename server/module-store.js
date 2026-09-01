import { createHash } from 'node:crypto';
import { authenticateRequest } from './auth.js';
import { getModuleConfig, MODULE_DEFINITIONS, saveModule } from './module-settings.js';
import { store } from './store.js';

const MAX_DOCUMENT_BYTES = 512 * 1024;
const ALLOWED_PERMISSIONS = new Set([
  'dns.read', 'dns.write', 'zones.read', 'requests.read', 'requests.manage',
  'notifications.send', 'safety.assess', 'http.fetch', 'settings.read', 'audit.write',
]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const REGISTRY_URL_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/open-domains\/Rootminster-modules\/(?:main|[a-f0-9]{40})\/registry\.json$/i;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest(`${label} must be an object`);
}

function safeText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw badRequest(`Invalid ${label}`);
  return value.trim();
}

export function validateModuleManifest(value, catalogItem) {
  assertPlainObject(value, 'Module manifest');
  const allowedKeys = new Set(['schemaVersion', 'id', 'name', 'version', 'publisher', 'description', 'runtime', 'target', 'permissions', 'minimumCoreVersion', 'homepage']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw badRequest('Module manifest contains unsupported fields');
  if (value.schemaVersion !== 1 || value.publisher !== 'open-domains' || value.runtime !== 'declarative-v1') throw badRequest('Unsupported module publisher or runtime');
  if (!ID_PATTERN.test(value.id) || !VERSION_PATTERN.test(value.version) || !VERSION_PATTERN.test(value.minimumCoreVersion)) throw badRequest('Invalid module identity or version');
  safeText(value.name, 80, 'module name');
  safeText(value.description, 500, 'module description');
  if (!MODULE_DEFINITIONS[value.target] || value.target === 'module_store') throw badRequest('Module targets an unreviewed adapter');
  if (!Array.isArray(value.permissions) || value.permissions.length > 20 || new Set(value.permissions).size !== value.permissions.length || value.permissions.some((permission) => !ALLOWED_PERMISSIONS.has(permission))) throw badRequest('Module requests unsupported permissions');
  if (catalogItem && (value.id !== catalogItem.id || value.name !== catalogItem.name || value.version !== catalogItem.version)) throw badRequest('Registry and manifest identities do not match');
  return Object.freeze({ ...value, permissions: Object.freeze([...value.permissions]) });
}

export function validateRegistry(value) {
  assertPlainObject(value, 'Registry');
  if (value.schemaVersion !== 1 || value.publisher !== 'open-domains' || !Array.isArray(value.modules) || value.modules.length > 200) throw badRequest('Unsupported registry');
  const seen = new Set();
  const modules = value.modules.map((item) => {
    assertPlainObject(item, 'Registry module');
    const allowedKeys = new Set(['id', 'name', 'version', 'description', 'manifestUrl', 'manifestSha256']);
    if (Object.keys(item).some((key) => !allowedKeys.has(key))) throw badRequest('Registry module contains unsupported fields');
    if (!ID_PATTERN.test(item.id) || seen.has(item.id)) throw badRequest('Invalid or duplicate registry module ID');
    seen.add(item.id);
    if (!VERSION_PATTERN.test(item.version) || !DIGEST_PATTERN.test(item.manifestSha256)) throw badRequest(`Invalid metadata for ${item.id}`);
    safeText(item.name, 80, 'module name');
    safeText(item.description, 500, 'module description');
    const expectedSuffix = `/modules/${item.id}/module.json`;
    const expectedPrefix = 'https://raw.githubusercontent.com/open-domains/Rootminster-modules/';
    if (typeof item.manifestUrl !== 'string' || !item.manifestUrl.startsWith(expectedPrefix) || !item.manifestUrl.endsWith(expectedSuffix) || item.manifestUrl.includes('?') || item.manifestUrl.includes('#')) throw badRequest(`Untrusted manifest URL for ${item.id}`);
    return { ...item };
  });
  return { schemaVersion: 1, name: safeText(value.name, 120, 'registry name'), publisher: 'open-domains', modules };
}

async function downloadJson(url, urlPattern) {
  if (!urlPattern.test(url)) throw badRequest('Registry URL is not trusted');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { accept: 'application/json', 'user-agent': 'Rootminster-Module-Store/1' } });
    if (!response.ok) throw Object.assign(new Error(`Module registry returned ${response.status}`), { status: 502 });
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_DOCUMENT_BYTES) throw badRequest('Module document is too large');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_DOCUMENT_BYTES) throw badRequest('Module document is too large');
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch { throw badRequest('Module document is not valid JSON'); }
    return { data, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  } finally {
    clearTimeout(timeout);
  }
}

async function registrySnapshot() {
  const config = await getModuleConfig('module_store');
  if (!config.enabled) throw Object.assign(new Error('Module Store is disabled'), { status: 503 });
  const downloaded = await downloadJson(config.registry_url, REGISTRY_URL_PATTERN);
  return { ...downloaded, registry: validateRegistry(downloaded.data), registryUrl: config.registry_url };
}

function manifestPattern(item) {
  const escapedId = item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https:\\/\\/raw\\.githubusercontent\\.com\\/open-domains\\/Rootminster-modules\\/(?:main|[a-f0-9]{40})\\/modules\\/${escapedId}\\/module\\.json$`, 'i');
}

async function verifiedManifest(item) {
  const downloaded = await downloadJson(item.manifestUrl, manifestPattern(item));
  if (downloaded.sha256 !== item.manifestSha256) throw badRequest(`Integrity verification failed for ${item.id}`);
  return { manifest: validateModuleManifest(downloaded.data, item), sha256: downloaded.sha256 };
}

async function installedByModuleId(id) {
  return (await store.filter('InstalledModule', { module_id: id }, '-created_date', 1))[0] || null;
}

function clientInstalled(record) {
  if (!record) return null;
  return {
    id: record.id,
    module_id: record.module_id,
    version: record.version,
    enabled: Boolean(record.enabled),
    quarantined: Boolean(record.quarantined),
    installed_at: record.installed_at,
    updated_date: record.updated_date,
    manifest_sha256: record.manifest_sha256,
    rollback_available: Boolean(record.history?.length),
  };
}

async function audit(actor, action, description, moduleId) {
  await store.create('AuditLog', {
    actor_email: actor.email, actor_role: actor.role, action,
    entity_type: 'InstalledModule', entity_id: moduleId, description,
  }, actor);
}

async function requireAdmin(request, reply) {
  const actor = await authenticateRequest(request);
  if (!actor || actor.role !== 'admin') {
    reply.code(403).send({ error: 'Forbidden' });
    return null;
  }
  return actor;
}

export async function registerModuleStoreRoutes(app) {
  app.get('/api/admin/module-store', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    try {
      const snapshot = await registrySnapshot();
      const installed = await store.list('InstalledModule', '-created_date', 500);
      const byId = new Map(installed.map((item) => [item.module_id, item]));
      return {
        registry: { name: snapshot.registry.name, url: snapshot.registryUrl, sha256: snapshot.sha256 },
        modules: snapshot.registry.modules.map((item) => ({
          ...item,
          installed: clientInstalled(byId.get(item.id)),
          update_available: Boolean(byId.get(item.id) && byId.get(item.id).version !== item.version),
        })),
      };
    } catch (error) {
      return reply.code(error.status || 502).send({ error: error.message });
    }
  });

  app.get('/api/admin/module-store/:id/manifest', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    try {
      const snapshot = await registrySnapshot();
      const item = snapshot.registry.modules.find((entry) => entry.id === request.params.id);
      if (!item) return reply.code(404).send({ error: 'Module not found in trusted registry' });
      const verified = await verifiedManifest(item);
      return { manifest: verified.manifest, manifest_sha256: verified.sha256 };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/admin/module-store/:id/install', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    try {
      const snapshot = await registrySnapshot();
      const item = snapshot.registry.modules.find((entry) => entry.id === request.params.id);
      if (!item) return reply.code(404).send({ error: 'Module not found in trusted registry' });
      if (request.body?.manifest_sha256 && request.body.manifest_sha256 !== item.manifestSha256) throw Object.assign(new Error('Registry changed; review the module again before installing'), { status: 409 });
      const { manifest, sha256 } = await verifiedManifest(item);
      const existing = await installedByModuleId(item.id);
      const now = new Date().toISOString();
      const history = existing ? [{ version: existing.version, manifest: existing.manifest, manifest_sha256: existing.manifest_sha256, saved_at: now }, ...(existing.history || [])].slice(0, 5) : [];
      const data = { module_id: item.id, version: item.version, manifest, manifest_sha256: sha256, registry_sha256: snapshot.sha256, enabled: existing?.enabled || false, quarantined: false, installed_at: existing?.installed_at || now, history };
      const saved = existing ? await store.update('InstalledModule', existing.id, data) : await store.create('InstalledModule', data, actor);
      await audit(actor, existing ? 'module_updated' : 'module_installed', `${item.name} ${item.version} integrity-verified and ${existing ? 'updated' : 'installed'}; permissions=${manifest.permissions.join(',') || 'none'}`, item.id);
      return { module: clientInstalled(saved), manifest };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/admin/module-store/:id/state', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const existing = await installedByModuleId(request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Module is not installed' });
    const enabled = request.body?.enabled === true;
    if (enabled && existing.quarantined) return reply.code(409).send({ error: 'Quarantined modules cannot be enabled' });
    try {
      await saveModule(existing.manifest.target, { enabled, settings: {} }, actor);
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
    const saved = await store.update('InstalledModule', existing.id, { enabled });
    await audit(actor, enabled ? 'module_enabled' : 'module_disabled', `${existing.module_id} ${enabled ? 'enabled' : 'disabled'}`, existing.module_id);
    return { module: clientInstalled(saved) };
  });

  app.post('/api/admin/module-store/:id/quarantine', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const existing = await installedByModuleId(request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Module is not installed' });
    const quarantined = request.body?.quarantined !== false;
    if (quarantined) await saveModule(existing.manifest.target, { enabled: false, settings: {} }, actor);
    const saved = await store.update('InstalledModule', existing.id, { quarantined, enabled: quarantined ? false : existing.enabled });
    await audit(actor, quarantined ? 'module_quarantined' : 'module_quarantine_cleared', `${existing.module_id} quarantine ${quarantined ? 'applied' : 'cleared'}`, existing.module_id);
    return { module: clientInstalled(saved) };
  });

  app.post('/api/admin/module-store/:id/rollback', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const existing = await installedByModuleId(request.params.id);
    const previous = existing?.history?.[0];
    if (!existing || !previous) return reply.code(409).send({ error: 'No rollback version is available' });
    const now = new Date().toISOString();
    const history = [{ version: existing.version, manifest: existing.manifest, manifest_sha256: existing.manifest_sha256, saved_at: now }, ...existing.history.slice(1)].slice(0, 5);
    await saveModule(existing.manifest.target, { enabled: false, settings: {} }, actor);
    const saved = await store.update('InstalledModule', existing.id, { version: previous.version, manifest: previous.manifest, manifest_sha256: previous.manifest_sha256, history, enabled: false });
    await audit(actor, 'module_rolled_back', `${existing.module_id} rolled back from ${existing.version} to ${previous.version} and disabled pending review`, existing.module_id);
    return { module: clientInstalled(saved) };
  });

  app.delete('/api/admin/module-store/:id', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const existing = await installedByModuleId(request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Module is not installed' });
    await saveModule(existing.manifest.target, { enabled: false, settings: {} }, actor);
    await store.delete('InstalledModule', existing.id);
    await audit(actor, 'module_removed', `${existing.module_id} ${existing.version} removed`, existing.module_id);
    return { success: true };
  });
}
