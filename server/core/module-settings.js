import { config } from './config.js';
import { decryptSettingSecret, encryptSettingSecret } from './security.js';
import { store } from './store.js';

const MODULE_PREFIX = 'module_config:';
export const DEFAULT_TICKET_CATEGORIES = [
  'DNS help: What are you trying to set up? | Which records have you tried? | Any error messages or links?',
  'Request help: What do you need help with on your request? | Anything staff should know?',
  'Abuse report: Which site or subdomain is involved? | What is happening? | Links or evidence',
  'Account: What do you need help with? | When did the problem start?',
  'Other: How can we help?',
].join('\n');
const cache = new Map();
const CACHE_MS = 15_000;

export const MODULE_DEFINITIONS = Object.freeze({
  docker_engine: {
    name: 'Docker Engine', description: 'Monitor and control Docker Compose projects through the Hostinger VPS Docker Manager API.', defaultEnabled: false,
    fields: [
      { key: 'api_token', label: 'Hostinger API token', type: 'secret', required: true, description: 'Create a token in hPanel with access to the VPS containing these Docker projects.' },
      { key: 'virtual_machine_id', label: 'Virtual machine ID', type: 'text', required: true },
      { key: 'protected_projects', label: 'Additional protected projects', type: 'text', description: 'Comma-separated project names to hide and block. OpenDomains and Rootminster projects are always protected.' },
    ],
    env: () => ({
      enabled: Boolean(process.env.HOSTINGER_API_KEY && process.env.HOSTINGER_VIRTUAL_MACHINE_ID),
      api_token: process.env.HOSTINGER_API_KEY || '',
      virtual_machine_id: process.env.HOSTINGER_VIRTUAL_MACHINE_ID || '',
      protected_projects: process.env.HOSTINGER_PROTECTED_DOCKER_PROJECTS || '',
    }),
  },
  r2_backup: {
    name: 'Cloudflare R2 Backup', description: 'Encrypted PostgreSQL backups with strict free-tier storage and operation budgets.', defaultEnabled: false,
    fields: [
      { key: 'account_id', label: 'Cloudflare account ID', type: 'text', required: true },
      { key: 'bucket_name', label: 'R2 bucket name', type: 'text', required: true, description: 'Use a Standard storage bucket dedicated to Rootminster backups.' },
      { key: 'access_key_id', label: 'R2 access key ID', type: 'secret', required: true },
      { key: 'secret_access_key', label: 'R2 secret access key', type: 'secret', required: true },
      { key: 'path_prefix', label: 'Object path prefix', type: 'text', required: true },
      { key: 'frequency', label: 'Automatic backup frequency', type: 'select', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'manual', label: 'Manual only' }] },
      { key: 'backup_hour_utc', label: 'Backup hour (UTC)', type: 'number', min: 0, max: 23, step: 1 },
      { key: 'backup_weekday_utc', label: 'Weekly backup day', type: 'select', options: [{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' }, { value: '3', label: 'Wednesday' }, { value: '4', label: 'Thursday' }, { value: '5', label: 'Friday' }, { value: '6', label: 'Saturday' }] },
      { key: 'retention_count', label: 'Backups to retain', type: 'number', min: 1, max: 365, step: 1 },
      { key: 'max_storage_gb', label: 'Maximum backup storage (GB)', type: 'number', min: 1, max: 9, step: 0.1, description: 'Hard-capped at 9 GB to retain 10% free-tier headroom.' },
      { key: 'max_class_a_monthly', label: 'Monthly Class A operation limit', type: 'number', min: 1, max: 900000, step: 1 },
      { key: 'max_class_b_monthly', label: 'Monthly Class B operation limit', type: 'number', min: 1, max: 9000000, step: 1 },
      { key: 'notify_on_failure', label: 'Email the platform contact when a backup fails', type: 'boolean' },
    ],
    env: () => ({ enabled: false, account_id: '', bucket_name: '', access_key_id: '', secret_access_key: '', path_prefix: 'rootminster', frequency: 'daily', backup_hour_utc: 2, backup_weekday_utc: '0', retention_count: 30, max_storage_gb: 9, max_class_a_monthly: 900000, max_class_b_monthly: 9000000, notify_on_failure: true }),
  },
  observer: {
    name: 'Observer', description: 'Policy scanner integration for approved subdomains, findings and screenshot evidence.', defaultEnabled: false,
    fields: [
      { key: 'shared_secret', label: 'Observer shared secret', type: 'secret', required: true, description: 'Must match OBSERVER_SHARED_SECRET in Observer.' },
      { key: 'observer_url', label: 'Observer staff URL', type: 'url', required: true, description: 'Staff-facing Observer origin protected by Cloudflare Access.' },
      { key: 'observer_internal_url', label: 'Observer internal URL', type: 'url', required: true, description: 'Internal URL Rootminster uses to trigger Observer scans, for example http://observer:8080.' },
    ],
    env: () => {
      const observerUrl = process.env.OBSERVER_URL || 'https://observer.open-domains.com';
      return {
        enabled: Boolean(process.env.OBSERVER_SHARED_SECRET),
        shared_secret: process.env.OBSERVER_SHARED_SECRET || '',
        observer_url: observerUrl,
        observer_internal_url: process.env.OBSERVER_INTERNAL_URL || observerUrl,
      };
    },
  },
  instant_approval: {
    name: 'Instant approval', description: 'Approve low-risk subdomain requests automatically once Observer finds nothing, then keep re-scanning them and pull them back to review if Observer later flags serious abuse.', defaultEnabled: false,
    fields: [
      { key: 'allowed_record_types', label: 'Record types eligible for instant approval', type: 'text', required: true, description: 'Comma-separated. Requests with any other record type always go to staff review. NS and MX are excluded by default because Observer cannot see what they serve.' },
      { key: 'min_account_age_days', label: 'Minimum account age (days)', type: 'number', min: 0, max: 365, step: 1 },
      { key: 'max_per_account_per_day', label: 'Instant approvals per account per day', type: 'number', min: 1, max: 50, step: 1 },
      { key: 'max_per_day', label: 'Instant approvals per day (all accounts)', type: 'number', min: 1, max: 10000, step: 1, description: 'Once reached, further requests wait for staff review until the next UTC day.' },
      { key: 'recheck_minutes', label: 'First re-scan after approval (minutes)', type: 'number', min: 5, max: 1440, step: 1, description: 'Observer re-scans the live hostname after this delay, then daily.' },
      { key: 'monitoring_days', label: 'Monitoring period (days)', type: 'number', min: 1, max: 90, step: 1, description: 'How long instantly approved hostnames keep being re-scanned.' },
      { key: 'revoke_severity', label: 'Pull back to review at Observer severity', type: 'select', options: [{ value: 'critical', label: 'Critical only' }, { value: 'high', label: 'High or critical' }], description: 'Matching findings remove the DNS records and return the request to the staff queue.' },
    ],
    env: () => ({ enabled: false, allowed_record_types: 'A, AAAA, CNAME, TXT', min_account_age_days: 1, max_per_account_per_day: 1, max_per_day: 50, recheck_minutes: 30, monitoring_days: 14, revoke_severity: 'critical' }),
  },
  inactive_accounts: {
    name: 'Inactive account cleanup', description: 'Email accounts with no domains and no recent sign-in or activity, then close them if they stay inactive through a grace period. Any sign-in, including through a linked Google, GitHub or Discord account, cancels the closure.', defaultEnabled: false,
    fields: [
      { key: 'inactivity_days', label: 'Inactive after (days)', type: 'number', min: 30, max: 3650, step: 1, description: 'Accounts with no sign-in or other activity for this long, and no subdomains, DNS records, open requests or donations, get a notice.' },
      { key: 'grace_days', label: 'Grace period after notice (days)', type: 'number', min: 7, max: 365, step: 1, description: 'The account is closed this long after the notice unless the user signs in or is otherwise active again.' },
      { key: 'reminder_days', label: 'Reminder before closure (days)', type: 'number', min: 0, max: 30, step: 1, description: 'Send one reminder this many days before closure. Set to 0 for no reminder.' },
      { key: 'closure_action', label: 'When an account is closed', type: 'select', options: [{ value: 'delete', label: 'Delete the account and its data' }, { value: 'disable', label: 'Disable the account (reversible)' }] },
      { key: 'max_notices_per_run', label: 'Notices per daily run', type: 'number', min: 1, max: 1000, step: 1, description: 'Caps how many accounts are notified each day, so enabling this on a large backlog ramps up gradually.' },
      { key: 'max_closures_per_run', label: 'Closures per daily run', type: 'number', min: 1, max: 1000, step: 1 },
    ],
    env: () => ({ enabled: false, inactivity_days: 365, grace_days: 30, reminder_days: 7, closure_action: 'delete', max_notices_per_run: 100, max_closures_per_run: 50 }),
  },
  threat_intel: {
    name: 'Threat intelligence', description: 'Check live subdomains and new requests against Google Safe Browsing and public malware and phishing feeds. Matches open an abuse report for staff; nothing is suspended automatically.', defaultEnabled: false,
    fields: [
      { key: 'safe_browsing_api_key', label: 'Google Safe Browsing API key', type: 'secret', description: 'Optional. Safe Browsing Lookup API v4 key from Google Cloud. The free API is for non-commercial use.' },
      { key: 'feed_urlhaus', label: 'Import the URLhaus malware host list', type: 'boolean' },
      { key: 'feed_openphish', label: 'Import the OpenPhish phishing feed', type: 'boolean' },
      { key: 'block_feed_targets', label: 'Refuse new DNS records that point at a listed hostname', type: 'boolean', description: 'Applies to CNAME, MX, NS and SRV targets. Listed IP addresses are only flagged, since many sites share hosting IPs. Shared hosts such as github.io are never blocked as a whole.' },
      { key: 'feed_expiry_days', label: 'Drop feed entries not seen for (days)', type: 'number', min: 1, max: 90, step: 1 },
      { key: 'ignored_hosts', label: 'Hosts to ignore', type: 'text', description: 'Comma-separated hostnames or IPs that feeds list wrongly. They are never flagged or blocked.' },
      { key: 'notify_staff', label: 'Email staff a summary of new matches', type: 'boolean' },
    ],
    env: () => ({ enabled: false, safe_browsing_api_key: process.env.SAFE_BROWSING_API_KEY || '', feed_urlhaus: true, feed_openphish: true, block_feed_targets: true, feed_expiry_days: 7, ignored_hosts: '', notify_staff: true }),
  },
  glitchtip: {
    name: 'GlitchTip monitoring', description: 'Optional privacy-conscious browser and server error reporting with browser performance traces.', defaultEnabled: false,
    fields: [
      { key: 'dsn', label: 'Project DSN (public ingestion key)', type: 'url', required: true },
      { key: 'environment', label: 'Environment name', type: 'text', required: true },
      { key: 'error_sample_rate', label: 'Error sample rate', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'trace_sample_rate', label: 'Performance trace sample rate', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
    env: () => ({ enabled: false, dsn: '', environment: config.production ? 'production' : 'development', error_sample_rate: 1, trace_sample_rate: 0 }),
  },
  disposable_email: {
    name: 'Disposable Email Detection', description: 'Block registrations from known temporary email services and administrator-supplied domains.', defaultEnabled: false,
    fields: [
      { key: 'source_url', label: 'Disposable domain source URL', type: 'url', required: true },
      { key: 'additional_domains', label: 'Additional blocked domains (comma separated)', type: 'text' },
    ],
    env: () => ({ enabled: false, source_url: 'https://raw.githubusercontent.com/eramitgupta/disposable-email/refs/heads/main/disposable_email.json', additional_domains: '' }),
  },
  branding: {
    name: 'Branding Manager', description: 'Customize the platform name, logo, accent color and support link.', defaultEnabled: false,
    fields: [
      { key: 'platform_name', label: 'Platform name', type: 'text', required: true },
      { key: 'short_name', label: 'Short name', type: 'text', required: true },
      { key: 'logo_url', label: 'Logo URL', type: 'url', required: true },
      { key: 'primary_color', label: 'Primary color (hex)', type: 'text', required: true },
      { key: 'support_url', label: 'Support URL', type: 'url' },
    ],
    env: () => ({ enabled: false, platform_name: 'Open Domains', short_name: 'OpenDomains', logo_url: '/open-domains-icon.png', primary_color: '#2563eb', support_url: '/contact' }),
  },
  cloudflare: {
    name: 'Cloudflare DNS', description: 'Cloudflare zones, DNS records and synchronisation.', defaultEnabled: true,
    fields: [
      { key: 'api_token', label: 'API token', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.cloudflareToken), api_token: config.cloudflareToken }),
  },
  email: {
    name: 'Email', description: 'SMTP delivery for verification links, password resets and status updates.', defaultEnabled: true,
    fields: [
      { key: 'host', label: 'SMTP host', type: 'text', required: true },
      { key: 'port', label: 'SMTP port', type: 'number', required: true },
      { key: 'secure', label: 'Use implicit TLS', type: 'boolean' },
      { key: 'user', label: 'SMTP username', type: 'text' },
      { key: 'password', label: 'SMTP password', type: 'secret' },
      { key: 'from', label: 'From address', type: 'text', required: true },
      { key: 'contact_email', label: 'Contact recipient', type: 'text', required: true },
      { key: 'require_verification', label: 'Require email verification for registration', type: 'boolean' },
    ],
    env: () => ({ enabled: Boolean(config.smtp.host), ...config.smtp, contact_email: config.contactEmail, require_verification: config.emailVerificationRequired }),
  },
  hostinger_mail: {
    name: 'Hostinger Mail', description: 'Send verification links, password resets and status updates through the Hostinger Mail API instead of SMTP.', defaultEnabled: false,
    fields: [
      { key: 'api_token', label: 'Hostinger Mail API token', type: 'secret', required: true, description: 'Create a Mail API token in hPanel for the email order that holds the sending mailbox.' },
      { key: 'mailbox_resource_id', label: 'Mailbox resource ID', type: 'text', description: 'Leave blank when the token manages a single mailbox; it is filled in on save.' },
      { key: 'display_name', label: 'Sender display name', type: 'text', description: 'Shown next to the mailbox address. Defaults to the name in the Email module From address.' },
    ],
    env: () => ({
      enabled: Boolean(process.env.HOSTINGER_MAIL_API_TOKEN),
      api_token: process.env.HOSTINGER_MAIL_API_TOKEN || '',
      mailbox_resource_id: process.env.HOSTINGER_MAIL_MAILBOX_ID || '',
      display_name: process.env.HOSTINGER_MAIL_DISPLAY_NAME || '',
    }),
  },
  turnstile: {
    name: 'Cloudflare Turnstile', description: 'Bot protection for public registration and request forms.', defaultEnabled: false,
    fields: [
      { key: 'site_key', label: 'Site key', type: 'text', required: true },
      { key: 'secret_key', label: 'Secret key', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.turnstileSiteKey && config.turnstileSecret), site_key: config.turnstileSiteKey, secret_key: config.turnstileSecret }),
  },
  donations: {
    name: 'Donations and Stripe', description: 'Stripe donations and donation-gated NS records.', defaultEnabled: false,
    fields: [
      { key: 'secret_key', label: 'Stripe secret key', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Stripe webhook secret', type: 'secret', required: true },
    ],
    env: () => ({ enabled: config.donationsEnabled, secret_key: config.stripeSecret, webhook_secret: config.stripeWebhookSecret }),
  },
  google_oauth: {
    name: 'Google OAuth', description: 'Allow users to register and sign in with Google.', defaultEnabled: false,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.googleClientId && config.googleClientSecret), client_id: config.googleClientId, client_secret: config.googleClientSecret }),
  },
  github_oauth: {
    name: 'GitHub OAuth', description: 'Allow users to register and sign in with GitHub.', defaultEnabled: false,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'secret', required: true },
      { key: 'registry_url', label: 'Migration registry URL', type: 'url' },
    ],
    env: () => ({ enabled: Boolean(config.githubClientId && config.githubClientSecret), client_id: config.githubClientId, client_secret: config.githubClientSecret, registry_url: config.githubRegistryUrl }),
  },
  discord_oauth: {
    name: 'Discord OAuth', description: 'Allow users to register, sign in and link their account with Discord.', defaultEnabled: false,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.discordClientId && config.discordClientSecret), client_id: config.discordClientId, client_secret: config.discordClientSecret }),
  },
  discord: {
    name: 'Discord bot', description: 'Signed slash commands for users and staff request management.', defaultEnabled: false,
    fields: [
      { key: 'application_id', label: 'Application ID', type: 'text', required: true },
      { key: 'public_key', label: 'Public key', type: 'secret', required: true },
      { key: 'bot_token', label: 'Bot token', type: 'secret', required: true },
      { key: 'guild_id', label: 'Development guild ID', type: 'text' },
    ],
    env: () => ({ enabled: config.discordBot.enabled, application_id: config.discordBot.applicationId, public_key: config.discordBot.publicKey, bot_token: config.discordBot.token, guild_id: config.discordBot.guildId }),
  },
  discord_tickets: {
    name: 'Discord tickets', description: 'Support tickets in Discord with intake questions and subdomain selection from the linked Rootminster account. Needs the Discord bot module.', defaultEnabled: false,
    fields: [
      { key: 'open_category_id', label: 'Open tickets category ID', type: 'text', required: true, description: 'Each ticket gets its own private channel in this category. The bot needs Manage Channels, Manage Roles, View Channel, Send Messages, Read Message History and Embed Links on it.' },
      { key: 'closed_category_id', label: 'Closed tickets category ID', type: 'text', required: true, description: 'Closed ticket channels move here and become read-only for staff. The ticket opener loses access. A category holds at most 50 channels, so set an automatic delete below.' },
      { key: 'staff_role_id', label: 'Staff role ID', type: 'text', description: 'Can see and reply in every open ticket, and is pinged when one opens.' },
      { key: 'transcript_channel_id', label: 'Transcript log channel ID', type: 'text', description: 'Optional staff-only channel that receives a transcript file when a ticket closes. Transcripts are always kept on the Tickets page.' },
      { key: 'delete_closed_after_days', label: 'Delete closed ticket channels after (days)', type: 'number', min: 0, max: 365, step: 1, description: '0 keeps closed channels. The saved transcript is kept either way.' },
      { key: 'max_open_tickets', label: 'Open tickets per user', type: 'number', min: 1, max: 10, step: 1 },
      { key: 'categories', label: 'Categories and questions', type: 'textarea', description: 'One category per line: "Name: first question | second question". Up to 10 categories and 5 questions each; questions are cut to 45 characters.' },
    ],
    env: () => ({ enabled: false, open_category_id: '', closed_category_id: '', staff_role_id: '', transcript_channel_id: '', delete_closed_after_days: 14, max_open_tickets: 3, categories: DEFAULT_TICKET_CATEGORIES }),
  },
  mcp: {
    name: 'MCP server', description: 'Role-aware ChatGPT and Claude account tools.', defaultEnabled: true,
    fields: [], env: () => ({ enabled: config.mcpEnabled }),
  },
  analytics: {
    name: 'Umami analytics', description: 'Per-subdomain analytics dashboards.', defaultEnabled: false,
    fields: [
      { key: 'base_url', label: 'Umami base URL', type: 'url', required: true },
      { key: 'api_endpoint', label: 'API endpoint', type: 'url' },
      { key: 'user_id', label: 'API user ID', type: 'text' },
      { key: 'api_secret', label: 'API client secret', type: 'secret' },
      { key: 'website_id', label: 'Website ID', type: 'text' },
    ],
    env: () => ({ enabled: Boolean(process.env.UMAMI_URL || process.env.UMAMI_API_URL), base_url: process.env.UMAMI_URL || process.env.UMAMI_BASE_URL || config.umami.apiUrl, api_endpoint: process.env.UMAMI_API_CLIENT_ENDPOINT || '', user_id: process.env.UMAMI_API_CLIENT_USER_ID || process.env.UMAMI_USER_ID || config.umami.username, api_secret: process.env.UMAMI_API_CLIENT_SECRET || process.env.UMAMI_APP_SECRET || config.umami.password, website_id: process.env.UMAMI_WEBSITE_ID || config.umami.websiteId }),
  },
  design: {
    name: 'Design by Open-Domains', description: 'Rootminster authorization, GitHub publishing and Open-Domains DNS for the Design site builder.', defaultEnabled: false,
    fields: [
      { key: 'base_url', label: 'Design base URL', type: 'url', required: true, description: 'The public Design origin. Production should use https://design.open-domains.com.' },
      { key: 'service_secret', label: 'Design service secret', type: 'secret', required: true, description: 'Use the same secret as ROOTMINSTER_CLIENT_SECRET in the Design service.' },
      { key: 'admins_only', label: 'Only allow Rootminster administrators', type: 'boolean', description: 'Keep this enabled while Design is being tested.' },
      { key: 'github_client_id', label: 'GitHub OAuth client ID', type: 'text', required: true },
      { key: 'github_client_secret', label: 'GitHub OAuth client secret', type: 'secret', required: true },
      { key: 'repository_visibility', label: 'Generated repository visibility', type: 'select', options: [{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }] },
    ],
    env: () => ({
      enabled: false,
      base_url: 'https://design.open-domains.com',
      service_secret: '',
      admins_only: true,
      github_client_id: '',
      github_client_secret: '',
      repository_visibility: 'public',
    }),
  },
});

function secretKeys(definition) {
  return new Set(definition.fields.filter((field) => field.type === 'secret').map((field) => field.key));
}

function normaliseField(field, value) {
  if (field.type === 'boolean') return value === true || value === 'true';
  if (field.type === 'number') {
    const minimum = Number.isFinite(field.min) ? field.min : 0;
    const maximum = Number.isFinite(field.max) ? field.max : 10_000_000;
    return Math.max(minimum, Math.min(Number(value) || 0, maximum));
  }
  if (field.type === 'select') {
    const selected = String(value ?? '');
    return field.options?.some((option) => option.value === selected) ? selected : String(field.options?.[0]?.value || '');
  }
  return String(value ?? '').trim().slice(0, field.type === 'secret' ? 10_000 : field.type === 'textarea' ? 5_000 : 2_000);
}

async function storedModule(id) {
  const rows = await store.filter('PlatformSettings', { key: `${MODULE_PREFIX}${id}` }, '-created_date', 1);
  if (!rows[0]?.value) return null;
  try { return { record: rows[0], value: JSON.parse(rows[0].value) }; } catch { return null; }
}

export async function getModuleConfig(id, { fresh = false } = {}) {
  const definition = MODULE_DEFINITIONS[id];
  if (!definition) throw Object.assign(new Error('Unknown module'), { status: 404 });
  const cached = cache.get(id);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const stored = await storedModule(id);
  const environment = definition.env();
  const source = stored ? stored.value : environment;
  const secrets = secretKeys(definition);
  const value = { enabled: source.enabled ?? definition.defaultEnabled };
  for (const field of definition.fields) {
    const raw = source[field.key];
    if (secrets.has(field.key) && String(raw || '').startsWith('enc:v1:')) {
      try {
        value[field.key] = decryptSettingSecret(raw);
      } catch (error) {
        // During upgrades an encrypted database setting can outlive the bootstrap
        // key in one process. Keep legacy ENV credentials usable as a recovery
        // path, but only for the explicit "key missing" case. Authentication
        // failures from a changed/wrong key must still surface.
        if (error?.status === 503 && environment[field.key]) value[field.key] = normaliseField(field, environment[field.key]);
        else throw error;
      }
    } else {
      value[field.key] = normaliseField(field, raw);
    }
  }
  cache.set(id, { at: Date.now(), value });
  return value;
}

export async function saveModule(id, input, actor, { importEnvironment = false } = {}) {
  const definition = MODULE_DEFINITIONS[id];
  if (!definition) throw Object.assign(new Error('Unknown module'), { status: 404 });
  const existing = await storedModule(id);
  const current = existing?.value || {};
  const environment = definition.env();
  const secrets = secretKeys(definition);
  const output = { enabled: input.enabled ?? current.enabled ?? environment.enabled ?? definition.defaultEnabled };
  for (const field of definition.fields) {
    let supplied = importEnvironment ? environment[field.key] : input.settings?.[field.key];
    if (secrets.has(field.key)) {
      if (input.clear_secrets?.includes(field.key)) supplied = '';
      if (supplied === undefined || supplied === '') {
        output[field.key] = current[field.key] || (environment[field.key] ? encryptSettingSecret(environment[field.key]) : '');
      } else output[field.key] = encryptSettingSecret(normaliseField(field, supplied));
    } else {
      output[field.key] = normaliseField(field, supplied === undefined ? (current[field.key] ?? environment[field.key]) : supplied);
    }
  }
  if (output.enabled) {
    const missing = definition.fields.filter((field) => field.required && !output[field.key]).map((field) => field.label);
    if (missing.length) throw Object.assign(new Error(`Configure ${missing.join(', ')} before enabling ${definition.name}`), { status: 400 });
  }
  if (id === 'glitchtip' && output.enabled) {
    const { buildEnvelopeEndpoint } = await import('../integrations/glitchtip.js');
    buildEnvelopeEndpoint(output.dsn);
  }
  if (id === 'hostinger_mail' && output.enabled) {
    const { resolveHostingerMailbox } = await import('../integrations/hostinger-mail.js');
    const mailbox = await resolveHostingerMailbox({ ...output, api_token: decryptSettingSecret(output.api_token) });
    output.mailbox_resource_id = mailbox.resourceId;
  }
  if (id === 'r2_backup' && output.enabled) {
    const { validateR2Settings } = await import('../lib/backup-service.js');
    validateR2Settings(output);
  }
  const data = { key: `${MODULE_PREFIX}${id}`, value: JSON.stringify(output), description: `${definition.name} module configuration` };
  if (existing?.record) await store.update('PlatformSettings', existing.record.id, data);
  else await store.create('PlatformSettings', data, actor);
  cache.delete(id);
  return getModuleConfig(id, { fresh: true });
}

function adminView(id, definition, runtime, stored) {
  const secrets = secretKeys(definition);
  return {
    id, name: definition.name, description: definition.description, enabled: Boolean(runtime.enabled),
    source: stored ? 'database' : 'environment',
    fields: definition.fields.filter((field) => !field.internal).map((field) => ({
      ...field,
      value: secrets.has(field.key) ? '' : runtime[field.key],
      configured: secrets.has(field.key) ? Boolean(runtime[field.key]) : undefined,
    })),
  };
}

export async function registerModuleSettingsRoutes(app) {
  app.get('/api/admin/modules', async (request, reply) => {
    const { authenticateRequest } = await import('../routes/auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    const modules = await Promise.all(Object.entries(MODULE_DEFINITIONS).map(async ([id, definition]) => {
      const [runtime, stored] = await Promise.all([getModuleConfig(id, { fresh: true }), storedModule(id)]);
      return adminView(id, definition, runtime, stored);
    }));
    return { modules, encryption_configured: Boolean(process.env.MODULE_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY) };
  });

  app.get('/api/admin/modules/inactive_accounts/notices', async (request, reply) => {
    const { authenticateRequest } = await import('../routes/auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    const [{ pool }, { inactivitySettings, listInactiveAccountNotices }] = await Promise.all([import('./database.js'), import('../lib/inactive-accounts.js')]);
    const settings = inactivitySettings(await getModuleConfig('inactive_accounts', { fresh: true }));
    return { settings, notices: await listInactiveAccountNotices(pool, settings) };
  });

  app.put('/api/admin/modules/:id', async (request, reply) => {
    const { authenticateRequest } = await import('../routes/auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    try {
      const runtime = await saveModule(request.params.id, request.body || {}, actor);
      if (request.params.id === 'glitchtip') {
        const { configureServerGlitchTip } = await import('../integrations/glitchtip.js');
        await configureServerGlitchTip(runtime);
      }
      await store.create('AuditLog', { actor_email: actor.email, actor_role: actor.role, action: 'module_configuration_updated', entity_type: 'PlatformSettings', description: `${MODULE_DEFINITIONS[request.params.id].name} module updated; enabled=${runtime.enabled}` }, actor);
      return { module: adminView(request.params.id, MODULE_DEFINITIONS[request.params.id], runtime, true) };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/admin/modules/import-environment', async (request, reply) => {
    const { authenticateRequest } = await import('../routes/auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    if (!process.env.MODULE_ENCRYPTION_KEY && !process.env.TOTP_ENCRYPTION_KEY) return reply.code(503).send({ error: 'Configure MODULE_ENCRYPTION_KEY before importing secrets' });
    await Promise.all(Object.keys(MODULE_DEFINITIONS).map((id) => saveModule(id, {}, actor, { importEnvironment: true })));
    await store.create('AuditLog', { actor_email: actor.email, actor_role: actor.role, action: 'module_environment_imported', entity_type: 'PlatformSettings', description: 'Imported optional module configuration from environment variables into encrypted database settings' }, actor);
    return { success: true };
  });
}
