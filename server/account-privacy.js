const ACTIVE_SUBDOMAIN_STATUSES = new Set(['active', 'approved']);

function stripSecretFields(item = {}) {
  const clone = { ...item };
  for (const key of ['token_hash', 'token', 'secret', 'password_hash', 'totp_secret']) delete clone[key];
  return clone;
}

function safeSegment(value) {
  return String(value || 'account')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'account';
}

export function accountExportFileName(user, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `open-domains-data-${safeSegment(user?.email || user?.id)}-${date}.json`;
}

export function deletionRequiresManualReview(snapshot = {}) {
  return (snapshot.subdomains || []).some((subdomain) => {
    const status = String(subdomain.status || 'active').toLowerCase();
    return ACTIVE_SUBDOMAIN_STATUSES.has(status);
  });
}

export function publicAccountExport(user, snapshot = {}, now = new Date()) {
  const generatedAt = snapshot.generated_at || now.toISOString();
  return {
    export_type: 'open-domains-account-data',
    export_version: 1,
    generated_at: generatedAt,
    export_subject: {
      id: user?.id || snapshot.account?.id || null,
      email: user?.email || snapshot.account?.email || null,
    },
    data: {
      account: snapshot.account || {},
      subdomains: snapshot.subdomains || [],
      dns_records: snapshot.dns_records || [],
      requests: snapshot.requests || [],
      edit_requests: snapshot.edit_requests || [],
      request_comments: snapshot.request_comments || [],
      donations: snapshot.donations || [],
      abuse_reports: snapshot.abuse_reports || [],
      api_tokens: (snapshot.api_tokens || []).map(stripSecretFields),
      trusted_devices: (snapshot.trusted_devices || []).map(stripSecretFields),
    },
  };
}
