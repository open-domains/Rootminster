import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PublicNav() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Layers size={16} className="text-white" /></div>
          <span className="font-bold text-white">Open Domains</span>
        </Link>
        <Link to="/dashboard"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Get Started</Button></Link>
      </div>
    </nav>
  );
}

const faqs = [
  { q: 'Is Open Domains really free?', a: 'Yes. Open Domains is completely free to use. We do not charge for subdomain registration, DNS management, or reviews. Our platform is funded through advertising and is provided as a public good for developers and students.' },
  { q: 'Who can use Open Domains?', a: 'Anyone can use Open Domains for legitimate, non-commercial projects. We welcome developers, students, researchers, hobbyists, and open-source maintainers. Subdomains are intended for genuine projects — not spam, phishing, or any activity that violates our Terms of Service.' },
  { q: 'How long does approval take?', a: 'Most requests are reviewed within 1–2 business days. Complex or unusual requests may take slightly longer. Our team reviews every request manually to ensure quality and safety.' },
  { q: 'Why was my request rejected?', a: 'Requests may be rejected for several reasons: the subdomain name was inappropriate or reserved, the DNS target appeared suspicious or did not resolve correctly, the project description was missing or insufficient, or the request violated our usage policies. You will always receive a rejection reason.' },
  { q: 'Can I update my subdomain after it\'s approved?', a: 'Yes. You can submit an edit request from your dashboard at any time. Changes to your DNS record — such as updating the target IP or CNAME — require admin approval before they are applied to the live Cloudflare record.' },
  { q: 'What record types are supported?', a: 'We support A, AAAA, CNAME, MX, and TXT records. If you have a specific requirement not covered by these types, you can mention it in your request and we\'ll evaluate it on a case-by-case basis.' },
  { q: 'Can I point my subdomain to a local IP?', a: 'No. Requests pointing to private or local IP addresses (such as 192.168.x.x or 10.x.x.x) will be rejected. Subdomains must point to publicly routable addresses.' },
  { q: 'What is Cloudflare proxying?', a: 'When you enable Cloudflare proxying, traffic to your subdomain routes through Cloudflare\'s CDN before reaching your server. This provides DDoS protection, caching, and hides your real IP. You can toggle this on or off via an edit request.' },
  { q: 'How do I report abuse?', a: 'Use our Report Abuse page to flag subdomains that are being used for phishing, spam, or other harmful activities. We take abuse reports seriously and act quickly.' },
  { q: 'Can subdomains be revoked?', a: 'Yes. We reserve the right to suspend or revoke any subdomain that violates our Terms of Service, is found to be involved in abuse, or is abandoned (unused) for extended periods.' },
  { q: 'Is there a limit on how many subdomains I can request?', a: 'Currently, we allow a reasonable number of subdomains per account. Accounts requesting an unusually high number of subdomains may be reviewed or rate-limited. This is to prevent abuse and ensure fair use for everyone.' },
  { q: 'Do you have an uptime guarantee?', a: 'We use Cloudflare\'s enterprise-grade infrastructure for DNS, which has industry-leading uptime. While we do not offer a formal SLA for free accounts, we aim to maintain 99.9%+ DNS availability. Our platform itself may have scheduled maintenance windows.' },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/30 transition-colors">
        <span className="text-white font-medium text-sm pr-4">{q}</span>
        {open ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-slate-700/50">
          <p className="text-slate-400 text-sm leading-relaxed pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
        <p className="text-slate-400 text-lg mb-12">Everything you need to know about Open Domains.</p>
        <div className="space-y-3">
          {faqs.map(f => <FAQItem key={f.q} {...f} />)}
        </div>
        <div className="mt-12 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
          <p className="text-white font-semibold mb-2">Still have questions?</p>
          <p className="text-slate-400 text-sm mb-4">Our team is happy to help. Reach out through the contact page.</p>
          <Link to="/contact"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Contact Us</Button></Link>
        </div>
      </div>
    </div>
  );
}