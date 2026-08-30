import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function TxtRecord() {
  return (
    <GuideLayout
      title="TXT Record — SPF, DKIM & DMARC Explained"
      description="TXT records store arbitrary text in DNS. They're essential for email security (SPF, DKIM, DMARC) and domain ownership verification."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is a TXT Record?</H2>
      <P>
        A TXT (text) record stores human-readable or machine-readable text in DNS. Originally intended for general notes, TXT records have become the backbone of email authentication, domain verification, and site ownership checks. They're incredibly versatile — if you've ever added a verification code to prove you own a domain, it was almost certainly a TXT record.
      </P>
      <CodeBlock label="TXT Record examples">
{`yourdomain.com.  TXT "v=spf1 include:_spf.google.com ~all"
yourdomain.com.  TXT "google-site-verification=abc123xyz"
_dmarc.yourdomain.com. TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"`}
      </CodeBlock>

      <H2>Email Authentication: SPF, DKIM, and DMARC</H2>
      <P>The three pillars of email security are all configured via TXT records:</P>

      <H3>SPF (Sender Policy Framework)</H3>
      <P>
        SPF tells the world which servers are authorised to send email on behalf of your domain. Without it, spammers can easily forge your domain in the "From" address. SPF is a TXT record on your root domain.
      </P>
      <CodeBlock label="SPF examples">
{`# Only Google Workspace can send email from yourdomain.com
yourdomain.com. TXT "v=spf1 include:_spf.google.com ~all"

# Multiple sending services
yourdomain.com. TXT "v=spf1 include:_spf.google.com include:sendgrid.net include:mailchimp.com ~all"

# SPF qualifiers:
# +all  = allow all (never use!)
# ~all  = softfail (mark suspicious but deliver)
# -all  = hardfail (reject anything not in the list)`}
      </CodeBlock>

      <InArticleAd />

      <H3>DKIM (DomainKeys Identified Mail)</H3>
      <P>
        DKIM adds a cryptographic signature to every outgoing email. The receiving server uses the public key published in your DNS to verify the email wasn't tampered with in transit. It's set up as a TXT record at a specific subdomain provided by your email service.
      </P>
      <CodeBlock label="DKIM TXT record">
{`# DKIM selector record format: selector._domainkey.yourdomain.com
google._domainkey.yourdomain.com. TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUA..."

# The "p=" value is the public key — your email provider generates this`}
      </CodeBlock>

      <H3>DMARC (Domain-based Message Authentication, Reporting & Conformance)</H3>
      <P>
        DMARC builds on SPF and DKIM, telling receivers what to do when an email fails authentication — reject it, quarantine it, or deliver it anyway. It also requests reports sent back to you about email authentication failures, helping you detect spoofing attempts.
      </P>
      <CodeBlock label="DMARC TXT record">
{`_dmarc.yourdomain.com. TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"

# p= policies:
# none       = monitor mode, no action taken (start here)
# quarantine = send failing mail to spam folder
# reject     = block failing mail entirely (most secure)`}
      </CodeBlock>
      <Tip>Start with <InlineCode>p=none</InlineCode> to monitor without breaking legitimate email. Once you're confident all legitimate senders are covered by SPF/DKIM, move to <InlineCode>p=quarantine</InlineCode>, then <InlineCode>p=reject</InlineCode>.</Tip>

      <H2>Other Common TXT Record Uses</H2>
      <UL>
        <LI><strong>Domain verification</strong> — Google Search Console, Facebook, HubSpot, Stripe, etc. all use TXT records to verify ownership</LI>
        <LI><strong>Site verification</strong> — Proving you control a domain for SSL certificate issuance</LI>
        <LI><strong>BIMI (Brand Indicators)</strong> — Displays your company logo in email clients that support it</LI>
        <LI><strong>MTA-STS</strong> — Enforces TLS for email delivery to your domain</LI>
      </UL>

      <H2>Common TXT Record Mistakes</H2>
      <UL>
        <LI>Multiple SPF records — you can only have ONE SPF record per domain. Merge them instead.</LI>
        <LI>Forgetting quotes around TXT values in zone files</LI>
        <LI>TXT records longer than 255 characters in a single string — split into multiple strings if needed</LI>
        <LI>Setting DMARC to <InlineCode>p=reject</InlineCode> before properly configuring SPF and DKIM — this will block legitimate email</LI>
      </UL>
      <Warning>Only one SPF record is allowed per hostname. If you have multiple email services (e.g., Google Workspace + Mailchimp), combine them into a single SPF record with multiple include statements.</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/mx-record', title: 'MX Record', desc: 'Set up email routing for your domain' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'Alias one hostname to another' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Certificate Issues', desc: 'Fix HTTPS and SSL problems' },
      ]} />
    </GuideLayout>
  );
}