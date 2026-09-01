/**
 * Device OAuth Flow — RFC 8628 style device authorization.
 * Allows CLI/apps to obtain API tokens on behalf of logged-in users.
 *
 * Actions:
 * - request_code: Generate a device_code and user_code
 * - approve: User approves the code (must be logged in)
 * - deny: User denies the code
 * - poll: Poll for token status (pending/approved/denied/expired)
 */
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
import crypto from 'node:crypto';
import { randomToken } from '../security.js';
import { withAdvisoryLock } from '../database.js';
function generateUserCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    let code = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4)
            code += '-';
        code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
}
async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function handleRequestCode(platform, body, respond) {
    const deviceCode = `dvc_${randomToken(32)}`;
    const userCode = generateUserCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await platform.entities.DeviceCode.create({
        device_code: deviceCode,
        user_code: userCode,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        token_name: body.token_name || 'Device Token',
    });
    return respond({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: `${config.appUrl}/activate`,
        expires_in: 600,
    });
}
async function handleApprove(platform, body, respond) {
    const { user_code } = body;
    if (!user_code)
        return respond({ error: 'user_code required' }, 400);
    const user = await platform.auth.me();
    if (!user)
        return respond({ error: 'Unauthorized — you must be logged in to approve' }, 401);
    const codes = await platform.asServiceRole.entities.DeviceCode.filter({ user_code: user_code.toUpperCase(), status: 'pending' });
    if (!codes.length)
        return respond({ error: 'Invalid or expired code' }, 404);
    const code = codes[0];
    // Check expiry
    if (new Date(code.expires_at) < new Date()) {
        await platform.asServiceRole.entities.DeviceCode.update(code.id, { status: 'expired' });
        return respond({ error: 'Code expired' }, 410);
    }
    await platform.asServiceRole.entities.DeviceCode.update(code.id, {
        status: 'approved',
        user_id: user.id,
        user_email: user.email,
    });
    return respond({ success: true, message: 'Code approved' });
}
async function handleDeny(platform, body, respond) {
    const { user_code } = body;
    if (!user_code)
        return respond({ error: 'user_code required' }, 400);
    const user = await platform.auth.me().catch(() => null);
    if (!user)
        return respond({ error: 'Unauthorized — you must be logged in to deny a code' }, 401);
    const codes = await platform.asServiceRole.entities.DeviceCode.filter({ user_code: user_code.toUpperCase(), status: 'pending' });
    if (!codes.length)
        return respond({ error: 'Invalid code' }, 404);
    await platform.asServiceRole.entities.DeviceCode.update(codes[0].id, { status: 'denied' });
    return respond({ success: true, message: 'Code denied' });
}
async function handlePoll(platform, body, respond) {
    const { device_code } = body;
    if (!device_code)
        return respond({ error: 'device_code required' }, 400);
    return withAdvisoryLock(`device-code:${device_code}`, async () => {
    const codes = await platform.asServiceRole.entities.DeviceCode.filter({ device_code });
    if (!codes.length)
        return respond({ error: 'Invalid device_code' }, 404);
    const code = codes[0];
    // Check expiry
    if (new Date(code.expires_at) < new Date()) {
        if (code.status === 'pending') {
            await platform.asServiceRole.entities.DeviceCode.update(code.id, { status: 'expired' });
        }
        return respond({ status: 'expired' });
    }
    if (code.status === 'pending') {
        return respond({ status: 'pending' });
    }
    if (code.status === 'denied') {
        return respond({ status: 'denied' });
    }
    if (code.status === 'approved') {
        // Generate API token
        const rawToken = `od_${randomToken(32)}`;
        const tokenHash = await sha256hex(rawToken);
        const tokenPrefix = rawToken.slice(0, 8);
        await platform.asServiceRole.entities.ApiToken.create({
            user_id: code.user_id,
            user_email: code.user_email,
            name: code.token_name || 'Device Token',
            token_hash: tokenHash,
            token_prefix: tokenPrefix,
            revoked: false,
            scopes: ['account:read', 'requests:read', 'requests:write', 'dns:read', 'dns:write'],
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });
        // Mark code as used
        await platform.asServiceRole.entities.DeviceCode.update(code.id, {
            api_token_id: tokenPrefix,
            status: 'used',
        });
        return respond({
            status: 'approved',
            api_key: rawToken,
        });
    }
    if (code.status === 'used') {
        return respond({ status: 'used' });
    }
    return respond({ error: 'Unknown status' }, 500);
    }).then((result) => result?.skipped ? respond({ error: 'Authorization is already being redeemed' }, 409) : result);
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const url = new URL(req.url);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    const respond = (data, status = 200) => Response.json(data, { status, headers: corsHeaders });
    // Parse body once — path-based routes parse inside their handlers
    const pathname = url.pathname;
    if (pathname === '/device/request' || pathname.endsWith('/device/request')) {
        const body = await req.json().catch(() => ({}));
        return handleRequestCode(platform, body, respond);
    }
    if (pathname === '/device/poll' || pathname.endsWith('/device/poll')) {
        const body = await req.json().catch(() => ({}));
        return handlePoll(platform, body, respond);
    }
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (action === 'request_code') {
        return handleRequestCode(platform, body, respond);
    }
    if (action === 'approve') {
        return handleApprove(platform, body, respond);
    }
    if (action === 'deny') {
        return handleDeny(platform, body, respond);
    }
    if (action === 'poll') {
        return handlePoll(platform, body, respond);
    }
    return respond({ error: 'Unknown action. Use: request_code, approve, deny, poll' }, 400);
}
