import { isOpenReport } from './abuse-reports.js';

// Opt-in public showcase of projects hosted on platform subdomains. Owners submit a
// listing, staff approve it, and the public page only ever sees the fields below.

export const MAX_TAGS = 5;
export const STATUSES = new Set(['pending', 'approved', 'rejected']);

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normaliseTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const tags = [];
  for (const raw of list) {
    const tag = clean(raw, 24).toLowerCase().replace(/[^a-z0-9 +#.-]/g, '').trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

// Validates an owner's submission. Returns { listing } or { error }.
export function validateListing(body = {}) {
  const title = clean(body.title, 60);
  const description = clean(body.description, 160);
  if (title.length < 2) return { error: 'Add a title of at least 2 characters.' };
  if (description.length < 10) return { error: 'Add a one-line description of at least 10 characters.' };
  if (/https?:\/\//i.test(`${title} ${description}`)) return { error: 'Leave links out of the title and description. The listing links to your subdomain.' };
  return { listing: { title, description, tags: normaliseTags(body.tags), show_owner: body.show_owner === true } };
}

// Why a listing should not be public right now, or null when it can be shown.
export function hiddenReason(entry, { ownership, openReportHosts = new Set() } = {}) {
  if (entry.status !== 'approved') return 'not_approved';
  if (entry.enabled === false) return 'owner_disabled';
  if (!ownership || ownership.status === 'suspended') return 'suspended';
  if (openReportHosts.has(entry.hostname)) return 'abuse_report';
  if (entry.health_status === 'warning') return 'health_check';
  return null;
}

export function publicListing(entry, owner) {
  return {
    hostname: entry.hostname,
    url: `https://${entry.hostname}`,
    title: entry.title,
    description: entry.description,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    owner: entry.show_owner && owner?.full_name ? clean(owner.full_name, 60) : null,
    listed_at: entry.approved_at || null,
  };
}

export function openReportHostSet(reports) {
  return new Set(reports.filter(isOpenReport).map((report) => report.normalized_host).filter(Boolean));
}
