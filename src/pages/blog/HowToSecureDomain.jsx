import BlogLayout from '@/components/BlogLayout';
import { H2, P, UL, LI, Note, Tip, Warning, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function HowToSecureDomain() {
  return (
    <BlogLayout
      title="How to Secure Your Domain — A Practical Guide"
      description="Domain hijacking is more common than you think. Here are the concrete steps to lock down your domain and prevent losing it."
      author="Open Domains Team"
      date="April 2026"
      category="Security"
      tags={['security', 'domain', '2fa', 'dnssec']}
      readTime={7}
    >
      <P>
        Losing your domain is one of the most devastating things that can happen to an online business or project. It happens through compromised registrar accounts, social engineering, or simply neglected security settings. Here's how to make sure it doesn't happen to you.
      </P>

      <H2>1. Enable Two-Factor Authentication on Your Registrar Account</H2>
      <P>
        This is the single most impactful security measure. If an attacker gets your registrar password (through phishing, data breaches, or password reuse), 2FA stops them from making changes to your domain. Every major registrar supports 2FA — enable it now if you haven't.
      </P>
      <UL>
        <LI>Use an authenticator app (Google Authenticator, Authy) rather than SMS 2FA — SMS can be SIM-swapped</LI>
        <LI>Store your backup codes in a password manager or secure offline location</LI>
        <LI>Make sure 2FA is also enabled on the email account associated with your registrar</LI>
      </UL>
      <Warning>Your email account is the biggest attack vector for domain theft. If attackers control your email, they can reset your registrar password. Lock down your email with a strong password and 2FA first.</Warning>

      <H2>2. Enable Domain Lock (Registrar Lock)</H2>
      <P>
        Most registrars offer a "domain lock" or "transfer lock" feature that prevents your domain from being transferred to another registrar without additional verification. Enable it. There's no downside — you can still update DNS records and other settings; it only prevents unauthorised transfers.
      </P>

      <InArticleAd />

      <H2>3. Use a Strong, Unique Password</H2>
      <P>
        Use a password manager to generate a unique, strong password for your registrar account. Never reuse passwords across services. If one site is breached and you reuse passwords, every account with that password is at risk.
      </P>

      <H2>4. Keep Your WHOIS Contact Information Accurate</H2>
      <P>
        Your WHOIS information (name, email, address) is used to verify domain ownership in disputes and transfers. Inaccurate or outdated contact details can cause you to miss critical notices, or give attackers a way to claim you're not the legitimate owner.
      </P>
      <Note>Most registrars offer WHOIS privacy protection (hiding your contact details from public WHOIS lookups). Enable this — it reduces spam and makes it harder for attackers to gather information about you.</Note>

      <H2>5. Enable DNSSEC</H2>
      <P>
        DNSSEC (DNS Security Extensions) adds cryptographic signatures to DNS records, preventing DNS spoofing attacks where an attacker redirects your domain's traffic to a malicious server. If your registrar and DNS provider both support it, enable it.
      </P>
      <P>Cloudflare makes DNSSEC easy — it's a single toggle in the DNS section of your dashboard. Enable it, then copy the DS record to your registrar.</P>

      <H2>6. Set Up Domain Expiry Alerts</H2>
      <P>
        Domains expire. If you miss the renewal, someone else can register your domain the moment it becomes available. Set up alerts well in advance:
      </P>
      <UL>
        <LI>Enable auto-renew at your registrar (most support this)</LI>
        <LI>Set calendar reminders 60 and 30 days before expiry</LI>
        <LI>Keep your payment method up to date at your registrar</LI>
        <LI>Don't use a card that expires before your domain does</LI>
      </UL>

      <H2>7. Monitor Your Domain's DNS Changes</H2>
      <P>
        Set up monitoring to alert you if DNS records change unexpectedly. Tools like DNSstatus.app or Uptime Robot can monitor DNS and send alerts. If someone changes your A record or MX record without your knowledge, you'll know immediately.
      </P>
      <Tip>Consider registering your domain for 5-10 years. It's cheaper per year, removes the renewal risk, and signals longevity to search engines (Google considers registration length as a very minor ranking factor).</Tip>

      <RelatedArticles articles={[
        { href: '/blog/understanding-ssl-certificates', title: 'Understanding SSL Certificates', desc: 'Secure your website with HTTPS' },
        { href: '/guides/dns-record-types/txt-record', title: 'TXT Record / SPF / DKIM', desc: 'Secure your email' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Issues', desc: 'Fix HTTPS problems' },
      ]} />
    </BlogLayout>
  );
}