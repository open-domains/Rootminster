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
  created_at timestamptz NOT NULL DEFAULT now()
);

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
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
