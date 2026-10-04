const TOPIC_LABELS = {
  dns: 'DNS',
  account: 'Account',
  request: 'Request review',
  billing: 'Donation / supporter access',
  other: 'Other',
};

function text(value, fallback = '') {
  return String(value || fallback).trim();
}

export function normalizeSupportSubdomainOptions(ownerships = []) {
  const domainOptions = ownerships
    .map((ownership) => {
      const fullName = text(ownership.full_name) || [ownership.subdomain, ownership.root_domain].filter(Boolean).join('.');
      if (!fullName) return null;
      return {
        value: fullName,
        label: fullName,
        rootDomain: ownership.root_domain || '',
        status: ownership.status || 'active',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    { value: 'account', label: 'My account / login', status: 'account' },
    ...domainOptions,
  ];
}

export function buildSupportChatTicket({ selectedSubdomain, topic, summary, details, user, path }) {
  const issueType = TOPIC_LABELS[topic] || TOPIC_LABELS.other;
  const cleanSummary = text(summary, 'Support request');
  const cleanDetails = text(details);
  const isAccountScoped = selectedSubdomain === 'account' || !selectedSubdomain;
  const targetLine = isAccountScoped
    ? 'Area: My account / login'
    : `Subdomain: ${selectedSubdomain}`;
  const subjectPrefix = isAccountScoped ? 'Account' : selectedSubdomain;

  return {
    category: topic === 'dns' ? 'dns' : topic === 'account' ? 'account' : 'general',
    subject: `${subjectPrefix}: ${cleanSummary}`.slice(0, 180),
    message: [
      targetLine,
      `Issue type: ${issueType}`,
      '',
      cleanDetails,
    ].filter(Boolean).join('\n'),
    context: {
      source: 'floating_support_chat',
      path: path || '/',
      selected_subdomain: selectedSubdomain || 'account',
      issue_type: issueType,
      user_id: user?.id || '',
      user_email: user?.email || '',
      user_role: user?.role || '',
    },
  };
}

export { TOPIC_LABELS };
