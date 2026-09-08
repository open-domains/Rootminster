CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text,
  full_name text,
  display_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'staff', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'disabled')),
  email_verified_at timestamptz,
  tos_accepted_at timestamptz,
  ns_unlocked boolean NOT NULL DEFAULT false,
  legacy_donor boolean NOT NULL DEFAULT false,
  disable_email_notifications boolean NOT NULL DEFAULT false,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip inet,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  mfa_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS discord_accounts (
  discord_user_id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  discord_username text,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discord_link_tokens (
  token_hash text PRIMARY KEY,
  discord_user_id text NOT NULL,
  discord_username text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_link_tokens_expiry_idx ON discord_link_tokens(expires_at);

CREATE TABLE IF NOT EXISTS discord_interactions (
  interaction_id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text,
  token_hash text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_verifications ALTER COLUMN code_hash DROP NOT NULL;
ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS token_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_token_idx ON email_verifications(token_hash) WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash text PRIMARY KEY,
  verifier text NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  return_to text NOT NULL DEFAULT '/user-dashboard',
  expires_at timestamptz NOT NULL
);

ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_version text;

CREATE TABLE IF NOT EXISTS terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_current boolean NOT NULL DEFAULT false,
  effective_at timestamptz,
  published_at timestamptz,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email citext,
  published_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by_email citext,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_current OR status = 'published')
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_versions_current_unique
  ON terms_versions(is_current) WHERE is_current;
CREATE INDEX IF NOT EXISTS terms_versions_published_idx
  ON terms_versions(published_at DESC) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version_id uuid NOT NULL REFERENCES terms_versions(id),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  UNIQUE(user_id, terms_version_id)
);

CREATE INDEX IF NOT EXISTS terms_acceptances_user_idx
  ON terms_acceptances(user_id, accepted_at DESC);

INSERT INTO terms_versions(version, title, summary, content, status, is_current, effective_at, published_at)
VALUES (
  '2026-08',
  'Terms of Service',
  'Open Domains is for lawful, non-commercial projects. Malicious use, phishing, spam, malware, gambling, adult content, impersonation and rights violations are prohibited.',
  $terms$## 1. Acceptance of Terms

By using Open Domains ("the Platform"), you agree to these Terms of Service. If you do not agree, do not use the Platform. We may update these terms at any time; continued use constitutes acceptance.

## 2. Eligibility

You must be at least 13 years old to use Open Domains. By using the Platform, you represent that you are legally capable of entering into a binding agreement. If you are under 18, you must have parental consent.

## 3. Acceptable Use

You may use Open Domains subdomains only for lawful purposes. You agree not to use any subdomain for:

- Adult or sexually explicit content of any kind
- Gambling or betting services of any kind
- Phishing, fraud, or deceptive practices
- Distributing malware, spyware, or ransomware
- Spam or unsolicited bulk communications
- Child sexual abuse material (CSAM) or any illegal content
- Hosting content that infringes intellectual property rights
- DDoS attacks, port scanning, or network abuse
- Impersonating other people, companies, or services
- Any activity that violates applicable laws

## 4. Subdomain Ownership and Approval

Subdomains are granted through a manual review process. Approval is at our sole discretion. We do not guarantee approval of any request. Approved subdomains remain the property of Open Domains — we grant you a revocable license to use them.

Open Domains reserves the right to delete, suspend, or revoke any domain or subdomain at any time, for any reason, and without prior notice or explanation. This includes but is not limited to violations of these Terms, abuse, inactivity, or any other reason at our sole discretion.

## 4a. Legal Responsibility

You accept full and sole legal responsibility for all content hosted under your subdomain. Open Domains bears no liability whatsoever for any content, claims, damages, fines, or legal proceedings arising from your use of the service or the content you host.

You agree to indemnify and hold harmless Open Domains, its operators, and affiliates from any claim, loss, liability, or expense (including legal fees) arising from your use of the Platform or violation of these Terms.

## 5. Non-Commercial Use and Fair Usage

Open Domains is provided exclusively for personal, educational, community, open-source, hobby, and other non-commercial projects. Commercial or business use is not permitted.

You must not use a subdomain for a business, company, paid service, revenue-generating project, client project, commercial promotion, advertising operation, online shop, or any other activity intended primarily for commercial gain.

You also agree not to abuse the service by hoarding subdomains, automating requests, or consuming disproportionate platform resources. We may reject, suspend, or revoke any subdomain that we reasonably believe is being used for a commercial or business purpose.

## 6. DNS Changes and Edits

All changes to DNS records require admin approval. You may not attempt to bypass the approval process. Any unauthorized or fraudulent attempts to modify DNS records will result in immediate account suspension.

## 7. Availability and Uptime

We provide the Platform "as is" and make no guarantees about uptime, availability, or continuity of service. DNS is provided through Cloudflare's infrastructure, which has its own terms and service levels. We are not liable for Cloudflare outages or changes to their service.

## 8. Termination

We may terminate or suspend your account and revoke all associated subdomains at any time, with or without notice, if you violate these Terms or for any other reason at our discretion. You may close your account at any time by contacting support.

## 9. Limitation of Liability

To the maximum extent permitted by law, Open Domains is not liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the Platform, including loss of data, revenue, or business. Your sole remedy for dissatisfaction is to stop using the Platform.

## 10. Governing Law

These Terms of Service are governed by and construed in accordance with the laws of England and Wales, United Kingdom. You agree to submit to the exclusive jurisdiction of the courts of England and Wales in respect of any dispute or claim arising out of or in connection with these Terms or your use of the Platform.

## 11. Contact

For questions about these Terms, contact us at hello@open-domains.net or through our [Contact page](/contact).$terms$,
  'published', true, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO terms_acceptances(user_id, terms_version_id, version, accepted_at)
SELECT users.id, terms_versions.id, terms_versions.version, users.tos_accepted_at
FROM users
JOIN terms_versions ON terms_versions.version = users.tos_accepted_version
WHERE users.tos_accepted_at IS NOT NULL
ON CONFLICT (user_id, terms_version_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL,
  redirect_uris jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  resource text,
  scope text NOT NULL DEFAULT 'rootminster',
  mfa_verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_codes ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS mcp_oauth_consents (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  request_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_consents_expiry_idx ON mcp_oauth_consents(expires_at);

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text NOT NULL UNIQUE,
  resource text,
  scope text NOT NULL DEFAULT 'rootminster',
  mfa_verified_at timestamptz,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_tokens ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_idx ON mcp_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_access_expiry_idx ON mcp_oauth_tokens(access_expires_at);

CREATE TABLE IF NOT EXISTS entity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email citext,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entity_records_type_created_idx ON entity_records(entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS entity_records_data_gin_idx ON entity_records USING gin(data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS entity_records_owner_idx ON entity_records(entity_type, (data->>'owner_id'));
CREATE INDEX IF NOT EXISTS entity_records_requester_idx ON entity_records(entity_type, (data->>'requester_id'));
CREATE INDEX IF NOT EXISTS entity_records_status_idx ON entity_records(entity_type, (data->>'status'));
CREATE INDEX IF NOT EXISTS entity_records_name_idx ON entity_records(entity_type, lower(data->>'name'));
CREATE INDEX IF NOT EXISTS entity_records_full_name_idx ON entity_records(entity_type, lower(data->>'full_name'));
CREATE INDEX IF NOT EXISTS entity_records_key_idx ON entity_records(entity_type, (data->>'key'));
CREATE UNIQUE INDEX IF NOT EXISTS domains_name_unique ON entity_records(lower(data->>'name')) WHERE entity_type = 'Domain';
CREATE UNIQUE INDEX IF NOT EXISTS platform_settings_key_unique ON entity_records((data->>'key')) WHERE entity_type = 'PlatformSettings';
CREATE UNIQUE INDEX IF NOT EXISTS cloudflare_record_unique ON entity_records((data->>'cloudflare_record_id'))
  WHERE entity_type = 'DnsRecord' AND data->>'cloudflare_record_id' IS NOT NULL AND data->>'cloudflare_record_id' <> '';

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger text NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'pre_restore')),
  provider text NOT NULL DEFAULT 'cloudflare_r2',
  file_name text NOT NULL,
  object_key text,
  size_bytes bigint,
  checksum_sha256 text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  verified_at timestamptz,
  deleted_at timestamptz,
  error_message text,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_email citext
);

ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS object_key text;
ALTER TABLE backup_runs ALTER COLUMN provider SET DEFAULT 'cloudflare_r2';

CREATE INDEX IF NOT EXISTS backup_runs_started_idx ON backup_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS backup_runs_status_idx ON backup_runs(status, completed_at DESC);

CREATE TABLE IF NOT EXISTS backup_usage_monthly (
  month_key text PRIMARY KEY,
  class_a_operations integer NOT NULL DEFAULT 0 CHECK (class_a_operations >= 0),
  class_b_operations integer NOT NULL DEFAULT 0 CHECK (class_b_operations >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The retired Google Drive integration stored OAuth credentials in module
-- settings. Remove those credentials and its short-lived authorization state
-- when upgrading an installation that tested the previous backup provider.
DELETE FROM entity_records
WHERE entity_type = 'PlatformSettings' AND data->>'key' = 'module:google_drive_backup';
DROP TABLE IF EXISTS backup_oauth_states;
