import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function NsRecord() {
  return (
    <GuideLayout
      title="NS Record — Nameserver Delegation Guide"
      description="NS records delegate DNS authority for a domain or subdomain to specific nameservers. Learn how they work and when to use them."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is an NS Record?</H2>
      <P>
        An NS (Nameserver) record specifies which nameservers are authoritative for a domain or subdomain. In other words, NS records tell the DNS system: "go ask this server for records about this domain." Every domain on the internet has at least two NS records for redundancy.
      </P>
      <CodeBlock label="NS Record example">
{`example.com. 86400 IN NS ns1.cloudflare.com.
example.com. 86400 IN NS ns2.cloudflare.com.`}
      </CodeBlock>
      <P>NS records typically have high TTLs (86400 = 24 hours) because they change rarely and you want the delegation information cached everywhere to speed up DNS resolution.</P>

      <H2>Root Domain NS Records vs. Subdomain Delegation</H2>
      <P>NS records serve two different purposes:</P>
      <UL>
        <LI><strong>Root domain NS records:</strong> Set at your registrar. These tell the global DNS system which nameservers hold records for your domain.</LI>
        <LI><strong>Subdomain delegation:</strong> NS records on a subdomain (e.g., <InlineCode>dev.example.com NS ns1.otherprovider.com</InlineCode>) delegate that subdomain to a different DNS provider. This allows separate teams to manage DNS for different subdomains independently.</LI>
      </UL>

      <InArticleAd />

      <H2>Subdomain Delegation Example</H2>
      <P>Imagine your main domain uses Cloudflare, but you want your <InlineCode>dev</InlineCode> subdomain to be managed separately by your development team:</P>
      <CodeBlock label="Delegating a subdomain">
{`# In your main zone (Cloudflare), add NS records for the subdomain:
dev.example.com. 3600 NS ns1.devteam-dns.com.
dev.example.com. 3600 NS ns2.devteam-dns.com.

# Now the dev team manages all records under dev.example.com independently`}
      </CodeBlock>
      <Note>When the donation feature is enabled, Open Domains requires a small donation unlock for NS record support. Installations with donations disabled make NS records available without that unlock.</Note>

      <H2>NS Records and Cloudflare</H2>
      <P>When you add a domain to Cloudflare, they assign you two nameservers (e.g., <InlineCode>hazel.ns.cloudflare.com</InlineCode> and <InlineCode>pete.ns.cloudflare.com</InlineCode>). You update these at your registrar, pointing the global DNS system to Cloudflare's servers. All your DNS records then live inside Cloudflare's zone editor.</P>

      <H2>Common Mistakes</H2>
      <UL>
        <LI>Changing NS records at your registrar without first setting up DNS on the new nameserver — this takes your site offline</LI>
        <LI>Having NS records that don't resolve — always ensure your nameservers are reachable</LI>
        <LI>Mixing up nameserver changes (at registrar) with NS records (in your DNS zone) — these are different things</LI>
      </UL>
      <Warning>Never delete all NS records from your domain. Without NS records, the DNS system can't find your authoritative servers and your entire domain goes offline.</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-basics/what-is-a-nameserver', title: 'What is a Nameserver?', desc: 'Deep dive on nameservers' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Change your NS records to Cloudflare' },
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation', desc: 'Why NS changes take time' },
      ]} />
    </GuideLayout>
  );
}
