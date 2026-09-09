import { Link } from 'react-router-dom';
import { PublicFooter, PublicNav } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { openCookieSettings } from '@/lib/cookie-consent';

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

const cookies = [
  ['rootminster_session', 'Essential', 'Keeps you securely signed in.', 'Normally 30 days; deployments can configure a shorter period'],
  ['rootminster_cookie_consent', 'Essential', 'Remembers your cookie choices.', '6 months'],
  ['sidebar_state', 'Essential preference', 'Remembers whether the navigation sidebar is open.', '7 days'],
  ['_ga', 'Analytics', 'Helps Google Analytics distinguish visits.', 'Up to 2 years'],
  ['_ga_<container-id>', 'Analytics', 'Maintains Google Analytics session state.', 'Up to 2 years'],
];

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-16 sm:px-6 sm:py-20">
        <header className="border-b border-border pb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight">Cookie Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: 9 September 2026</p>
        </header>

        <Section title="1. What this policy covers">
          <p>Rootminster uses cookies and similar browser storage to run Open Domains, protect accounts, remember preferences and—only when you agree—measure how the service is used.</p>
          <p>Essential storage is required for the platform to work. Analytics is optional and its scripts are not loaded until you consent. Rejecting analytics does not prevent you from using core platform features.</p>
          <Button variant="outline" onClick={openCookieSettings}>Review cookie settings</Button>
        </Section>

        <Section title="2. Cookies we use">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/50 text-foreground"><tr><th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Category</th><th className="p-3 font-medium">Purpose</th><th className="p-3 font-medium">Duration</th></tr></thead>
              <tbody>{cookies.map(([name, category, purpose, duration]) => <tr key={name} className="border-t border-border"><td className="p-3 font-mono text-xs text-foreground">{name}</td><td className="p-3">{category}</td><td className="p-3">{purpose}</td><td className="p-3">{duration}</td></tr>)}</tbody>
            </table>
          </div>
          <p>The authentication cookie is HttpOnly and uses SameSite=Lax. It is marked Secure when the site is served over HTTPS. Its exact duration follows the session setting selected by the platform operator.</p>
        </Section>

        <Section title="3. Similar browser storage">
          <p>We use local storage for your theme and language, trusted-browser status, and—in supported sign-in flows—an access token. Trusted-browser data and access tokens are removed when revoked, cleared or logged out. Theme and language preferences remain until changed or browser data is cleared.</p>
          <p>We also use temporary session storage for two-factor verification state and safe application update recovery. Session storage is removed when the browser tab or session ends.</p>
        </Section>

        <Section title="4. Analytics and security services">
          <p>With analytics consent, the site loads self-hosted Umami from analytics.open-domains.com and Google Analytics. These services help us understand visits and feature usage. Google advertising storage and ad-personalisation signals remain disabled.</p>
          <p>Cloudflare Turnstile may run as an essential anti-abuse check. GlitchTip may receive scrubbed technical error and performance information needed to diagnose failures and protect the service. These security and reliability tools are not used for advertising.</p>
        </Section>

        <Section title="5. Change or withdraw your choice">
          <p>Use the floating <strong className="text-foreground">Cookie settings</strong> button at any time to accept or reject analytics. Withdrawing consent disables analytics and removes Google Analytics cookies that Rootminster can access. You can also delete stored data in your browser settings.</p>
        </Section>

        <Section title="6. Changes and contact">
          <p>We may update this policy when our storage or providers change. The latest version and date will remain on this page. For privacy questions, email <a className="text-primary hover:underline" href="mailto:hello@open-domains.net">hello@open-domains.net</a> or use our <Link className="text-primary hover:underline" to="/contact">contact page</Link>.</p>
          <p>See our <Link className="text-primary hover:underline" to="/privacy-policy">Privacy Policy</Link> for more information about how personal data is handled.</p>
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}
