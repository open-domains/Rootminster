import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDomainHealth, validHealthName } from './lib/domain-health.js';
import { createHealthHandler } from './functions/checkDomainHealth.js';

const name = 'demo.example.com';
const record = { id: 'a', name, record_type: 'A', content: '192.0.2.1', status: 'active' };
const answer = (type, data, extra = {}) => ({ Status: 0, AD: true, Answer: [{ name: `${name}.`, type, data }], ...extra });
const run = (records, query) => buildDomainHealth(name, records, { query });

test('record equality handles IPv6, hostname case/trailing dots, MX priority and split TXT strings', async () => {
  for (const [type, content, publicValue, number, priority] of [
    ['A', '192.0.2.1', '192.0.2.1', 1],
    ['AAAA', '2001:db8::1', '2001:0db8:0000:0000:0000:0000:0000:0001', 28],
    ['CNAME', 'HOST.example.com', 'host.example.com.', 5],
    ['MX', 'mail.example.com', '10 mail.example.com.', 15, 10],
    ['TXT', 'CaseSensitiveValue', '"CaseSensitive" "Value"', 16],
  ]) {
    const result = await run([{ ...record, record_type: type, content, priority }], async () => answer(number, publicValue));
    assert.equal(result.checks[0].status, 'pass', type);
  }
});

test('does not ignore TXT case or MX priority, or match another hostname in a CNAME chain', async () => {
  for (const [type, content, data, number, priority] of [['TXT', 'Exact', '"exact"', 16], ['MX', 'mail.example.com', '20 mail.example.com.', 15, 10]]) {
    assert.equal((await run([{ ...record, record_type: type, content, priority }], async () => answer(number, data))).checks[0].status, 'warning');
  }
  const report = await run([record], async () => ({Status:0,Answer:[{name:'other.example.com',type:1,data:record.content}]}));
  assert.equal(report.checks[0].title, 'Public record missing');
});

test('proxy and flattened CNAME checks accept addresses without claiming to verify origins', async () => {
  for (const options of [{ proxied: true }, { record_type: 'CNAME', cname_flatten: true }]) {
    const report = await run([{ ...record, ...options }], async (_, type) => type === 'AAAA' ? answer(28, '2001:db8::4') : { Status: 0 });
    assert.equal(report.checks[0].status, 'pass');
    assert.match(report.checks[0].detail, /hides the saved origin/);
  }
});

test('NXDOMAIN is missing; transport and SERVFAIL remain inconclusive', async () => {
  assert.equal((await run([record], async () => ({ Status: 3 }))).checks[0].status, 'warning');
  assert.equal((await run([record], async () => { throw new Error('timeout'); })).checks[0].status, 'unknown');
  assert.equal((await run([record], async () => ({ Status: 2 }))).checks.at(-1).status, 'unknown');
});

test('DNSSEC diagnostics distinguish unauthenticated, authenticated and likely validation failures', async () => {
  assert.equal((await run([], async () => ({ Status: 0, AD: false }))).checks.at(-1).status, 'info');
  assert.equal((await run([], async () => ({ Status: 0, AD: true }))).checks.at(-1).status, 'pass');
  const report = await run([], async (_, __, { checkingDisabled }) => ({ Status: checkingDisabled ? 0 : 2 }));
  assert.equal(report.checks.at(-1).title, 'Possible DNSSEC validation issue');
});

test('bounded batches, query deduplication and partial-check notices', async () => {
  let count = 0;
  const report = await run(Array.from({length: 60}, (_, i) => ({ ...record, id: String(i) })), async () => { count++; return answer(1, record.content); });
  assert.equal(report.checked_records, 50);
  assert.equal(count, 1);
  assert.ok(report.checks.some(check => check.id === 'limit'));
  const aborted = await buildDomainHealth(name, [record], {signal: AbortSignal.abort(), query: () => { throw new Error('Should never run'); }});
  assert.equal(aborted.status, 'unknown');
});

function fixture({ user = {id:'owner'}, owned = [{full_name:name}], records = [record] } = {}) {
  let checks = 0;
  const handler = createHealthHandler({
    clientFor: () => ({ auth: { me: async () => user }, asServiceRole: { entities: {
      SubdomainOwnership: { filter: async filter => { assert.equal(filter.owner_id, user.id); return owned; } },
      DnsRecord: { filter: async filter => { assert.deepEqual(filter, {owner_id:user.id,managed:true}); return records; } },
    } } }),
    check: async (hostname, scoped) => { checks++; return {hostname,scoped}; },
  });
  return { handler, count: () => checks };
}
const request = body => new Request('https://app.example/functions/checkDomainHealth', {method:'POST',body:JSON.stringify(body)});

test('rejects unauthorized users and namespace boundary escapes before DNS queries', async () => {
  const unauthorized = fixture({user:null});
  assert.equal((await unauthorized.handler(request({name}))).status, 401);
  const f = fixture();
  for(const target of ['example.com','evildemo.example.com','demo.example.com.evil.test']) assert.equal((await f.handler(request({name:target}))).status, 403);
  assert.equal(f.count(), 0);
});

test('validates input and scopes results, supports legacy ownership and enforces cooldown', async () => {
  for (const value of ['localhost','127.0.0.1','https://example.com','a..example.com','*.example.com']) assert.equal(validHealthName(value), false);
  const f = fixture({records:[record,{...record,id:'other',name:'other.example.com'}]});
  assert.equal((await f.handler(request({name:'https://example.com'}))).status, 400);
  const response = await f.handler(request({name:'Demo.Example.Com.'}));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).scoped.length, 1);
  assert.equal((await f.handler(request({name}))).status, 429);
  assert.equal(f.count(), 1);
  assert.equal((await fixture({owned:[]}).handler(request({name}))).status, 200);
  assert.equal((await fixture().handler(new Request('https://app.example',{method:'GET'}))).status, 405);
});

test('TXT DNS presentation escapes decode without altering literal saved quotes or case', async () => {
  for (const [content, data] of [
    ['hello "world"', '"hello \\"world\\""'],
    ['path\\file', '"path\\\\file"'],
    ['hello world', '"hello\\032world"'],
    ['café', '"caf\\195\\169"'],
    ['"quoted"', '"\\"quoted\\""'],
  ]) {
    const result = await run([{...record,record_type:'TXT',content}],async()=>answer(16,data));
    assert.equal(result.checks[0].status,'pass',content);
  }
});
