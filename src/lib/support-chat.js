export const WAIT_TIME_REPLY = "OpenDomains is run entirely by volunteers, so how long a review or reply takes depends on volunteer availability. Your request is still in the queue and keeps its place. Opening a ticket won't make it faster. You can check its status any time under Requests.";

const ANYTHING_ELSE = {
  id: 'extra',
  prompt: 'Anything else we should know? Links, screenshots or what you have already tried all help.',
  optional: true,
};

export const SUPPORT_TOPICS = [
  {
    id: 'wait_time',
    label: 'My request is taking a long time',
    category: 'general',
    noTicket: true,
    questions: [],
  },
  {
    id: 'dns',
    label: 'DNS records not working',
    category: 'dns',
    questions: [
      { id: 'record', prompt: 'Which record is affected, and what value did you set? (e.g. CNAME → you.github.io)' },
      { id: 'when', prompt: 'When did you make the change?' },
      { id: 'symptom', prompt: 'What happens when you visit or look up the domain? Include any error message.' },
      ANYTHING_ELSE,
    ],
  },
  {
    id: 'ssl',
    label: 'SSL / HTTPS error',
    category: 'dns',
    questions: [
      { id: 'error', prompt: 'What error does your browser show? Copy the exact text if you can.' },
      { id: 'host', prompt: 'Where is the site hosted? (e.g. GitHub Pages, Vercel, your own server)' },
      ANYTHING_ELSE,
    ],
  },
  {
    id: 'request',
    label: 'Problem with a request (rejected or needs info)',
    category: 'general',
    questions: [
      { id: 'what', prompt: 'What happened with your request, and what do you need from us?' },
      ANYTHING_ELSE,
    ],
  },
  {
    id: 'account',
    label: 'Account or login',
    category: 'account',
    questions: [
      { id: 'goal', prompt: 'What are you trying to do?' },
      { id: 'error', prompt: 'What happens instead? Include any error message.' },
      ANYTHING_ELSE,
    ],
  },
  {
    id: 'other',
    label: 'Something else',
    category: 'general',
    questions: [
      { id: 'what', prompt: 'Describe the issue in a sentence or two.' },
      ANYTHING_ELSE,
    ],
  },
];

export function getTopic(id) {
  return SUPPORT_TOPICS.find(topic => topic.id === id) || SUPPORT_TOPICS.find(topic => topic.id === 'other');
}

const WAIT_TIME_PATTERNS = [
  /\bhow long\b/i,
  /\bwait(ing)?\s*time\b/i,
  /\btaking (so |too |a )?long\b/i,
  /\b(been|still|stuck)\s+(\w+\s+)?pending\b/i,
  /\bpending for\b/i,
  /\bwhen will\b.*\b(review|approv|accept|process)/i,
  /\b(has ?n[o']?t|not|never)\s+(been\s+|yet\s+)?(reviewed|approved|accepted|processed)\b/i,
  /\bspeed (it |this |my request )?up\b/i,
  /\b(hurry|expedite)\b/i,
  /\b(review|approval)\s+times?\b/i,
];

export function isWaitTimeQuestion(value) {
  const input = String(value || '').trim();
  if (!input) return false;
  return WAIT_TIME_PATTERNS.some(pattern => pattern.test(input));
}

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

export function buildSupportChatTicket({ selectedSubdomain, topic, answers = [], user, path }) {
  const topicDef = getTopic(topic);
  if (topicDef.noTicket) throw new Error(`Topic "${topicDef.id}" does not open a ticket`);

  const isAccountScoped = selectedSubdomain === 'account' || !selectedSubdomain;
  const targetLine = isAccountScoped ? 'Area: My account / login' : `Subdomain: ${selectedSubdomain}`;
  const subjectPrefix = isAccountScoped ? 'Account' : selectedSubdomain;
  const answered = answers.filter(entry => text(entry?.answer));

  return {
    category: topicDef.category,
    subject: `${subjectPrefix}: ${topicDef.label}`.slice(0, 180),
    message: [
      targetLine,
      `Issue type: ${topicDef.label}`,
      ...answered.map(entry => `\n${text(entry.question)}\n${text(entry.answer)}`),
    ].join('\n'),
    context: {
      source: 'floating_support_chat',
      path: path || '/',
      selected_subdomain: selectedSubdomain || 'account',
      issue_type: topicDef.label,
      user_id: user?.id || '',
      user_email: user?.email || '',
      user_role: user?.role || '',
    },
  };
}
