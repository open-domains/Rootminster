import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { PROTECTED_BRANDS_KEY } from '../lib/brand-protection.js';
import { normaliseBrandList, parseBrandList } from '../../shared/brand-protection.js';

const MAX_LENGTH = 20_000;

// Staff and admins view and edit the protected brand list.
export default async function (req) {
    if (req.method !== 'POST')
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || !['admin', 'staff'].includes(user.role))
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const entities = platform.asServiceRole.entities;
    const rows = await entities.PlatformSettings.filter({ key: PROTECTED_BRANDS_KEY });
    const current = rows[0]?.value || '';

    if (body.action === 'get')
        return Response.json({ value: normaliseBrandList(current), ...parseBrandList(current) });

    if (body.action !== 'save')
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    const raw = String(body.value ?? '');
    if (raw.length > MAX_LENGTH)
        return Response.json({ error: 'The list is too long' }, { status: 400 });
    const value = normaliseBrandList(raw);
    if (rows[0]) await entities.PlatformSettings.update(rows[0].id, { value });
    else await entities.PlatformSettings.create({ key: PROTECTED_BRANDS_KEY, value, description: 'Protected brand names that users cannot register' });
    const before = parseBrandList(current);
    const after = parseBrandList(value);
    const added = after.brands.filter((brand) => !before.brands.includes(brand));
    const removed = before.brands.filter((brand) => !after.brands.includes(brand));
    await entities.AuditLog.create({
        actor_email: user.email,
        actor_role: user.role,
        action: 'protected_brands_updated',
        entity_type: 'PlatformSettings',
        description: `Protected brands updated${added.length ? `; added ${added.join(', ')}` : ''}${removed.length ? `; removed ${removed.join(', ')}` : ''}`,
        old_value: normaliseBrandList(current),
        new_value: value,
    });
    return Response.json({ value, ...after });
}
