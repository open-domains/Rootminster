import { callTool as defaultCallReviewTool } from './mcp.js';
import { invokeInternal as defaultInvokeInternal } from './function-runner.js';

const REVIEW_TOOLS = new Set(['list_pending_reviews', 'get_review_request', 'approve_review', 'reject_review']);
const ACCOUNT_TOOLS = new Set(['update_user']);
const SENSITIVE_USER_FIELDS = new Set(['password_hash', 'totp_secret']);

export const DEFAULT_ADMIN_AI_ACTOR = Object.freeze({
  id: 'admin-ai',
  email: 'admin-ai@open-domains.local',
  full_name: 'Admin AI',
  role: 'admin',
});

function cleanAction(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`action ${index + 1} must be an object`);
  const tool = String(raw.tool || raw.name || '').trim();
  if (!tool) throw new Error(`action ${index + 1} tool is required`);
  const args = raw.arguments ?? raw.args ?? {};
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(`action ${index + 1} arguments must be an object`);
  return { tool, arguments: args };
}

export function parseAdminAiInput(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Input must be a JSON object');
  const rawActions = Array.isArray(payload.actions) ? payload.actions : [{ tool: payload.tool || payload.name, arguments: payload.arguments ?? payload.args ?? {} }];
  if (!rawActions.length) throw new Error('Provide at least one action');
  return {
    actions: rawActions.map(cleanAction),
    dry_run: payload.dry_run === true,
  };
}

export function safeUser(user) {
  if (!user || typeof user !== 'object') return user;
  return Object.fromEntries(Object.entries(user).filter(([key]) => !SENSITIVE_USER_FIELDS.has(key)));
}

function safeResult(result) {
  if (!result || typeof result !== 'object') return result;
  if (result.user) return { ...result, user: safeUser(result.user) };
  if (Array.isArray(result.users)) return { ...result, users: result.users.map(safeUser) };
  return result;
}

function structuredToolResult(result) {
  if (result && typeof result === 'object' && 'structuredContent' in result) return result.structuredContent;
  return result;
}

function assertAdminActor(actor) {
  if (!actor || actor.role !== 'admin') throw Object.assign(new Error('Admin AI actor must have admin role'), { status: 403 });
}

function validateUpdateUser(args) {
  if (!args.user_id) throw Object.assign(new Error('user_id is required'), { status: 400 });
  if (!args.data || typeof args.data !== 'object' || Array.isArray(args.data)) throw Object.assign(new Error('data is required'), { status: 400 });
}

export function createAdminAiExecutor({
  actor = DEFAULT_ADMIN_AI_ACTOR,
  callReviewTool = defaultCallReviewTool,
  invokeInternal = defaultInvokeInternal,
} = {}) {
  assertAdminActor(actor);

  function validateReviewTool(action) {
    if ((action.tool === 'approve_review' || action.tool === 'reject_review') && !action.arguments.request_id) {
      throw Object.assign(new Error('request_id is required'), { status: 400 });
    }
    if (action.tool === 'get_review_request' && !action.arguments.request_id && !action.arguments.hostname) {
      throw Object.assign(new Error('request_id or hostname is required'), { status: 400 });
    }
    if (action.tool === 'reject_review' && !String(action.arguments.rejection_reason || '').trim()) {
      throw Object.assign(new Error('rejection_reason is required'), { status: 400 });
    }
  }

  async function executeAction(action, dryRun) {
    if (!REVIEW_TOOLS.has(action.tool) && !ACCOUNT_TOOLS.has(action.tool)) {
      throw Object.assign(new Error(`Unknown admin AI tool: ${action.tool}`), { status: 404 });
    }
    if (REVIEW_TOOLS.has(action.tool)) validateReviewTool(action);
    if (action.tool === 'update_user') validateUpdateUser(action.arguments);
    if (dryRun) {
      return { ok: true, tool: action.tool, dry_run: true, arguments: action.arguments };
    }
    if (REVIEW_TOOLS.has(action.tool)) {
      const result = await callReviewTool(action.tool, action.arguments, actor);
      return { ok: true, tool: action.tool, result: safeResult(structuredToolResult(result)) };
    }
    if (action.tool === 'update_user') {
      validateUpdateUser(action.arguments);
      const result = await invokeInternal('adminListUsers', {
        action: 'update_user',
        user_id: action.arguments.user_id,
        data: action.arguments.data,
      }, actor);
      return { ok: true, tool: action.tool, result: safeResult(result) };
    }
    throw Object.assign(new Error(`Unknown admin AI tool: ${action.tool}`), { status: 404 });
  }

  return {
    async run(input) {
      const parsed = parseAdminAiInput(input);
      const results = [];
      for (const [index, action] of parsed.actions.entries()) {
        try {
          results.push({ index, ...(await executeAction(action, parsed.dry_run)) });
        } catch (error) {
          results.push({ index, ok: false, tool: action.tool, error: error.message || 'Action failed', status: error.status || 500, ...(error.data ? { data: error.data } : {}) });
        }
      }
      return { success: results.every(result => result.ok), results };
    },
  };
}
