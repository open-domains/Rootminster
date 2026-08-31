import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { SAFETY_RULESET_VERSION, screenRequest } from '../lib/safety-screening.js';

const STAFF_ROLES = new Set(['staff', 'admin']);
const OVERRIDE_VERDICTS = new Set(['clear', 'review', 'high_risk']);

export default async function manageSafetyAssessment(req) {
  const platform = createPlatformClientFromRequest(req);
  const user = await platform.auth.me();
  if (!user || !STAFF_ROLES.has(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const requestId = String(body.request_id || '');
  if (!requestId) return Response.json({ error: 'request_id is required' }, { status: 400 });
  const rows = await platform.asServiceRole.entities.SubdomainRequest.filter({ id: requestId });
  const request = rows[0];
  if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });

  if (body.action === 'rerun') {
    const owners = await platform.asServiceRole.entities.User.filter({ id: request.requester_id });
    const assessment = await screenRequest(platform, request, owners[0] || { id: request.requester_id, email: request.requester_email }, 'staff_rerun');
    await platform.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_role: user.role,
      action: 'safety_screening_rerun',
      entity_type: 'SubdomainRequest',
      entity_id: request.id,
      description: `Safety screening re-run for ${request.subdomain}.${request.root_domain}`,
    });
    return Response.json({ success: true, assessment });
  }

  if (body.action !== 'override') return Response.json({ error: 'Unknown action' }, { status: 400 });
  const verdict = String(body.verdict || '');
  const reason = String(body.reason || '').trim();
  if (!OVERRIDE_VERDICTS.has(verdict)) return Response.json({ error: 'Invalid override verdict' }, { status: 400 });
  if (reason.length < 5) return Response.json({ error: 'An override reason of at least five characters is required' }, { status: 400 });

  const screenedAt = new Date().toISOString();
  const priorVerdict = request.safety_verdict || 'not_screened';
  const assessment = await platform.asServiceRole.entities.SafetyAssessment.create({
    request_id: request.id,
    score: Number(request.safety_score) || 0,
    verdict,
    automated_verdict: priorVerdict,
    signals: [],
    ruleset_version: request.safety_ruleset_version || SAFETY_RULESET_VERSION,
    provider_status: request.safety_provider_status || 'not_run',
    trigger: 'staff_override',
    screened_at: screenedAt,
    overridden: true,
    override_reason: reason,
    overridden_by: user.email,
  });
  await platform.asServiceRole.entities.SubdomainRequest.update(request.id, {
    safety_assessment_id: assessment.id,
    safety_verdict: verdict,
    safety_screened_at: screenedAt,
    safety_overridden: true,
    safety_override_reason: reason,
    safety_overridden_by: user.email,
  });
  await platform.asServiceRole.entities.AuditLog.create({
    actor_email: user.email,
    actor_role: user.role,
    action: 'safety_verdict_overridden',
    entity_type: 'SubdomainRequest',
    entity_id: request.id,
    description: `Safety verdict changed from ${priorVerdict} to ${verdict}: ${reason}`,
    old_value: priorVerdict,
    new_value: verdict,
  });
  return Response.json({ success: true, assessment });
}
