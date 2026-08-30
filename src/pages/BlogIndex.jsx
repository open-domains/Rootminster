import { Link } from 'react-router-dom';
import { PublicNav, PublicFooter, AdSenseBanner } from '@/components/PublicPageLayout';
import { Calendar, ArrowRight } from 'lucide-react';

export const BLOG_POSTS = [
  {
    slug: 'how-to-set-up-a-website-for-free',
    title: 'How to Set Up a Website for Free in 2026',
    description: 'From domain to deployed — a complete walkthrough for getting a website live without spending a penny.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Web Hosting',
    tags: ['hosting', 'free', 'beginners', 'web'],
    readTime: 8,
  },
  {
    slug: 'best-free-hosting-providers-2026',
    title: 'Best Free Hosting Providers in 2026',
    description: 'An honest, up-to-date comparison of the best free web hosting platforms — what they offer, where they fall short, and who each one is best for.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Web Hosting',
    tags: ['hosting', 'comparison', 'free', 'vercel', 'netlify'],
    readTime: 7,
  },
  {
    slug: 'common-dns-mistakes-beginners-make',
    title: 'Common DNS Mistakes Beginners Make (And How to Fix Them)',
    description: 'Setting up DNS for the first time? These are the mistakes almost everyone makes — and exactly how to avoid them.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'DNS',
    tags: ['dns', 'beginners', 'troubleshooting'],
    readTime: 6,
  },
  {
    slug: 'how-to-use-cloudflare-like-a-pro',
    title: 'How to Use Cloudflare Like a Pro',
    description: 'Most people only use Cloudflare for DNS. Here are the powerful free features hiding in your dashboard that you should be using.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Cloudflare',
    tags: ['cloudflare', 'performance', 'security', 'cdn'],
    readTime: 9,
  },
  {
    slug: 'what-is-a-subdomain-and-why-use-one',
    title: 'What is a Subdomain and Why Should You Use One?',
    description: "Subdomains are one of the most useful tools in a developer's toolkit. Here's everything you need to know, in plain English.",
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'DNS',
    tags: ['subdomain', 'dns', 'beginners'],
    readTime: 5,
  },
  {
    slug: 'free-vs-paid-hosting',
    title: 'Free vs Paid Hosting — What You Actually Need to Know',
    description: "The honest breakdown of when free hosting is perfectly fine, and when it's time to pay for something better.",
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Web Hosting',
    tags: ['hosting', 'comparison', 'vps', 'budget'],
    readTime: 7,
  },
  {
    slug: 'how-to-secure-your-domain',
    title: 'How to Secure Your Domain — A Practical Guide',
    description: 'Domain hijacking is more common than you think. Here are the concrete steps to lock down your domain and prevent losing it.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Security',
    tags: ['security', 'domain', '2fa', 'dnssec'],
    readTime: 7,
  },
  {
    slug: 'understanding-ssl-certificates',
    title: 'Understanding SSL Certificates — No Jargon',
    description: "SSL, TLS, HTTPS — what does it all actually mean? This guide cuts through the jargon and explains why HTTPS matters for every website.",
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Security',
    tags: ['ssl', 'https', 'security', 'certificates'],
    readTime: 8,
  },
  {
    slug: 'beginners-guide-to-web-hosting',
    title: "Beginner's Guide to Web Hosting — Everything You Need to Know",
    description: "Never rented web hosting before? This guide explains every type of hosting, what the specs mean, and how to choose the right option for your project.",
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Web Hosting',
    tags: ['hosting', 'vps', 'beginners', 'shared-hosting'],
    readTime: 10,
  },
  {
    slug: 'top-tools-for-managing-domains',
    title: 'Top Tools for Managing Your Domains in 2026',
    description: 'A curated list of the best free and paid tools for DNS management, monitoring, and troubleshooting.',
    author: 'Open Domains Team',
    date: 'April 2026',
    category: 'Tools',
    tags: ['tools', 'dns', 'monitoring', 'management'],
    readTime: 6,
  },
];

const CATEGORY_COLORS = {
  'Web Hosting': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'DNS': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'Cloudflare': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Security': 'bg-red-500/15 text-red-300 border-red-500/30',
  'Tools': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export default function BlogIndex() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <AdSenseBanner slot="4444444444" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Blog</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Practical guides, tutorials, and insights on DNS, web hosting, and domain management.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {BLOG_POSTS.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="block group">
              <article className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 h-full hover:border-indigo-500/40 transition-all duration-200 group-hover:bg-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-block border rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                    {post.category}
                  </span>
                  <span className="text-slate-600 text-xs">{post.readTime} min read</span>
                </div>
                <h2 className="text-white font-bold text-lg mb-2 leading-snug group-hover:text-indigo-300 transition-colors">
                  {post.title}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2">{post.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <Calendar size={12} />
                    <span>{post.date}</span>
                  </div>
                  <span className="text-indigo-400 text-xs font-medium group-hover:gap-2 flex items-center gap-1 transition-all">
                    Read more <ArrowRight size={12} />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}