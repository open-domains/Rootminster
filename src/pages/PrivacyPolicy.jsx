import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
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

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
      <div className="text-slate-400 leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: January 2024</p>

        <Section title="1. Introduction">
          <p>Open Domains ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights regarding your data when you use our platform at open-domains.net.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong className="text-slate-300">Account Information:</strong> When you register, we collect your email address and optionally your name. This is used to manage your account and communicate with you about your requests.</p>
          <p><strong className="text-slate-300">Subdomain Request Data:</strong> We collect the information you submit when requesting a subdomain — including the desired subdomain name, DNS record type, target value, and any project description you provide.</p>
          <p><strong className="text-slate-300">Usage Data:</strong> We may collect basic usage statistics such as pages visited and features used to improve the platform. We do not use third-party advertising trackers beyond what is required for AdSense.</p>
          <p><strong className="text-slate-300">Communications:</strong> Messages sent through our contact form or request conversations are stored to facilitate support and review.</p>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use your data to: process and review subdomain requests; communicate with you about the status of your requests; send transactional emails (approvals, rejections, questions); provide customer support; maintain platform security and prevent abuse; and improve the platform experience.</p>
          <p>We do not sell your personal data to third parties. We do not use your data for targeted advertising beyond standard Google AdSense contextual ads.</p>
        </Section>

        <Section title="4. Data Sharing">
          <p>We share your data only when necessary: with Cloudflare to create and manage DNS records on your behalf; with email service providers to send transactional notifications; and with law enforcement when required by applicable law.</p>
          <p>DNS records (subdomain names and their targets) are public by nature — anyone with a DNS lookup tool can see which IP or domain your subdomain points to. This is inherent to how DNS works.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your account data for as long as your account is active. Request history and audit logs are retained for 2 years. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>
        </Section>

        <Section title="6. Cookies">
          <p>We use essential cookies for session management and authentication. We may use Google AdSense cookies for ad serving. You can control non-essential cookies through your browser settings. Disabling cookies may affect your ability to use the platform.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to: access a copy of your personal data; correct inaccurate data; request deletion of your data; object to processing; and data portability. To exercise these rights, contact us at hello@open-domains.net.</p>
        </Section>

        <Section title="8. Security">
          <p>We use industry-standard security measures including HTTPS encryption, access controls, and regular security reviews. However, no system is 100% secure. Please use a strong, unique password for your account.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about this Privacy Policy? Contact us at privacy@opendomains.dev or through our <Link to="/contact" className="text-indigo-400 hover:underline">Contact page</Link>.</p>
        </Section>
      </div>
    </div>
  );
}