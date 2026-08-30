import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { secrets } from '../lib/runtime.js';
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user)
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'admin' && user.role !== 'staff') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        const body = await req.json();
        const { action, virtualMachineId, projectName } = body;
        // Staff may inspect logs, but infrastructure-changing actions are admin-only.
        if (action !== 'logs' && user.role !== 'admin') {
            return Response.json({ error: 'Admin access required for Docker actions' }, { status: 403 });
        }
        if (!virtualMachineId || !projectName) {
            return Response.json({ error: 'virtualMachineId and projectName are required' }, { status: 400 });
        }
        const apiKey = secrets.get('HOSTINGER_API_KEY');
        const baseUrl = 'https://developers.hostinger.com';
        let endpoint = '';
        let method = 'POST';
        if (action === 'logs') {
            method = 'GET';
            endpoint = `/api/vps/v1/virtual-machines/${virtualMachineId}/docker/${projectName}/logs`;
        }
        else if (action === 'start') {
            endpoint = `/api/vps/v1/virtual-machines/${virtualMachineId}/docker/${projectName}/start`;
        }
        else if (action === 'stop') {
            endpoint = `/api/vps/v1/virtual-machines/${virtualMachineId}/docker/${projectName}/stop`;
        }
        else if (action === 'restart') {
            endpoint = `/api/vps/v1/virtual-machines/${virtualMachineId}/docker/${projectName}/restart`;
        }
        else if (action === 'update') {
            endpoint = `/api/vps/v1/virtual-machines/${virtualMachineId}/docker/${projectName}/update`;
        }
        else {
            return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
        const fetchOpts = {
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        };
        const response = await fetch(`${baseUrl}${endpoint}`, fetchOpts);
        const data = await response.json().catch(() => ({}));
        return Response.json({ ok: response.ok, status: response.status, data });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
