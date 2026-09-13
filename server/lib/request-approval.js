import { recordSetError, requestRecords, requestHostname, OPEN_REQUEST_STATUSES } from '../../shared/subdomain-requests.js';
import { requestBundle, ensureRequestGroup } from './request-bundles.js';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
export async function provisionRequestBundle(entities, target, user, adminNotes, cfFetch) {
  const bundle = await requestBundle(entities, target);
  if (!bundle._requests.some(row => OPEN_REQUEST_STATUSES.includes(row.status)) || !bundle._requests.every(row => OPEN_REQUEST_STATUSES.includes(row.status) || (row.status === 'approved' && requestRecords(row).every(record => record.cloudflare_record_id)))) fail('This request is no longer open.');
  const hostname = requestHostname(bundle);
  const records = bundle._records;
  const compatibility = recordSetError(records);
  if (compatibility) fail(compatibility);
  const domains = await entities.Domain.filter({ name: bundle.root_domain });
  if (!domains.length) fail('Domain not found', 404);
  const domain = domains[0];
  const ownerships = await entities.SubdomainOwnership.filter({ full_name: hostname });
  if (ownerships.some(row => row.owner_id ? row.owner_id !== bundle.requester_id : row.owner_email !== bundle.requester_email)) fail('This hostname belongs to another account.');
  // Read authoritative records before any write. Tags let retries recover a
  // successful Cloudflare write even if its local checkpoint was interrupted.
  const listed = await cfFetch('GET', `/zones/${domain.zone_id}/dns_records?name=${encodeURIComponent(hostname)}&per_page=100`);
  if (!listed.success || !Array.isArray(listed.result)) fail('Could not inspect existing Cloudflare records.', 502);
  if (Number(listed.result_info?.total_pages || 1) > 1) fail('Too many existing records for automatic approval. Review this hostname manually.');
  const tag = (id, index) => `Rootminster request ${id} record ${index}`;
  const tags = new Set(bundle._requests.flatMap(row => requestRecords(row).map((_, index) => tag(row.id, index))));
  const savedIds = new Set(records.map(record => record.cloudflare_record_id).filter(Boolean));
  const unrelated = listed.result.filter(record => !tags.has(record.comment) && !savedIds.has(record.id));
  const allTypes = [...records.map(record => record.record_type), ...unrelated.map(record => record.type)];
  if (allTypes.includes('CNAME') && allTypes.length > 1) fail('A CNAME cannot coexist with other records at this hostname. Resolve the conflict before approval.');
  if (allTypes.includes('NS') && allTypes.some(type => type !== 'NS')) fail('NS delegation cannot coexist with other record types at this hostname.');
  await ensureRequestGroup(entities, bundle);
  const dnsRecords = [];
  for (const row of bundle._requests) {
    const progress = requestRecords(row).map(record => ({ ...record }));
    for (let index = 0; index < progress.length; index++) {
      const record = progress[index];
      let content = record.record_value.trim();
      let priority;
      if (['CNAME', 'NS', 'MX'].includes(record.record_type)) content = content.replace(/\.$/, '');
      if (record.record_type === 'MX') {
        const match = content.match(/^(\d+)\s+(.+)$/);
        priority = match ? Number(match[1]) : 10;
        content = match ? match[2] : content;
      }
      const proxied = ['A', 'AAAA', 'CNAME'].includes(record.record_type) && !!record.proxied;
      let cfRecord = listed.result.find(item => item.id === record.cloudflare_record_id || item.comment === tag(row.id, index));
      if (record.cloudflare_record_id && !cfRecord) fail('A previously created record is missing from Cloudflare. Review it before retrying.');
      const comparable = value => record.record_type === 'TXT' ? String(value) : String(value).replace(/\.$/, '').toLowerCase();
      if (cfRecord && (cfRecord.type !== record.record_type || comparable(cfRecord.content) !== comparable(content) || (priority !== undefined && cfRecord.priority !== priority))) fail('A previously created record was changed in Cloudflare. Review it before retrying.');
      if (!cfRecord) {
        const response = await cfFetch('POST', `/zones/${domain.zone_id}/dns_records`, {type:record.record_type,name:hostname,content,ttl:record.ttl || 3600,proxied,...(priority !== undefined ? {priority} : {}),comment:tag(row.id,index)});
        if (!response.success) fail(response.errors?.[0]?.message || 'Cloudflare could not create a record. Retry approval to resume.', 502);
        cfRecord = response.result;
      }
      if (!cfRecord?.id) fail('Cloudflare returned an invalid record.', 502);
      record.cloudflare_record_id = cfRecord.id;
      await entities.SubdomainRequest.update(row.id, { records: progress, cloudflare_record_id: progress[0].cloudflare_record_id, dns_record_id: progress[0].dns_record_id });
      const existing = await entities.DnsRecord.filter({ cloudflare_record_id: cfRecord.id });
      const data = { zone_id:domain.zone_id,zone_name:row.root_domain,cloudflare_record_id:cfRecord.id,record_type:record.record_type,name:hostname,subdomain:row.subdomain,content,proxied,ttl:cfRecord.ttl || record.ttl || 3600,...(priority !== undefined ? {priority} : {}),managed:true,owner_email:row.requester_email,owner_id:row.requester_id,status:'active',last_synced:new Date().toISOString() };
      const dnsRecord = existing.length ? await entities.DnsRecord.update(existing[0].id,data) : await entities.DnsRecord.create(data);
      record.dns_record_id = dnsRecord.id;
      await entities.SubdomainRequest.update(row.id, { records: progress, cloudflare_record_id: progress[0].cloudflare_record_id, dns_record_id: progress[0].dns_record_id });
      dnsRecords.push(dnsRecord);
    }
  }
  const ownership = { full_name:hostname,subdomain:bundle.subdomain,root_domain:bundle.root_domain,zone_id:domain.zone_id,owner_email:bundle.requester_email,owner_id:bundle.requester_id,status:'active',suspended_at:null,suspension_reason:'',last_record_added_at:new Date().toISOString() };
  if (ownerships.length) await entities.SubdomainOwnership.update(ownerships[0].id,ownership);
  else await entities.SubdomainOwnership.create(ownership);
  for (const row of bundle._requests) await entities.SubdomainRequest.update(row.id,{status:'approved',reviewed_by:user.full_name || user.email,reviewed_at:new Date().toISOString(),admin_notes:adminNotes || ''});
  return { bundle, dnsRecords };
}
