import { Link } from 'react-router-dom';
import { Layers, Heart, Globe, Shield, Users } from 'lucide-react';
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

export default function About() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-4">About Open Domains</h1>
        <p className="text-slate-400 text-lg mb-12 leading-relaxed">We believe every developer deserves access to a real subdomain without jumping through hoops or spending money.</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Heart size={20} className="text-indigo-400" /> Our Mission</h2>
            <p className="text-slate-400 leading-relaxed">Open Domains was created to give developers, students, and open-source contributors a professional, stable subdomain without the cost. We believe that access to basic infrastructure shouldn't be a barrier to building and shipping projects.</p>
            <p className="text-slate-400 leading-relaxed mt-3">Every subdomain is backed by Cloudflare's enterprise DNS infrastructure — the same network used by millions of websites worldwide — so your project gets fast, reliable DNS from day one.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Globe size={20} className="text-indigo-400" /> What We Offer</h2>
            <p className="text-slate-400 leading-relaxed">Open Domains offers free subdomains across multiple root domains for use in personal projects, portfolios, staging environments, academic work, and open-source software. We support common DNS record types including A, AAAA, CNAME, MX, and TXT, and offer optional Cloudflare CDN proxying.</p>
            <p className="text-slate-400 leading-relaxed mt-3">Unlike automated services that instantly register anything, every request at Open Domains is reviewed by a real person. This ensures the platform stays clean, trustworthy, and useful for everyone.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Shield size={20} className="text-indigo-400" /> Safety & Moderation</h2>
            <p className="text-slate-400 leading-relaxed">We take platform safety seriously. All requests go through a manual review process. Our team checks that subdomains are used for legitimate purposes — not phishing, malware distribution, spam, or any activity that harms others.</p>
            <p className="text-slate-400 leading-relaxed mt-3">Subdomains found to be in violation of our Terms of Service can be suspended immediately. We respond to abuse reports within 24 hours on business days and work with authorities when legally required.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Users size={20} className="text-indigo-400" /> Who Uses Open Domains</h2>
            <p className="text-slate-400 leading-relaxed">Our users are a community of curious, creative people:</p>
            <ul className="text-slate-400 space-y-2 mt-3 list-none">
              {[
                'Developers testing new web apps and APIs',
                'Students hosting class projects and portfolios',
                'Open-source maintainers providing demo URLs',
                'Indie hackers shipping side projects',
                'Researchers needing a stable, routable endpoint',
              ].map(u => (
                <li key={u} className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">▸</span> {u}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Uptime & Reliability</h2>
            <p className="text-slate-400 leading-relaxed">DNS for all subdomains is managed through Cloudflare, which operates one of the largest and most reliable networks in the world. Cloudflare's DNS infrastructure achieves 100% uptime SLA for enterprise customers. While Open Domains doesn't provide a formal SLA for free users, you benefit from the same underlying infrastructure.</p>
            <p className="text-slate-400 leading-relaxed mt-3">Our dashboard and management platform are hosted on modern cloud infrastructure and maintained regularly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Fair Usage</h2>
            <p className="text-slate-400 leading-relaxed">Open Domains is provided as a free service. We ask users to use it fairly — don't hoard subdomains you don't need, and don't use it for commercial services that generate revenue without contributing back to the community. If your project grows into a business, consider migrating to a paid DNS provider to free up resources for others.</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link to="/dashboard">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white">Get Your Free Subdomain</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}