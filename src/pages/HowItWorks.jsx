import { Link } from 'react-router-dom';
import { Layers, Globe, Shield, Zap, MessageCircle, CheckCircle, XCircle, Edit, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PublicNav() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Layers size={16} className="text-white" /></div>
          <span className="font-bold text-white">Open Domains</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/dashboard"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Get Started</Button></Link>
        </div>
      </div>
    </nav>
  );
}

export default function HowItWorks() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-4">How Open Domains Works</h1>
        <p className="text-slate-400 text-lg mb-16 leading-relaxed">A straightforward guide to requesting, managing, and editing your free subdomain.</p>

        <div className="space-y-16">
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><Globe size={22} className="text-indigo-400" /> Step 1: Request a Subdomain</h2>
            <p className="text-slate-400 leading-relaxed mb-4">After creating an account, you can request a subdomain by choosing a name, selecting one of our available root domains, and specifying your DNS record details — such as the record type (A, CNAME, TXT, etc.) and the target value.</p>
            <p className="text-slate-400 leading-relaxed mb-4">You'll also be asked to briefly describe your project. This helps our review team understand the purpose of the subdomain and make faster, better decisions.</p>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-white text-sm font-medium mb-2">Supported Record Types</p>
              <div className="flex flex-wrap gap-2">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map(t => (
                  <span key={t} className="font-mono text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded">{t}</span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><Shield size={22} className="text-indigo-400" /> Step 2: We Review Your Request</h2>
            <p className="text-slate-400 leading-relaxed mb-4">Every subdomain request is reviewed by a real person — either a member of our staff or an admin. This manual process ensures that Open Domains remains a quality platform free from spam, abuse, or malicious content.</p>
            <p className="text-slate-400 leading-relaxed mb-4">Review typically takes 1–2 business days. You'll receive an email notification as soon as your request is processed.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {[
                { icon: CheckCircle, label: 'Approved', desc: 'DNS record created immediately on Cloudflare', color: 'text-emerald-400' },
                { icon: MessageCircle, label: 'Needs Info', desc: 'Reviewer has a question for you', color: 'text-amber-400' },
                { icon: XCircle, label: 'Rejected', desc: 'Request declined with a reason', color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
                  <s.icon size={22} className={`${s.color} mx-auto mb-2`} />
                  <p className="text-white text-sm font-semibold">{s.label}</p>
                  <p className="text-slate-500 text-xs mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><Zap size={22} className="text-indigo-400" /> Step 3: Your Subdomain Goes Live</h2>
            <p className="text-slate-400 leading-relaxed mb-4">When approved, your DNS record is created instantly on Cloudflare's global network. Your subdomain becomes the owner of that record — it's yours to manage. You can see it in your dashboard under "My Subdomains".</p>
            <p className="text-slate-400 leading-relaxed">The record propagates across Cloudflare's network, typically becoming resolvable worldwide within minutes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><Edit size={22} className="text-indigo-400" /> Making Changes to Your Subdomain</h2>
            <p className="text-slate-400 leading-relaxed mb-4">Need to update where your subdomain points? You can submit an edit request from your dashboard. All changes require admin approval before they're applied to the live DNS — this keeps the platform safe and reliable.</p>
            <p className="text-slate-400 leading-relaxed">Supported edit types include updating the record value, toggling Cloudflare proxy, adjusting TTL, or requesting deletion.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><MessageCircle size={22} className="text-indigo-400" /> Communication & Conversations</h2>
            <p className="text-slate-400 leading-relaxed mb-4">Every request has a built-in conversation thread. If our team needs more information, they'll ask directly in the thread and notify you by email. You can reply within your dashboard — no need to send emails or file tickets.</p>
            <p className="text-slate-400 leading-relaxed">This keeps all context in one place and helps requests move faster.</p>
          </section>
        </div>

        <div className="mt-16 text-center">
          <Link to="/dashboard">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              Request Your Subdomain <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}