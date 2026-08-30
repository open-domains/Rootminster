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

export default function TermsOfService() {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: August 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>By using Open Domains ("the Platform"), you agree to these Terms of Service. If you do not agree, do not use the Platform. We may update these terms at any time; continued use constitutes acceptance.</p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 13 years old to use Open Domains. By using the Platform, you represent that you are legally capable of entering into a binding agreement. If you are under 18, you must have parental consent.</p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You may use Open Domains subdomains only for lawful purposes. You agree not to use any subdomain for:</p>
          <ul className="list-none space-y-1 ml-0">
            {[
              'Adult or sexually explicit content of any kind',
              'Gambling or betting services of any kind',
              'Phishing, fraud, or deceptive practices',
              'Distributing malware, spyware, or ransomware',
              'Spam or unsolicited bulk communications',
              'Child sexual abuse material (CSAM) or any illegal content',
              'Hosting content that infringes intellectual property rights',
              'DDoS attacks, port scanning, or network abuse',
              'Impersonating other people, companies, or services',
              'Any activity that violates applicable laws',
            ].map(i => <li key={i} className="flex gap-2"><span className="text-red-400 shrink-0">✗</span>{i}</li>)}
          </ul>
        </Section>

        <Section title="4. Subdomain Ownership & Approval">
          <p>Subdomains are granted through a manual review process. Approval is at our sole discretion. We do not guarantee approval of any request. Approved subdomains remain the property of Open Domains — we grant you a revocable license to use them.</p>
          <p>Open Domains reserves the right to delete, suspend, or revoke any domain or subdomain at any time, for any reason, and without prior notice or explanation. This includes but is not limited to violations of these Terms, abuse, inactivity, or any other reason at our sole discretion.</p>
        </Section>

        <Section title="4a. Legal Responsibility">
          <p>You accept full and sole legal responsibility for all content hosted under your subdomain. Open Domains bears no liability whatsoever for any content, claims, damages, fines, or legal proceedings arising from your use of the service or the content you host.</p>
          <p>You agree to indemnify and hold harmless Open Domains, its operators, and affiliates from any claim, loss, liability, or expense (including legal fees) arising from your use of the Platform or violation of these Terms.</p>
        </Section>

        <Section title="5. Non-Commercial Use and Fair Usage">
          <p>Open Domains is provided exclusively for personal, educational, community, open-source, hobby, and other non-commercial projects. Commercial or business use is not permitted.</p>
          <p>You must not use a subdomain for a business, company, paid service, revenue-generating project, client project, commercial promotion, advertising operation, online shop, or any other activity intended primarily for commercial gain.</p>
          <p>You also agree not to abuse the service by hoarding subdomains, automating requests, or consuming disproportionate platform resources. We may reject, suspend, or revoke any subdomain that we reasonably believe is being used for a commercial or business purpose.</p>
        </Section>

        <Section title="6. DNS Changes and Edits">
          <p>All changes to DNS records require admin approval. You may not attempt to bypass the approval process. Any unauthorized or fraudulent attempts to modify DNS records will result in immediate account suspension.</p>
        </Section>

        <Section title="7. Availability and Uptime">
          <p>We provide the Platform "as is" and make no guarantees about uptime, availability, or continuity of service. DNS is provided through Cloudflare's infrastructure, which has its own terms and service levels. We are not liable for Cloudflare outages or changes to their service.</p>
        </Section>

        <Section title="8. Termination">
          <p>We may terminate or suspend your account and revoke all associated subdomains at any time, with or without notice, if you violate these Terms or for any other reason at our discretion. You may close your account at any time by contacting support.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the maximum extent permitted by law, Open Domains is not liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the Platform, including loss of data, revenue, or business. Your sole remedy for dissatisfaction is to stop using the Platform.</p>
        </Section>

        <Section title="10. Governing Law">
          <p>These Terms of Service are governed by and construed in accordance with the laws of England and Wales, United Kingdom. You agree to submit to the exclusive jurisdiction of the courts of England and Wales in respect of any dispute or claim arising out of or in connection with these Terms or your use of the Platform.</p>
        </Section>

        <Section title="11. Contact">
          <p>For questions about these Terms, contact us at hello@open-domains.net or through our <Link to="/contact" className="text-indigo-400 hover:underline">Contact page</Link>.</p>
        </Section>
      </div>
    </div>
  );
}