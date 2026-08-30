import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PublicNav, PublicFooter, AdSenseBanner } from './PublicPageLayout';

const GUIDE_NAV = [
  {
    category: 'DNS Basics',
    slug: 'dns-basics',
    items: [
      { title: 'What is DNS?', slug: 'what-is-dns' },
      { title: 'What is a Nameserver?', slug: 'what-is-a-nameserver' },
      { title: 'DNS Propagation Explained', slug: 'dns-propagation' },
    ],
  },
  {
    category: 'DNS Record Types',
    slug: 'dns-record-types',
    items: [
      { title: 'A Record (IPv4)', slug: 'a-record' },
      { title: 'AAAA Record (IPv6)', slug: 'aaaa-record' },
      { title: 'CNAME Record', slug: 'cname-record' },
      { title: 'MX Record', slug: 'mx-record' },
      { title: 'TXT Record', slug: 'txt-record' },
      { title: 'NS Record', slug: 'ns-record' },
      { title: 'SRV Record', slug: 'srv-record' },
    ],
  },
  {
    category: 'Domain Management',
    slug: 'domain-management',
    items: [
      { title: 'Point a Domain to a Server', slug: 'point-domain-to-server' },
      { title: 'Connect a Domain to Cloudflare', slug: 'connect-to-cloudflare' },
      { title: 'Subdomains Explained', slug: 'subdomains-explained' },
      { title: 'Wildcard DNS', slug: 'wildcard-dns' },
    ],
  },
  {
    category: 'Hosting Providers',
    slug: 'hosting-providers',
    items: [
      { title: 'Cloudflare Pages', slug: 'cloudflare-pages' },
      { title: 'Vercel', slug: 'vercel' },
      { title: 'Netlify', slug: 'netlify' },
      { title: 'GitHub Pages', slug: 'github-pages' },
      { title: 'VPS with NGINX', slug: 'vps-nginx' },
    ],
  },
  {
    category: 'Troubleshooting',
    slug: 'troubleshooting',
    items: [
      { title: 'DNS Not Resolving', slug: 'dns-not-resolving' },
      { title: 'SSL Certificate Issues', slug: 'ssl-issues' },
      { title: 'Cloudflare Proxy Problems', slug: 'cloudflare-proxy-problems' },
      { title: 'Incorrect DNS Records', slug: 'incorrect-records' },
    ],
  },
];

export { GUIDE_NAV };

export default function GuideLayout({ children, title, description, category, lastUpdated }) {
  const location = useLocation();

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <AdSenseBanner slot="1111111111" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-8">
          <Link to="/guides" className="hover:text-slate-300 transition-colors">Guides</Link>
          {category && <>
            <ChevronRight size={12} />
            <span className="text-slate-400">{category}</span>
          </>}
          {title && <>
            <ChevronRight size={12} />
            <span className="text-slate-300">{title}</span>
          </>}
        </nav>

        <div className="flex gap-8 lg:gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              {GUIDE_NAV.map(section => (
                <div key={section.slug}>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{section.category}</p>
                  <ul className="space-y-1">
                    {section.items.map(item => {
                      const href = `/guides/${section.slug}/${item.slug}`;
                      const active = location.pathname === href;
                      return (
                        <li key={item.slug}>
                          <Link
                            to={href}
                            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              active
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                            }`}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {title && (
              <div className="mb-8">
                {category && <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">{category}</p>}
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{title}</h1>
                {description && <p className="text-slate-400 text-lg leading-relaxed">{description}</p>}
                {lastUpdated && <p className="text-slate-600 text-xs mt-3">Last updated: {lastUpdated}</p>}
              </div>
            )}
            <article className="prose-guide">
              {children}
            </article>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}