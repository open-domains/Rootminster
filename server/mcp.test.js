import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mcpBearerToken, mcpConsentContentSecurityPolicy } from './mcp.js';

test('MCP bearer authentication accepts case-insensitive schemes', () => {
  assert.equal(mcpBearerToken('Bearer rmcp_at_example'), 'rmcp_at_example');
  assert.equal(mcpBearerToken('bearer rmcp_at_example'), 'rmcp_at_example');
  assert.equal(mcpBearerToken('Basic example'), null);
  assert.equal(mcpBearerToken('Bearer token with spaces'), null);
});

test('MCP consent CSP permits only the validated callback origin', () => {
  assert.equal(
    mcpConsentContentSecurityPolicy('https://chatgpt.com/connector/oauth/callback?state=secret'),
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://chatgpt.com; frame-ancestors 'none'; base-uri 'none'",
  );
  assert.equal(
    mcpConsentContentSecurityPolicy('http://localhost:3456/callback'),
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://localhost:3456; frame-ancestors 'none'; base-uri 'none'",
  );
});

test('MCP authorization sends MFA-pending sessions through the dashboard and resumes them', async () => {
  const mcp = await readFile(new URL('./mcp.js', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');
  assert.match(mcp, /authenticateRequest\(request, \{ allowMfaPending: true \}\)/);
  assert.match(mcp, /user\.mfa_required && !user\.mfa_verified/);
  assert.match(mcp, /user-dashboard\?return_to=/);
  assert.match(layout, /startsWith\('\/oauth\/authorize\?'\)/);
  assert.match(layout, /window\.location\.assign\(mcpReturnTo\)/);
  assert.match(layout, /onVerified=\{finishMfa\}/);
});

test('MCP advertises the current protocol and scoped protected-resource challenge', async () => {
  const mcp = await readFile(new URL('./mcp.js', import.meta.url), 'utf8');
  assert.match(mcp, /'2025-11-25'/);
  assert.ok(mcp.includes('oauth-protected-resource/mcp'), 'challenge must point to the path-specific metadata');
  assert.ok(mcp.includes('scope="rootminster"'), 'challenge must advertise the required scope');
});
