import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function IncorrectRecords() {
  return (
    <GuideLayout
      title="Incorrect DNS Records — How to Identify and Fix"
      description="Wrong DNS records cause websites to go offline, email to break, and certificates to fail. Learn how to audit and correct your DNS configuration."
      category="Troubleshooting"
      lastUpdated="April 2026"
    >
      <H2>How to Audit Your DNS Records</H2>
      <P>Start by listing all current DNS records for your domain and compare them against what they should be:</P>
      <CodeBlock label="Audit DNS records with dig">
{`# List all record types
dig yourdomain.com ANY

# Check specific types
dig yourdomain.com A
dig yourdomain.com MX
dig yourdomain.com TXT
dig yourdomain.com NS
dig yourdomain.com CNAME`}
      </CodeBlock>

      <H2>Common Incorrect Record Patterns</H2>
      <UL>
        <LI><strong>CNAME on root domain:</strong> <InlineCode>example.com CNAME something.else.com</InlineCode> — invalid. Use an A record or Cloudflare's CNAME flattening.</LI>
        <LI><strong>IP address in CNAME:</strong> <InlineCode>www CNAME 203.0.113.42</InlineCode> — invalid. CNAME needs a hostname. Use an A record for IPs.</LI>
        <LI><strong>Missing trailing dot in zone files:</strong> <InlineCode>target.example.com</InlineCode> instead of <InlineCode>target.example.com.</InlineCode> (only matters in raw zone files)</LI>
        <LI><strong>MX pointing to IP:</strong> <InlineCode>@ MX 10 203.0.113.10</InlineCode> — invalid. MX needs a hostname.</LI>
        <LI><strong>Multiple SPF records:</strong> Two TXT records both starting with <InlineCode>v=spf1</InlineCode> — invalid. Merge them into one.</LI>
        <LI><strong>Wrong CNAME target:</strong> Pointing to a deployment URL that doesn't exist anymore</LI>
      </UL>

      <InArticleAd />

      <H2>Diagnosing Email Delivery Problems</H2>
      <CodeBlock label="Check MX and email authentication records">
{`# Check MX records
dig yourdomain.com MX

# Check SPF
dig yourdomain.com TXT | grep spf

# Check DMARC
dig _dmarc.yourdomain.com TXT

# Check DKIM (replace 'google' with your selector)
dig google._domainkey.yourdomain.com TXT`}
      </CodeBlock>
      <P>Use <InlineCode>mail-tester.com</InlineCode> — send an email to their test address and get a detailed report on your email configuration, including SPF, DKIM, and DMARC scores.</P>

      <H2>Diagnosing Website Not Loading</H2>
      <UL>
        <LI>Check A record exists and has the correct IP: <InlineCode>dig yourdomain.com A +short</InlineCode></LI>
        <LI>Ping the IP directly: <InlineCode>ping 203.0.113.42</InlineCode></LI>
        <LI>Check if the web server is actually running on that IP: <InlineCode>curl -I http://203.0.113.42 -H "Host: yourdomain.com"</InlineCode></LI>
        <LI>Check firewall — ensure port 80 and 443 are open</LI>
      </UL>

      <H2>How to Safely Fix Incorrect Records</H2>
      <UL>
        <LI>Lower TTL to 300 before making changes (allows quick rollback)</LI>
        <LI>Make one change at a time — don't change everything simultaneously</LI>
        <LI>Wait for TTL to expire, then verify the fix is live</LI>
        <LI>Test from multiple locations and devices</LI>
        <LI>If something breaks, change it back — with low TTL it reverts quickly</LI>
      </UL>
      <Tip>Keep a record of your DNS configuration in a text file or spreadsheet. If you ever accidentally delete a record or migrate providers, having a reference makes restoring everything much faster.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'Full DNS troubleshooting guide' },
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation', desc: 'Why changes take time' },
        { href: '/guides/dns-record-types/txt-record', title: 'TXT Record / SPF / DKIM', desc: 'Fix email authentication records' },
      ]} />
    </GuideLayout>
  );
}