import { store } from '../store.js';
import { invokeInternal } from '../function-runner.js';
import { config } from '../config.js';
import { requestBundle, bundleComments } from './request-bundles.js';
import { OPEN_REQUEST_STATUSES, recordSetError, requestHostname } from '../../shared/subdomain-requests.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const staff = actor => ['staff', 'admin'].includes(actor.role);
const fail = message => { throw Object.assign(new Error(message), { userMessage: true }); };
const clip = (value, max = 1000) => String(value || '—').slice(0, max);
const safe = value => clip(value).replace(/([\\`*_~|>])/g, '\\$1');
const button = (label, action, id = '', style = 2, disabled = false) => ({ type: 2, style, label, custom_id: `rm:${action}:${id}`, disabled });
const row = (...components) => ({ type: 1, components });
export const discordMessage = (content, components = [], embeds = []) => ({ content: clip(content, 1950), components, embeds, allowed_mentions: { parse: [] } });

export function discordModal(interaction) {
  if (interaction.type !== 3) return null;
  const [prefix, action, id, extra] = String(interaction.data?.custom_id || '').split(':');
  const labels = { reject: 'Rejection reason', question: 'Question for requester', note: 'Internal staff note', reply: 'Reply to conversation' };
  if (prefix !== 'rm' || !labels[action] || !UUID.test(id) || extra) return null;
  // Opening a blank form reveals no request data. Submission always checks
  // the currently linked account and its current permissions before writing.
  return { type: 9, data: { custom_id: `rm:send-${action}:${id}`, title: labels[action], components: [
    { type: 18, label: labels[action], component: { type: 4, custom_id: 'message', style: 2, required: true, min_length: 1, max_length: 2000 } },
  ] } };
}
function modalText(components) {
  for (const component of components || []) {
    if (component.custom_id === 'message' && typeof component.value === 'string') return component.value;
    const nested = modalText(component.components || (component.component ? [component.component] : []));
    if (nested !== undefined) return nested;
  }
}
export function createDiscordRequests({ database = store, invoke = invokeInternal } = {}) {
  const entities = Object.fromEntries(['SubdomainRequest', 'RequestComment'].map(entity => [entity, { filter: (...args) => database.filter(entity, ...args) }]));
  async function load(id, actor) {
    if (!UUID.test(id)) fail('Enter a valid request ID.');
    const request = await database.get('SubdomainRequest', id);
    if (!request || (!staff(actor) && !(request.requester_id ? request.requester_id === actor.id : request.requester_email === actor.email))) fail('Request not found or you no longer have access.');
    return requestBundle(entities, request);
  }
  async function list(actor, scope = 'mine', offset = 0) {
    if (!['mine', 'pending'].includes(scope) || !Number.isSafeInteger(offset) || offset < 0) fail('Invalid request page.');
    if (scope === 'pending' && !staff(actor)) fail('The review queue is available to staff only.');
    const rows = await database.searchRequests({ limit: 6, offset, ...(scope === 'pending' ? { statuses: OPEN_REQUEST_STATUSES } : { owner: actor }) });
    const bundles = await Promise.all(rows.slice(0, 5).map(request => requestBundle(entities, request)));
    const groups = [...new Map(bundles.map(bundle => [bundle.id, bundle])).values()];
    const items = groups.map(bundle => `${safe(requestHostname(bundle))} · ${bundle.status} · ${bundle._records.length} record(s)`);
    // Five action rows maximum. Keep navigation on its own row.
    const openButtons = groups.map((bundle, i) => button(`Open ${i + 1}`, 'view', bundle.id));
    return discordMessage(`**${scope === 'pending' ? 'Staff review queue' : 'Your requests'}**\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n') || 'No requests on this page.'}`, [
      ...(groups.length ? [row(...openButtons)] : []),
      row(button('Previous', `list-${scope}`, String(Math.max(0, offset - 5)), 2, offset === 0), button('Refresh', `list-${scope}`, String(offset)), button('Next', `list-${scope}`, String(offset + 5), 2, rows.length <= 5)),
      row(button('My requests', 'list-mine', '0'), ...(staff(actor) ? [button('Staff queue', 'list-pending', '0')] : []), { type: 2, style: 5, label: 'New request on site', url: `${config.appUrl}/my-requests` }),
    ]);
  }
  async function view(actor, id, confirmation = false, notice = '', offset = 0) {
    const bundle = await load(id, actor);
    const comments = await bundleComments(entities, bundle, staff(actor));
    const newest = [...comments].reverse();
    if (!Number.isSafeInteger(offset) || offset < 0) fail('Invalid conversation page.');
    const open = OPEN_REQUEST_STATUSES.includes(bundle.status);
    const conflict = recordSetError(bundle._records);
    const controls = [row(button('Refresh', 'view', bundle.id), button('My requests', 'list-mine', '0'), ...(staff(actor) ? [button('Staff queue', 'list-pending', '0')] : []))];
    if (open) controls.unshift(staff(actor)
      ? row(button(confirmation ? 'Confirm DNS approval' : 'Approve', confirmation ? 'confirm' : 'approve', bundle.id, 3, !!conflict), button('Reject', 'reject', bundle.id, 4), button('Ask for info', 'question', bundle.id), button('Internal note', 'note', bundle.id))
      : row(button('Reply', 'reply', bundle.id, 1)));
    if (comments.length > 3) controls.push(row(button('Newer messages', 'history', `${bundle.id}:${Math.max(0, offset - 3)}`, 2, offset === 0), button('Older messages', 'history', `${bundle.id}:${offset + 3}`, 2, offset + 3 >= comments.length)));
    controls.push(row({ type: 2, style: 5, label: 'Open dashboard', url: `${config.appUrl}/${staff(actor) ? 'admin-requests' : 'my-requests'}` }));
    const fields = [
      { name: 'DNS records', value: clip(bundle._records.map(record => `${record.record_type}: ${safe(record.record_value).slice(0, 110)}`).join('\n'), 1000) },
      { name: 'Project', value: clip(safe(bundle.reason), 500) },
      { name: 'Preview', value: clip(safe(bundle.preview_link), 300) },
      { name: 'Conversation (newest first)', value: clip(newest.slice(offset, offset + 3).map(comment => `${comment.is_internal ? '[Internal] ' : ''}${safe(comment.author_email)}: ${safe(comment.message).slice(0, 220)}`).join('\n\n') || 'No messages yet.', 1000) },
    ];
    if (staff(actor)) {
      const risk = [...bundle._requests].sort((a, b) => Number(b.safety_score || 0) - Number(a.safety_score || 0))[0];
      fields.push({ name: 'Requested by', value: safe(bundle.requester_email) }, { name: 'Safety screening', value: `${risk.safety_verdict || 'incomplete'} · ${Number(risk.safety_score) || 0}/100${risk.safety_overridden ? ' · staff override' : ''}` });
    }
    if (bundle.rejection_reason) fields.push({ name: 'Rejection reason', value: clip(safe(bundle.rejection_reason), 500) });
    return discordMessage([notice, confirmation && open ? 'Confirm approval to create all DNS records in this request.' : '', conflict ? `Cannot approve: ${conflict}` : ''].filter(Boolean).join('\n') || 'Request details', controls, [{ title: clip(requestHostname(bundle), 256), description: `Status: **${bundle.status}**\nRequest ID: ${bundle.id}`, color: bundle.status === 'approved' ? 0x16a34a : 0x2563eb, fields, footer: { text: 'Long values and messages are shortened here. Full details are available on the dashboard.' } }]);
  }
  async function act(actor, id, action, message) {
    if (!['confirm', 'send-reject', 'send-question', 'send-note', 'send-reply'].includes(action)) fail('Unknown review action.');
    if (action !== 'send-reply' && !staff(actor)) fail('This action is available to staff only.');
    const bundle = await load(id, actor);
    if (!OPEN_REQUEST_STATUSES.includes(bundle.status)) fail(`This request is already ${bundle.status}. Refresh its details.`);
    if (action === 'confirm' && recordSetError(bundle._records)) fail(recordSetError(bundle._records));
    if (action === 'confirm') await invoke('approveRequest', { request_id: bundle.id, admin_notes: 'Approved from Discord' }, actor);
    else {
      if (typeof message !== 'string' || !message.trim() || message.length > 2000) fail('Enter a message between 1 and 2000 characters.');
      if (action === 'send-reject') await invoke('rejectRequest', { request_id: bundle.id, rejection_reason: message.trim(), admin_notes: 'Reviewed from Discord' }, actor);
      else await invoke('postComment', { request_id: bundle.id, request_type: 'subdomain', message: message.trim(), message_type: action === 'send-question' ? 'question' : action === 'send-note' ? 'comment' : 'reply', is_internal: action === 'send-note', notify_user: action === 'send-question' }, actor);
    }
    return view(actor, bundle.id, false, action === 'confirm' ? 'Request approved.' : action === 'send-reject' ? 'Request rejected.' : 'Message saved.');
  }
  async function component(interaction, actor) {
    const [prefix, action, id, page, extra] = String(interaction.data?.custom_id || '').split(':');
    if (prefix !== 'rm' || extra || (page !== undefined && action !== 'history')) fail('This control is invalid. Run /requests again.');
    if (interaction.type === 5) {
      if (!action.startsWith('send-')) fail('Invalid form.');
      return act(actor, id, action, modalText(interaction.data.components));
    }
    if (action.startsWith('list-')) return list(actor, action.slice(5), /^\d+$/.test(id) ? Number(id) : NaN);
    if (action === 'view') return view(actor, id);
    if (action === 'history') return view(actor, id, false, '', /^\d+$/.test(page) ? Number(page) : NaN);
    if (action === 'approve') { if (!staff(actor)) fail('Staff access required.'); return view(actor, id, true); }
    if (action === 'confirm') return act(actor, id, action);
    fail('This control has expired or is unsupported. Run /requests again.');
  }
  return { list, view, act, component };
}
