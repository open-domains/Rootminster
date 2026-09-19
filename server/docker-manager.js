import { authenticateRequest } from './auth.js';
import { getModuleConfig } from './module-settings.js';
import { store } from './store.js';

const HOSTINGER_ORIGIN = 'https://developers.hostinger.com';
const ACTIONS = new Set(['start', 'stop', 'restart', 'update']);
const PLATFORM_MARKERS = ['opendomains', 'rootminster'];

export function canonicalProjectName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function additionalProtectedProjects(settings) {
  return String(settings.protected_projects || '')
    .split(/[\n,]/)
    .map(canonicalProjectName)
    .filter(Boolean);
}

export function isProtectedDockerProject(project, settings = {}) {
  const candidates = [
    project?.name,
    project?.path,
    ...(Array.isArray(project?.containers)
      ? project.containers.flatMap((container) => [container?.name, container?.image])
      : []),
  ].map(canonicalProjectName).filter(Boolean);
  if (candidates.some((candidate) => PLATFORM_MARKERS.some((marker) => candidate.includes(marker)))) return true;
  const configured = additionalProtectedProjects(settings);
  return configured.some((protectedName) => candidates.some((candidate) => candidate === protectedName));
}

function safeProjectName(value) {
  const name = String(value || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw Object.assign(new Error('Invalid Docker project name'), { status: 400 });
  }
  return name;
}

async function requireDockerAdmin(request, reply) {
  const actor = await authenticateRequest(request);
  if (!actor || actor.role !== 'admin') {
    reply.code(actor ? 403 : 401).send({ error: actor ? 'Forbidden' : 'Unauthorized' });
    return null;
  }
  const settings = await getModuleConfig('docker_engine');
  if (!settings.enabled) {
    reply.code(503).send({ error: 'Docker Engine module is disabled' });
    return null;
  }
  return { actor, settings };
}

async function hostingerRequest(settings, path, { method = 'GET' } = {}) {
  const virtualMachineId = String(settings.virtual_machine_id || '');
  if (!/^\d+$/.test(virtualMachineId)) throw Object.assign(new Error('Hostinger virtual machine ID is invalid'), { status: 503 });
  if (!settings.api_token) throw Object.assign(new Error('Hostinger API token is not configured'), { status: 503 });
  let response;
  try {
    response = await fetch(`${HOSTINGER_ORIGIN}/api/vps/v1/virtual-machines/${virtualMachineId}/docker${path}`, {
      method,
      headers: { Authorization: `Bearer ${settings.api_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw Object.assign(new Error(error?.name === 'TimeoutError' ? 'Hostinger API request timed out' : 'Hostinger API is unavailable'), { status: 502 });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
    const error = new Error(providerMessage ? `Hostinger API: ${providerMessage}` : `Hostinger API request failed (${response.status})`);
    error.status = response.status === 429 ? 503 : 502;
    throw error;
  }
  return body;
}

async function visibleProjects(settings) {
  const projects = await hostingerRequest(settings, '');
  if (!Array.isArray(projects)) throw Object.assign(new Error('Hostinger returned an invalid project list'), { status: 502 });
  return {
    projects: projects.filter((project) => !isProtectedDockerProject(project, settings)),
    protectedCount: projects.filter((project) => isProtectedDockerProject(project, settings)).length,
  };
}

async function requireVisibleProject(settings, rawName) {
  const name = safeProjectName(rawName);
  const projects = await hostingerRequest(settings, '');
  if (!Array.isArray(projects)) throw Object.assign(new Error('Hostinger returned an invalid project list'), { status: 502 });
  const project = projects.find((item) => item?.name === name);
  if (!project) throw Object.assign(new Error('Docker project not found'), { status: 404 });
  if (isProtectedDockerProject(project, settings)) {
    throw Object.assign(new Error('This platform project is protected and cannot be controlled'), { status: 403 });
  }
  return project;
}

function sendRouteError(reply, error) {
  return reply.code(error.status || 500).send({ error: error.message || 'Docker operation failed' });
}

export async function registerDockerManagerRoutes(app) {
  app.get('/api/admin/docker/projects', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const context = await requireDockerAdmin(request, reply);
      if (!context) return;
      const result = await visibleProjects(context.settings);
      return { projects: result.projects, protected_count: result.protectedCount };
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.get('/api/admin/docker/projects/:projectName/containers', async (request, reply) => {
    try {
      const context = await requireDockerAdmin(request, reply);
      if (!context) return;
      const project = await requireVisibleProject(context.settings, request.params.projectName);
      const containers = await hostingerRequest(context.settings, `/${encodeURIComponent(project.name)}/containers`);
      return { containers: Array.isArray(containers) ? containers : [] };
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.get('/api/admin/docker/projects/:projectName/logs', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const context = await requireDockerAdmin(request, reply);
      if (!context) return;
      const project = await requireVisibleProject(context.settings, request.params.projectName);
      const logs = await hostingerRequest(context.settings, `/${encodeURIComponent(project.name)}/logs`);
      return { logs: Array.isArray(logs) ? logs : [] };
    } catch (error) { return sendRouteError(reply, error); }
  });

  app.post('/api/admin/docker/projects/:projectName/:action', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const context = await requireDockerAdmin(request, reply);
      if (!context) return;
      const action = String(request.params.action || '');
      if (!ACTIONS.has(action)) return reply.code(400).send({ error: 'Unsupported Docker action' });
      const project = await requireVisibleProject(context.settings, request.params.projectName);
      const result = await hostingerRequest(context.settings, `/${encodeURIComponent(project.name)}/${action}`, { method: 'POST' });
      await store.create('AuditLog', {
        actor_email: context.actor.email,
        actor_role: context.actor.role,
        action: `docker_project_${action}`,
        entity_type: 'DockerProject',
        entity_id: project.name,
        description: `${context.actor.email} requested Docker ${action} for ${project.name} through Hostinger`,
      }, context.actor);
      return { action: result };
    } catch (error) { return sendRouteError(reply, error); }
  });
}
