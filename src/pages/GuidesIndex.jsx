import { Link } from 'react-router-dom';
import { PublicNav, PublicFooter, AdSenseBanner } from '@/components/PublicPageLayout';
import { GUIDE_NAV } from '@/components/GuideLayout';
import { BookOpen, ArrowRight } from 'lucide-react';

const CATEGORY_ICONS = {
  'DNS Basics': '🌐',
  'DNS Record Types': '📄',
  'Domain Management': '⚙️',
  'Hosting Providers': '🚀',
  'Troubleshooting': '🔧',
};

export default function GuidesIndex() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <AdSenseBanner slot="2222222222" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-6">
            <BookOpen size={14} className="text-indigo-400" />
            <span className="text-indigo-300 text-xs font-medium">Free DNS & Hosting Education</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">DNS & Hosting Guides</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Learn everything about DNS, domain management, and web hosting from scratch. Written for beginners, detailed enough for pros.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GUIDE_NAV.map(section => (
            <div key={section.slug} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="text-3xl mb-3">{CATEGORY_ICONS[section.category]}</div>
              <h2 className="text-lg font-bold text-white mb-2">{section.category}</h2>
              <ul className="space-y-1.5 mb-5">
                {section.items.map(item => (
                  <li key={item.slug}>
                    <Link
                      to={`/guides/${section.slug}/${item.slug}`}
                      className="text-slate-400 hover:text-indigo-300 text-sm transition-colors flex items-center gap-1.5"
                    >
                      <ArrowRight size={12} className="text-slate-600" />
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to={`/guides/${section.slug}/${section.items[0].slug}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Start reading →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to get your free subdomain?</h2>
          <p className="text-slate-400 mb-6">Put your new DNS knowledge to work. Request a free subdomain backed by Cloudflare.</p>
          <Link to="/dashboard">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              Request a Subdomain
            </button>
          </Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}