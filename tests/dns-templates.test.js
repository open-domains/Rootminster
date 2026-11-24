import test from 'node:test';
import assert from 'node:assert/strict';
import { DNS_TEMPLATES, summariseTemplateHealth, templateById, templateFieldValue } from '../src/lib/dns-templates.js';
import { validateAddName, validateContent } from '../src/components/dns/dnsConfig.js';

test('every template builds records that pass the DNS manager validation', () => {
  const sample = { username: 'octocat', site: 'demo', project: 'demo', service: 'demo', token: 'verify=abc123', did: 'did:plc:abc123', ip: '203.0.113.10' };
  for (const template of DNS_TEMPLATES) {
    const records = template.build(sample, 'demo.example.com');
    assert.ok(records.length > 0, template.id);
    for (const record of records) {
      assert.equal(validateAddName(record.name, 'demo.example.com').valid, true, `${template.id} ${record.name}`);
      assert.equal(validateContent(record.type, record.value).valid, true, `${template.id} ${record.type} ${record.value}`);
    }
  }
});

test('Fastmail DKIM targets include the managed subdomain', () => {
  const records = templateById('fastmail').build({}, 'mail.example.com');
  assert.ok(records.some((record) => record.value === 'fm1.mail.example.com.dkim.fmhosted.com'));
});

test('template fields keep tokens verbatim and tidy identifiers', () => {
  assert.equal(templateFieldValue(templateById('verification'), ' Token=AbC '), ' Token=AbC ');
  assert.equal(templateFieldValue(templateById('netlify'), ' My-Site '), 'my-site');
  assert.equal(templateFieldValue(templateById('bluesky'), 'did=did:plc:Abc'), 'did:plc:Abc');
});

test('health summary matches checks to the applied records', () => {
  const records = [
    { name: '@', type: 'A', value: '1.1.1.1' },
    { name: '@', type: 'A', value: '1.0.0.1' },
    { name: 'www', type: 'CNAME', value: 'x.github.io' },
  ];
  const report = { checks: [
    { name: 'demo.example.com', record_type: 'A', status: 'pass' },
    { name: 'demo.example.com', record_type: 'A', status: 'pass' },
    { name: 'www.demo.example.com', record_type: 'CNAME', status: 'warning', title: 'Public record missing', action: 'Wait for the TTL' },
    { id: 'dnssec', status: 'info' },
  ] };
  const summary = summariseTemplateHealth(report, records, 'demo.example.com');
  assert.equal(summary.overall, 'warning');
  assert.deepEqual(summary.rows.map((row) => [row.name, row.status]), [['demo.example.com', 'pass'], ['www.demo.example.com', 'warning']]);
  assert.equal(summary.rows[1].action, 'Wait for the TTL');
  assert.equal(summariseTemplateHealth({ checks: [] }, records, 'demo.example.com').overall, 'pending');
});
