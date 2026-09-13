import { createHash } from 'node:crypto';
import legacyApi from './functions/publicApi.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSubdomainRequests, recordSetError } from '../shared/subdomain-requests.js';
import { requestBundle, bundleComments } from './lib/request-bundles.js';
import { provisionRequestBundle } from './lib/request-approval.js';
import { callTool } from './mcp.js';
import { store } from './store.js';
import { pool } from './database.js';
import { bindRequestActor } from './lib/platform-client.js';
import postComment from './functions/postComment.js';
import submitRequest from './functions/submitRequest.js';
import getConversation from './functions/getRequestConversation.js';

const owner = { id: 'owner', email: 'owner@example.com', role: 'user' };
const row = (id, type = 'A', status = 'pending') => ({ id, requester_id: owner.id, requester_email: owner.email, subdomain: 'site', root_domain: 'example.com', record_type: type, record_value: type === 'A' ? '8.8.8.8' : 'target.example.com', status, created_date: `2026-01-0${id === 'a' ? 1 : 2}` });
function fixture(requests, comments = []) {
  const data = { SubdomainRequest: structuredClone(requests), RequestComment: comments, Domain: [{ id: 'domain', name: 'example.com', zone_id: 'zone' }], DnsRecord: [], SubdomainOwnership: [], AuditLog: [], SafetyAssessment: [], BlocklistEntry: [], PlatformSettings: [] };
  const entities = new Proxy({}, { get: (_, entity) => ({
    filter: async (filter) => structuredClone((data[entity] || []).filter(row => Object.entries(filter).every(([key, value]) => value?.$in ? value.$in.includes(row[key]) : row[key] === value))),
    get: async id => structuredClone(data[entity]?.find(row => row.id === id)),
    create: async value => { const created = { ...structuredClone(value), id: `${entity}-${data[entity].length}` }; data[entity].push(created); return structuredClone(created); },
    update: async (id, value) => { const found = data[entity].find(row => row.id === id); Object.assign(found, structuredClone(value)); return structuredClone(found); },
  }) });
  return { data, entities };
}
function bindStore(t, entities) {
  t.mock.method(store, 'requestsWithTargets', () => entities.SubdomainRequest.filter({}));
  t.mock.method(store, 'list', entity => entities[entity].filter({}));
  for (const method of ['filter', 'get', 'create', 'update']) t.mock.method(store, method, (entity, ...args) => entities[entity][method](...args));
}
function unlocked(t) {
  t.mock.method(pool, 'connect', async () => ({ query: async () => ({ rows: [{ locked: true }] }), release() {} }));
}
function request(body, user = owner) { return bindRequestActor(new Request('https://example.com/function', { method: 'POST', body: JSON.stringify(body) }), user); }

test('compatible bundles and duplicate/alias/delegation conflicts', () => {
  assert.equal(recordSetError([row('a'), { ...row('b', 'AAAA'), record_value: '2606:4700::1111' }]), null);
  assert.match(recordSetError([row('a'), row('b', 'CNAME')]), /CNAME/);
  assert.match(recordSetError([row('a'), row('b', 'NS')]), /NS/);
  assert.match(recordSetError([row('a'), row('b')]), /duplicate/);
  assert.equal(recordSetError([{ ...row('a','TXT'), record_value: 'ABCDEF' }, { ...row('b','TXT'), record_value: 'abcdef' }]), null);
});
test('legacy grouping keeps owners and historical submissions separate and prioritizes replies', () => {
  const groups = groupSubdomainRequests([row('a'), row('b','CNAME','user_responded'), { ...row('c'), requester_id: 'other' }, row('d','A','approved')]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].status, 'user_responded');
  assert.equal(groups[0]._records.length, 2);
  assert.deepEqual(groups[0]._request_ids, ['a', 'b']);
});
test('conversation merges legacy IDs and hides internal notes from owners', async () => {
  const { entities } = fixture([row('a'),row('b','CNAME','user_responded')], [{ id:'one',request_id:'a',request_type:'subdomain',message:'Question' },{ id:'two',request_id:'b',request_type:'subdomain',message:'Reply' },{ id:'secret',request_id:'b',request_type:'subdomain',is_internal:true }]);
  const bundle = await requestBundle(entities,row('b','CNAME','user_responded'));
  assert.equal((await bundleComments(entities,bundle,false)).length,2);
  assert.equal((await bundleComments(entities,bundle,true)).length,3);
});
test('owner reply updates all siblings without requiring notify_staff', async t => {
  const { entities, data } = fixture([row('a'),row('b','CNAME','needs_info')]); bindStore(t,entities); unlocked(t);
  const result = await postComment(request({request_id:'b',message:'Here are the details',message_type:'reply'}));
  assert.equal(result.status,200);
  assert.ok(data.SubdomainRequest.every(row => row.status === 'user_responded'));
  assert.equal(data.RequestComment[0].request_id,'a');
  assert.ok(data.SubdomainRequest.every(row => row.request_group_id === 'a'));
});
test('conversation refuses another account even if email matches an existing owner ID', async t => {
  const { entities } = fixture([row('a')]); bindStore(t,entities);
  const result = await getConversation(request({request_id:'a'},{...owner,id:'attacker'}));
  assert.equal(result.status,404);
});
test('incompatible legacy request cannot make any Cloudflare calls', async () => {
  const {entities}=fixture([row('a'),row('b','CNAME')]);
  await assert.rejects(provisionRequestBundle(entities,row('a'),owner,'',()=>{throw Error('must not run');}), /CNAME/);
});
test('approval resumes partial failure without duplicating DNS records', async () => {
  const initial={...row('a'),records:[row('a'),{...row('b','AAAA'),record_value:'2606:4700::1111'}]};
  const {entities,data}=fixture([initial]); const remote=[]; let failSecond=true; let posts=0;
  const cf=async(method,path,body)=>{
    if(method==='GET') return {success:true,result:structuredClone(remote)};
    posts++;
    if(body.type==='AAAA' && failSecond) return {success:false,errors:[{message:'Temporary failure'}]};
    const created={...body,id:`cf-${remote.length}`}; remote.push(created); return {success:true,result:created};
  };
  await assert.rejects(provisionRequestBundle(entities,initial,owner,'',cf),/Temporary failure/);
  assert.equal(data.SubdomainRequest[0].status,'pending'); assert.equal(remote.length,1);
  failSecond=false;
  const result=await provisionRequestBundle(entities,await entities.SubdomainRequest.get('a'),owner,'',cf);
  assert.equal(result.dnsRecords.length,2); assert.equal(posts,3); assert.equal(remote.length,2);
  assert.equal(data.DnsRecord.length,2); assert.equal(data.SubdomainRequest[0].status,'approved');
});
test('approval checks authoritative existing CNAME before creating A records', async()=>{
  const {entities}=fixture([row('a')]);
  await assert.rejects(provisionRequestBundle(entities,row('a'),owner,'',async method=>{assert.equal(method,'GET');return {success:true,result:[{id:'old',type:'CNAME'}]};}),/CNAME/);
});
test('MCP hostname search covers all statuses and includes the complete conversation',async t=>{
  const {entities}=fixture([row('a'),row('b','CNAME','user_responded')],[{id:'reply',request_id:'b',request_type:'subdomain',message:'Answered'}]);bindStore(t,entities);
  t.mock.method(store,'searchRequests',async options=>{assert.equal(options.hostname,'site.example.com');assert.equal(options.offset,25);assert.equal(options.statuses,undefined);return [row('b','CNAME','user_responded')];});
  const result=(await callTool('get_review_request',{hostname:'SITE.example.com.',offset:25},{...owner,role:'staff'})).structuredContent;
  assert.equal(result.requests[0].records.length,2); assert.equal(result.requests[0].comments[0].message,'Answered');assert.equal(result.requests[0].status,'user_responded');
  await assert.rejects(callTool('get_review_request',{hostname:'site.example.com'},owner),/staff/);
});
test('MCP pagination exposes next_offset and rejects invalid bounds',async t=>{
  const {entities}=fixture([row('a'),row('b','TXT','approved')]);bindStore(t,entities);
  t.mock.method(store,'searchRequests',async options=>{assert.equal(options.limit,2);assert.equal(options.owner.id,owner.id);return [row('a'),row('b','TXT','approved')];});
  const result=(await callTool('list_my_requests',{limit:1},owner)).structuredContent;assert.equal(result.next_offset,1);
  await assert.rejects(callTool('list_my_requests',{limit:-1},owner),/limit/);
});

test('submission stores compatible records once and blocks a second open request', async t => {
  const {entities,data}=fixture([]);bindStore(t,entities);unlocked(t);
  data.Domain[0].allow_new_requests=true;
  const body={subdomain:'site',root_domain:'example.com',preview_link:'https://example.com',records:[row('a'),{...row('b','AAAA'),record_value:'2606:4700::1111'}]};
  const submitted=await submitRequest(request(body));
  assert.equal(submitted.status,200,JSON.stringify(await submitted.clone().json()));
  assert.equal(data.SubdomainRequest.length,1);
  assert.equal(data.SubdomainRequest[0].records.length,2);
  assert.equal((await submitted.json()).requests.length,1);
  for(const status of ['pending','needs_info','user_responded']) {
    data.SubdomainRequest[0].status=status;
    assert.equal((await submitRequest(request(body))).status,409);
  }
});
test('submission rejects A plus CNAME before any request is stored', async t => {
  const {entities,data}=fixture([]);bindStore(t,entities);
  const response=await submitRequest(request({subdomain:'site',root_domain:'example.com',preview_link:'https://example.com',records:[row('a'),row('b','CNAME')]}));
  assert.equal(response.status,400); assert.equal(data.SubdomainRequest.length,0);
});

test('a concurrent hostname operation returns retryable conflict without mutation', async t => {
  const {entities,data}=fixture([row('a')]);bindStore(t,entities);
  t.mock.method(pool,'connect',async()=>({query:async()=>({rows:[{locked:false}]}),release(){}}));
  const response=await postComment(request({request_id:'a',message:'Reply'}));
  assert.equal(response.status,409);assert.equal(data.RequestComment.length,0);
});
test('staff questions update every record even when email notifications are disabled', async t => {
  const {entities,data}=fixture([row('a'),row('b','TXT','user_responded')]);bindStore(t,entities);unlocked(t);
  const response=await postComment(request({request_id:'b',message:'Please clarify',message_type:'question',notify_user:false},{...owner,role:'staff'}));
  assert.equal(response.status,200);assert.ok(data.SubdomainRequest.every(row=>row.status==='needs_info'));
});

test('legacy public API cannot bypass bundle validation', async t => {
  const {entities,data}=fixture([]);bindStore(t,entities);
  data.User=[owner];data.ApiToken=[{id:'token',user_email:owner.email,token_hash:createHash('sha256').update('test-token').digest('hex')}];
  const response=await legacyApi(new Request('https://example.com/functions/publicApi',{method:'POST',headers:{Authorization:'Bearer test-token'},body:JSON.stringify({action:'submit',subdomain:'site',root_domain:'example.com',preview_link:'https://example.com',records:[row('a'),row('b','CNAME')]})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/CNAME/);assert.equal(data.SubdomainRequest.length,0);
});
