import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { createZammadTicket } from '../zammad.js';

export default async function (req) {
  try {
    const body = await req.json();
    const platform = createPlatformClientFromRequest(req);
    let user = null;
    try {
      user = await platform.auth.me();
    } catch {}
    const ticket = await createZammadTicket(body, user);
    return Response.json({ success: true, ticket: { id: ticket.id, number: ticket.number, title: ticket.title } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
