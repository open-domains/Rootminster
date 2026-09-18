export const MODULE_CATEGORIES = {
  cloudflare: 'DNS', email: 'Email', google_oauth: 'Authentication', github_oauth: 'Authentication',
  r2_backup: 'Storage', glitchtip: 'Monitoring', analytics: 'Monitoring', discord: 'Integrations',
  donations: 'Payments', branding: 'Appearance', mcp: 'Integrations', turnstile: 'Security',
  phishing: 'Security', safety: 'Security', disposable_email: 'Security',
};

export function moduleCategory(module) {
  return MODULE_CATEGORIES[module.id] || 'Other';
}

// Configuration completeness is not a live provider health check.
export function moduleStatus(module) {
  if (!module.enabled) return { key: 'disabled', label: 'Disabled', missing: [] };
  const missing = module.fields.filter((field) => field.required && (field.type === 'secret'
    ? !field.configured
    : field.value == null || String(field.value).trim() === ''));
  return missing.length
    ? { key: 'attention', label: 'Needs attention', missing }
    : { key: 'configured', label: 'Configured', missing: [] };
}
