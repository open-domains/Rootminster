import { authenticateRequest } from './auth.js';

// Fastify route guards. Each one sends the error response itself and returns
// null when the request is not allowed, so callers can `if (!user) return;`.
export async function requireUser(request, reply) {
  const user = await authenticateRequest(request);
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

export async function requireAdmin(request, reply) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'admin') {
    reply.code(403).send({ error: 'Forbidden' });
    return null;
  }
  return user;
}
