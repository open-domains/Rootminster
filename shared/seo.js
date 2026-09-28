const SITE_NAME = 'OpenDomains';
const DEFAULT_ORIGIN = 'https://open-domains.com';
const DEFAULT_DESCRIPTION = 'OpenDomains provides free, community-reviewed subdomains with DNS management, request tracking, abuse reporting, and API access.';
const DEFAULT_IMAGE = '/social-preview.png';

export const SEO_ROUTES = {
  '/': { title: 'Free subdomains with managed DNS', description: 'Request a free OpenDomains subdomain, manage DNS records, and keep your project online with a clear review workflow.' },
  '/how-it-works': { title: 'How OpenDomains works', description: 'See how subdomain requests, DNS provisioning, reviews, and account tools work from submission to launch.' },
  '/faq': { title: 'OpenDomains FAQ', description: 'Answers about eligibility, DNS records, reviews, ownership, abuse reports, donations, and account management.' },
  '/about': { title: 'About OpenDomains', description: 'Learn why OpenDomains exists and how Rootminster keeps free subdomains organized, reviewed, and maintainable.' },
  '/contact': { title: 'Contact OpenDomains', description: 'Contact the OpenDomains team for support, partnership questions, abuse concerns, and platform feedback.' },
  '/privacy-policy': { title: 'Privacy Policy', description: 'Read how OpenDomains handles account data, DNS records, analytics, requests, and operational logs.' },
  '/cookie-policy': { title: 'Cookie Policy', description: 'Understand which cookies OpenDomains uses for sessions, preferences, security, and optional analytics.' },
  '/terms-of-service': { title: 'Terms of Service', description: 'Review the rules for using OpenDomains, requesting subdomains, managing DNS, and keeping projects safe.' },
  '/report-abuse': { title: 'Report abuse', description: 'Report phishing, malware, spam, impersonation, policy violations, or other abuse on an OpenDomains subdomain.' },
  '/rdap': { title: 'RDAP lookup', description: 'Look up public registration and delegation information for domains using the OpenDomains RDAP utility.' },
  '/activate': { title: 'Activate a code', description: 'Redeem an activation code to unlock OpenDomains account features securely from the official OpenDomains site.', noindex: true },
  '/api-docs': { title: 'API documentation', description: 'Build against the OpenDomains API for requests, DNS records, analytics, dynamic DNS, and account data.' },
  '/guides': { title: 'DNS and hosting guides', description: 'Practical guides for DNS basics, records, hosting providers, SSL, and troubleshooting common domain issues.' },
  '/guides/dns-basics/what-is-dns': { title: 'What is DNS?', description: 'A clear explanation of DNS, nameservers, records, and how browsers find your website.' },
  '/guides/dns-basics/what-is-a-nameserver': { title: 'What is a nameserver?', description: 'Learn what nameservers do and how they connect your domain to authoritative DNS records.' },
  '/guides/dns-basics/dns-propagation': { title: 'DNS propagation explained', description: 'Understand DNS caching, TTLs, resolver delays, and how long record changes usually take to appear.' },
  '/guides/dns-record-types/a-record': { title: 'A records guide', description: 'Use A records to point a hostname at an IPv4 address safely and correctly.' },
  '/guides/dns-record-types/aaaa-record': { title: 'AAAA records guide', description: 'Use AAAA records to publish IPv6 addresses for your website or service.' },
  '/guides/dns-record-types/cname-record': { title: 'CNAME records guide', description: 'Use CNAME records to alias one hostname to another without breaking DNS compatibility.' },
  '/guides/dns-record-types/mx-record': { title: 'MX records guide', description: 'Configure MX records for email delivery, priorities, and mail provider verification.' },
  '/guides/dns-record-types/txt-record': { title: 'TXT records guide', description: 'Add TXT records for ownership verification, SPF, DKIM, DMARC, and service setup.' },
  '/guides/dns-record-types/ns-record': { title: 'NS records guide', description: 'Delegate a subdomain with NS records and understand when delegation is the right choice.' },
  '/guides/dns-record-types/srv-record': { title: 'SRV records guide', description: 'Publish SRV records for services that need priority, weight, port, and target information.' },
  '/guides/domain-management/point-domain-to-server': { title: 'Point a domain to a server', description: 'Connect a domain or subdomain to a VPS or hosting server using DNS records.' },
  '/guides/domain-management/connect-to-cloudflare': { title: 'Connect a domain to Cloudflare', description: 'Use Cloudflare with OpenDomains and understand proxying, records, and nameserver setup.' },
  '/guides/domain-management/subdomains-explained': { title: 'Subdomains explained', description: 'Learn how subdomains work and when to use them for apps, services, staging, and documentation.' },
  '/guides/domain-management/wildcard-dns': { title: 'Wildcard DNS guide', description: 'Understand wildcard records, where they help, and when explicit records are safer.' },
  '/guides/hosting-providers/cloudflare-pages': { title: 'Cloudflare Pages DNS setup', description: 'Connect an OpenDomains hostname to Cloudflare Pages with the right DNS records.' },
  '/guides/hosting-providers/vercel': { title: 'Vercel DNS setup', description: 'Connect your OpenDomains hostname to Vercel and avoid common CNAME and apex mistakes.' },
  '/guides/hosting-providers/netlify': { title: 'Netlify DNS setup', description: 'Point your OpenDomains hostname at a Netlify site and verify ownership correctly.' },
  '/guides/hosting-providers/github-pages': { title: 'GitHub Pages DNS setup', description: 'Publish a site on GitHub Pages using A, AAAA, and custom-domain records.' },
  '/guides/hosting-providers/vps-nginx': { title: 'VPS and Nginx DNS setup', description: 'Point DNS at a VPS and configure the basics for Nginx, SSL, and hostnames.' },
  '/guides/troubleshooting/dns-not-resolving': { title: 'Fix DNS not resolving', description: 'Troubleshoot missing DNS answers, wrong records, stale caches, and nameserver problems.' },
  '/guides/troubleshooting/ssl-issues': { title: 'Fix SSL issues', description: 'Diagnose certificate, HTTPS, Cloudflare proxy, and hosting-provider SSL problems.' },
  '/guides/troubleshooting/cloudflare-proxy-problems': { title: 'Cloudflare proxy troubleshooting', description: 'Fix common orange-cloud proxy issues, SSL modes, origin errors, and record conflicts.' },
  '/guides/troubleshooting/incorrect-records': { title: 'Fix incorrect DNS records', description: 'Find and correct bad DNS values, duplicate records, and incompatible CNAME setups.' },
  '/blog': { title: 'OpenDomains blog', description: 'Practical articles about DNS, hosting, security, subdomains, Cloudflare, and free website publishing.' },
  '/blog/how-to-set-up-a-website-for-free': { title: 'How to set up a website for free', description: 'A beginner-friendly path to launching a website with free hosting and DNS.' },
  '/blog/best-free-hosting-providers-2026': { title: 'Best free hosting providers', description: 'Compare free hosting options for small projects, portfolios, docs, and static sites.' },
  '/blog/common-dns-mistakes-beginners-make': { title: 'Common DNS mistakes beginners make', description: 'Avoid the DNS mistakes that break websites, email, verification, and SSL.' },
  '/blog/how-to-use-cloudflare-like-a-pro': { title: 'Use Cloudflare like a pro', description: 'Practical Cloudflare tips for DNS, proxying, caching, security, and reliability.' },
  '/blog/what-is-a-subdomain-and-why-use-one': { title: 'What is a subdomain?', description: 'Learn what subdomains are and why they are useful for apps, docs, staging, and personal projects.' },
  '/blog/free-vs-paid-hosting': { title: 'Free vs paid hosting', description: 'Understand when free hosting is enough and when paid infrastructure is worth it.' },
  '/blog/how-to-secure-your-domain': { title: 'How to secure your domain', description: 'Protect your domain and DNS with better account, email, SSL, and provider security habits.' },
  '/blog/understanding-ssl-certificates': { title: 'Understanding SSL certificates', description: 'Learn how SSL certificates work and how to avoid common HTTPS setup problems.' },
  '/blog/beginners-guide-to-web-hosting': { title: 'Beginner’s guide to web hosting', description: 'A straightforward guide to hosting types, DNS, SSL, and publishing your first site.' },
  '/blog/top-tools-for-managing-domains': { title: 'Top tools for managing domains', description: 'Useful tools for DNS lookup, propagation checks, SSL diagnostics, and domain management.' },
  '/login': { title: 'Sign in', description: 'Sign in to OpenDomains to manage subdomains, DNS records, requests, analytics, and account settings.', noindex: true },
  '/register': { title: 'Create an account', description: 'Create an OpenDomains account to request subdomains and manage DNS records.', noindex: true },
  '/forgot-password': { title: 'Reset access', description: 'Request a password reset link for your OpenDomains account.', noindex: true },
  '/reset-password': { title: 'Choose a new password', description: 'Set a new password for your OpenDomains account.', noindex: true },
  '/verify-email': { title: 'Verify email', description: 'Verify your OpenDomains account email address.', noindex: true },
  '/discord-link': { title: 'Connect Discord', description: 'Connect your OpenDomains account with Discord.', noindex: true },
  '/setup': { title: 'Initial setup', description: 'Complete the first administrator setup for this Rootminster installation.', noindex: true },
  '/user-dashboard': { title: 'User dashboard', description: 'View your OpenDomains account summary, active subdomains, and pending requests.', noindex: true },
  '/my-subdomains': { title: 'My subdomains', description: 'Manage your assigned OpenDomains subdomains and DNS records.', noindex: true },
  '/subdomain-dns-manager': { title: 'DNS manager', description: 'Edit DNS records for one of your OpenDomains subdomains.', noindex: true },
  '/my-requests': { title: 'My requests', description: 'Track your OpenDomains subdomain requests and review conversations.', noindex: true },
  '/analytics': { title: 'Analytics', description: 'View and configure analytics for eligible OpenDomains subdomains.', noindex: true },
  '/settings': { title: 'Account settings', description: 'Manage profile details, security settings, passkeys, two-factor authentication, and API tokens.', noindex: true },
  '/admin-dashboard': { title: 'Admin dashboard', description: 'Review Rootminster operations, platform health, and administrative activity.', noindex: true },
  '/admin-requests': { title: 'Request review queue', description: 'Review, approve, reject, and discuss OpenDomains subdomain requests.', noindex: true },
  '/admin-subdomains': { title: 'Admin DNS records', description: 'Inspect and manage Rootminster DNS records and ownership state.', noindex: true },
  '/admin-abuse-reports': { title: 'Abuse reports', description: 'Review submitted abuse reports and moderation follow-up.', noindex: true },
  '/admin-domains': { title: 'Root domains', description: 'Manage configured OpenDomains root domains and synchronization settings.', noindex: true },
  '/admin-users': { title: 'Users', description: 'Manage Rootminster user accounts, roles, status, and support actions.', noindex: true },
  '/admin-reports': { title: 'Reports', description: 'Generate administrative PDF reports from Rootminster data.', noindex: true },
  '/admin-audit-logs': { title: 'Audit logs', description: 'Review administrative and security-sensitive activity logs.', noindex: true },
  '/admin-email-logs': { title: 'Email logs', description: 'Inspect outbound email delivery history and failures.', noindex: true },
  '/admin-donations': { title: 'Donations', description: 'Review donation activity and related domain unlocks.', noindex: true },
  '/admin-settings': { title: 'Admin settings', description: 'Configure Rootminster platform settings, modules, and integrations.', noindex: true },
  '/admin-modules': { title: 'Modules', description: 'Configure optional Rootminster integrations and encrypted module settings.', noindex: true },
  '/docker-engine': { title: 'Docker engine', description: 'Manage approved Docker projects from the Rootminster administration panel.', noindex: true },
  '/admin-account-deletions': { title: 'Account deletion requests', description: 'Review and process account deletion requests.', noindex: true },
};

function normalizePath(pathname = '/') {
  const clean = String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return clean;
}

function pathTitle(pathname) {
  return normalizePath(pathname).split('/').filter(Boolean).map(part => part.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())).join(' · ') || 'Home';
}

export function absoluteUrl(path = '/', origin = DEFAULT_ORIGIN) {
  const base = String(origin || DEFAULT_ORIGIN).replace(/\/$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resolveSeo(pathname = '/', origin = DEFAULT_ORIGIN) {
  const path = normalizePath(pathname);
  const route = SEO_ROUTES[path] || {
    title: path === '*' ? 'Page not found' : pathTitle(path),
    description: 'Find your way around OpenDomains, browse DNS guides, or return to the dashboard.',
    noindex: path !== '/',
  };
  const fullTitle = route.title.includes(SITE_NAME) ? route.title : `${route.title} | ${SITE_NAME}`;
  const canonicalPath = route.canonical || path;
  return {
    ...route,
    path,
    siteName: SITE_NAME,
    title: fullTitle,
    shortTitle: route.title,
    description: route.description || DEFAULT_DESCRIPTION,
    canonical: absoluteUrl(canonicalPath, origin),
    image: absoluteUrl(route.image || DEFAULT_IMAGE, origin),
    type: path.startsWith('/blog/') ? 'article' : 'website',
    robots: route.noindex ? 'noindex, nofollow' : 'index, follow',
  };
}

export function publicSitemapEntries(origin = DEFAULT_ORIGIN) {
  return Object.entries(SEO_ROUTES)
    .filter(([, route]) => !route.noindex)
    .map(([path]) => ({ loc: absoluteUrl(path, origin), path }));
}
