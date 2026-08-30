import { sendEmail } from '../mail.js';
import { store } from '../store.js';

const actors = new WeakMap();

export function bindRequestActor(request, actor) {
  actors.set(request, actor || null);
  return request;
}

function entityProxy(actor) {
  return new Proxy({}, {
    get(_, entityValue) {
      const entity = String(entityValue);
      return {
        list: (sort, limit, skip) => store.list(entity, sort, limit, skip),
        filter: (filter, sort, limit, skip) => store.filter(entity, filter, sort, limit, skip),
        get: (id) => store.get(entity, id),
        create: (data) => store.create(entity, data, actor),
        bulkCreate: (rows) => store.bulkCreate(entity, rows, actor),
        update: (id, data) => store.update(entity, id, data),
        delete: (id) => store.delete(entity, id),
      };
    },
  });
}

function clientFor(request, serviceRole = false) {
  const actor = actors.get(request) || null;
  const entities = entityProxy(actor);
  const client = {
    auth: {
      async me() {
        if (!actor) throw Object.assign(new Error('Unauthorized'), { status: 401 });
        return actor;
      },
      async updateMe(data) {
        if (!actor) throw Object.assign(new Error('Unauthorized'), { status: 401 });
        return store.update('User', actor.id, data);
      },
    },
    entities,
    integrations: {
      Core: {
        SendEmail: sendEmail,
      },
    },
    functions: {
      async invoke(name, body) {
        const { invokeInternal } = await import('../function-runner.js');
        return { data: await invokeInternal(name, body, actor) };
      },
    },
  };
  if (!serviceRole) {
    Object.defineProperty(client, 'asServiceRole', {
      get: () => clientFor(request, true),
    });
  } else {
    client.asServiceRole = client;
  }
  return client;
}

export function createPlatformClientFromRequest(request) {
  return clientFor(request, false);
}
