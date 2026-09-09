import { Link } from 'react-router-dom';
import { PublicFooter, PublicNav } from '@/components/PublicPageLayout';

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-16 sm:px-6 sm:py-20">
        <header className="border-b border-border pb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: 9 September 2026</p>
        </header>

        <Section title="1. Introduction">
          <p>Open Domains (we, us or our) operates the Rootminster platform. This policy explains what personal data we collect, why we use it, who we share it with and the choices available to you.</p>
        </Section>
        <Section title="2. Information we collect">
          <p><strong className="text-foreground">Account data:</strong> your name, email address, authentication details, role, security settings and connected social or Discord identities.</p>
          <p><strong className="text-foreground">Requests and DNS data:</strong> requested names, records, targets, project descriptions, review messages and related activity.</p>
          <p><strong className="text-foreground">Security and technical data:</strong> IP address, device and browser information, audit events, abuse signals, error diagnostics and API activity.</p>
          <p><strong className="text-foreground">Optional analytics:</strong> when you consent, Umami and Google Analytics collect basic visit and feature-usage information. Their scripts are not loaded before analytics consent.</p>
          <p><strong className="text-foreground">Communications and payments:</strong> support messages, abuse reports and donation transaction references where relevant. We do not store full card details.</p>
        </Section>
        <Section title="3. How we use information">
          <p>We use data to provide and secure accounts, process and review domain requests, manage DNS, send status and security notifications, operate role-based tools, investigate abuse, provide support, maintain backups, diagnose errors and improve the platform.</p>
          <p>We do not sell personal data or use it for targeted advertising.</p>
        </Section>
        <Section title="4. Service providers and sharing">
          <p>Data may be processed by Cloudflare for DNS, anti-abuse checks and configured backups; Stripe for optional donations; email providers for transactional messages; GitHub, Google or Discord when you choose a connected login or integration; GlitchTip for scrubbed diagnostics; and Google Analytics or our self-hosted Umami instance only when analytics consent is given.</p>
          <p>We may also disclose information when required by law or necessary to protect users and the service. DNS records are public by design and can be queried by anyone.</p>
        </Section>
        <Section title="5. Retention and deletion">
          <p>We retain account and request data while needed to provide the service and meet security, legal and operational requirements. Retention periods can vary by data type and deployment settings. Administrators can delete an account and its related domains; backups and security logs may expire on a separate schedule.</p>
        </Section>
        <Section title="6. Cookies and browser storage">
          <p>Essential storage supports authentication, security and preferences. Optional analytics storage is used only after consent. You can reject or withdraw analytics consent at any time without losing access to core features.</p>
          <p>Names, purposes and durations are listed in our <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link>.</p>
        </Section>
        <Section title="7. Your rights">
          <p>Depending on where you live, you may have rights to access, correct, delete, restrict or object to processing of your personal data, and to receive a portable copy. You may also withdraw consent for consent-based processing. We may need to verify your identity before fulfilling a request.</p>
        </Section>
        <Section title="8. Security">
          <p>We use HTTPS, access controls, role-based permissions, audit logging and account-security features to protect data. No internet service can guarantee absolute security, so use a strong unique password and enable two-factor authentication.</p>
        </Section>
        <Section title="9. Changes to this policy">
          <p>We may update this policy as Rootminster or its providers change. The current version and effective date will be published here.</p>
        </Section>
        <Section title="10. Contact">
          <p>For privacy questions or requests, email <a href="mailto:hello@open-domains.net" className="text-primary hover:underline">hello@open-domains.net</a> or use our <Link to="/contact" className="text-primary hover:underline">contact page</Link>.</p>
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}
