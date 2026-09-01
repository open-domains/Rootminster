import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { markSessionMfaVerified } from '../auth.js';
import { decryptTotpSecret, encryptTotpSecret } from '../security.js';
import { pool } from '../database.js';
import * as OTPAuth from 'otpauth';
const TRUST_DAYS = 30;
async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user)
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json();
        const { action } = body;
        if (action === 'setup') {
            if (user.totp_enabled)
                return Response.json({ error: 'Two-factor authentication is already enabled' }, { status: 409 });
            if (process.env.NODE_ENV === 'production' && !process.env.TOTP_ENCRYPTION_KEY)
                return Response.json({ error: 'Two-factor setup is temporarily unavailable' }, { status: 503 });
            // Generate a new TOTP secret
            const secret = new OTPAuth.Secret({ size: 20 });
            const totp = new OTPAuth.TOTP({
                issuer: 'OpenDomains',
                label: user.email,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret,
            });
            const uri = totp.toString();
            const secretBase32 = secret.base32;
            return Response.json({ uri, secret: secretBase32 });
        }
        if (action === 'enable') {
            if (user.totp_enabled)
                return Response.json({ error: 'Two-factor authentication is already enabled' }, { status: 409 });
            const { secret, code } = body;
            if (!secret || !code)
                return Response.json({ error: 'Missing secret or code' }, { status: 400 });
            const totp = new OTPAuth.TOTP({
                issuer: 'OpenDomains',
                label: user.email,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(secret),
            });
            const delta = totp.validate({ token: code, window: 1 });
            if (delta === null)
                return Response.json({ error: 'Invalid code' }, { status: 400 });
            // Store the secret on the user profile
            await platform.auth.updateMe({ totp_secret: encryptTotpSecret(secret), totp_enabled: true });
            await markSessionMfaVerified(user);
            return Response.json({ ok: true });
        }
        if (action === 'disable') {
            if (user.role === 'staff' || user.role === 'admin')
                return Response.json({ error: 'Staff and admin accounts must keep two-factor authentication enabled' }, { status: 403 });
            const code = String(body.code || '');
            if (!user.totp_enabled || !user.totp_secret || !code)
                return Response.json({ error: 'A current authenticator code is required' }, { status: 400 });
            const totp = new OTPAuth.TOTP({
                issuer: 'OpenDomains', label: user.email, algorithm: 'SHA1', digits: 6, period: 30,
                secret: OTPAuth.Secret.fromBase32(decryptTotpSecret(user.totp_secret)),
            });
            if (totp.validate({ token: code, window: 1 }) === null)
                return Response.json({ error: 'Invalid code' }, { status: 400 });
            await platform.auth.updateMe({ totp_secret: null, totp_enabled: false });
            await pool.query('UPDATE sessions SET mfa_verified_at = NULL WHERE user_id = $1', [user.id]);
            const devices = await platform.entities.TrustedDevice.filter({ user_id: user.id }, null, 1000);
            await Promise.all(devices.map((device) => platform.entities.TrustedDevice.delete(device.id)));
            return Response.json({ ok: true });
        }
        if (action === 'verify') {
            const { code, trust_browser, user_agent } = body;
            if (!code)
                return Response.json({ error: 'Missing code' }, { status: 400 });
            const userData = await platform.auth.me();
            if (!userData.totp_enabled || !userData.totp_secret) {
                return Response.json({ error: '2FA not enabled' }, { status: 400 });
            }
            const totp = new OTPAuth.TOTP({
                issuer: 'OpenDomains',
                label: userData.email,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(decryptTotpSecret(userData.totp_secret)),
            });
            const delta = totp.validate({ token: code, window: 1 });
            if (delta === null)
                return Response.json({ error: 'Invalid code' }, { status: 400 });
            if (!String(userData.totp_secret).startsWith('enc:v1:') && process.env.TOTP_ENCRYPTION_KEY) {
                await platform.auth.updateMe({ totp_secret: encryptTotpSecret(userData.totp_secret) });
            }
            await markSessionMfaVerified(userData);
            let device_token = null;
            if (trust_browser) {
                device_token = randomToken();
                const token_hash = await sha256Hex(device_token);
                const expires_at = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
                await platform.entities.TrustedDevice.create({
                    user_id: userData.id,
                    user_email: userData.email,
                    token_hash,
                    token_prefix: device_token.slice(0, 8),
                    user_agent: user_agent || '',
                    last_used: new Date().toISOString(),
                    expires_at,
                });
            }
            return Response.json({ ok: true, device_token });
        }
        if (action === 'verify_trusted') {
            const { device_token } = body;
            if (!device_token)
                return Response.json({ valid: false });
            const userData = await platform.auth.me();
            if (!userData)
                return Response.json({ valid: false });
            const token_hash = await sha256Hex(device_token);
            const devices = await platform.entities.TrustedDevice.filter({ user_id: userData.id, token_hash });
            const device = devices?.[0];
            if (!device)
                return Response.json({ valid: false });
            if (device.expires_at && new Date(device.expires_at) < new Date()) {
                await platform.entities.TrustedDevice.delete(device.id);
                return Response.json({ valid: false });
            }
            await platform.entities.TrustedDevice.update(device.id, { last_used: new Date().toISOString() });
            await markSessionMfaVerified(userData);
            return Response.json({ valid: true });
        }
        if (action === 'list_trusted') {
            const userData = await platform.auth.me();
            if (!userData)
                return Response.json({ error: 'Unauthorized' }, { status: 401 });
            const devices = await platform.entities.TrustedDevice.filter({ user_id: userData.id }, '-last_used', 100);
            return Response.json({ devices });
        }
        if (action === 'revoke_trusted') {
            const { device_id } = body;
            if (!device_id)
                return Response.json({ error: 'Missing device_id' }, { status: 400 });
            const userData = await platform.auth.me();
            if (!userData)
                return Response.json({ error: 'Unauthorized' }, { status: 401 });
            const device = await platform.entities.TrustedDevice.get(device_id);
            if (!device || device.user_id !== userData.id) {
                return Response.json({ error: 'Not found' }, { status: 404 });
            }
            await platform.entities.TrustedDevice.delete(device_id);
            return Response.json({ ok: true });
        }
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
