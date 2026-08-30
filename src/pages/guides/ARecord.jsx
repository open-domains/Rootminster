import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function ARecord() {
  return (
    <GuideLayout
      title="A Record (IPv4) — Complete Guide"
      description="The A record is the most fundamental DNS record type. Learn what it does, how to set it up, and common mistakes to avoid."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is an A Record?</H2>
      <P>
        An A record (Address record) maps a domain name to an IPv4 address. It's the most basic and commonly used DNS record type — it's how your domain name gets connected to a server. When someone types your domain into a browser, the A record tells the internet exactly which server to load the website from.
      </P>
      <CodeBlock label="A Record example">
{`example.com.     3600  IN  A  203.0.113.42
www.example.com. 3600  IN  A  203.0.113.42`}
      </CodeBlock>
      <P>In the above example, both <InlineCode>example.com</InlineCode> and <InlineCode>www.example.com</InlineCode> point to the IP address <InlineCode>203.0.113.42</InlineCode>.</P>

      <H2>Simple Explanation</H2>
      <P>
        Imagine you want to visit a friend's house. You know their name (domain), but you need their actual street address (IP) to get there. The A record is that street address — it's the definitive "this domain lives at this IP" mapping.
      </P>

      <H2>Real-World Examples</H2>
      <UL>
        <LI>Pointing your website domain to your web server's IP: <InlineCode>myblog.com → 185.199.108.153</InlineCode></LI>
        <LI>Setting up a subdomain for your app: <InlineCode>app.mysite.com → 203.0.113.10</InlineCode></LI>
        <LI>Multiple A records for the same domain (load balancing): <InlineCode>api.mysite.com → 10.0.0.1</InlineCode> and <InlineCode>api.mysite.com → 10.0.0.2</InlineCode></LI>
      </UL>

      <InArticleAd />

      <H2>How to Create an A Record</H2>
      <P>Most DNS providers have a similar interface. You'll need to fill in:</P>
      <UL>
        <LI><strong>Type:</strong> A</LI>
        <LI><strong>Name/Host:</strong> The subdomain or <InlineCode>@</InlineCode> for the root domain</LI>
        <LI><strong>Value/Content:</strong> The IPv4 address (e.g., <InlineCode>203.0.113.42</InlineCode>)</LI>
        <LI><strong>TTL:</strong> Typically 3600 (1 hour) for stable records</LI>
      </UL>
      <CodeBlock label="Setting up in Cloudflare format">
{`Type:    A
Name:    @          (for root domain) or  api  (for api.yourdomain.com)
Content: 203.0.113.42
TTL:     Auto (Cloudflare manages this)
Proxy:   On (for CDN/DDoS protection) or Off (DNS only)`}
      </CodeBlock>

      <H2>Multiple A Records (Round Robin)</H2>
      <P>
        You can create multiple A records for the same hostname, each pointing to a different IP. DNS resolvers will return all of them and clients typically rotate through them — providing basic load balancing known as "round robin DNS."
      </P>
      <Warning>Round robin DNS is not true load balancing — it doesn't check server health. If one server goes down, DNS will still direct some traffic there. Use a proper load balancer or Cloudflare proxying for production systems.</Warning>

      <H2>A Record vs. CNAME Record</H2>
      <P>A common question is when to use an A record vs. a CNAME record:</P>
      <UL>
        <LI><strong>Use A record</strong> when you know the IP address and it doesn't change often</LI>
        <LI><strong>Use CNAME</strong> when you want to alias one hostname to another (e.g., pointing to a Vercel/Netlify deployment URL that handles its own IP changes)</LI>
        <LI><strong>Always use A record</strong> for the root domain (<InlineCode>@</InlineCode>) — CNAME is not allowed there</LI>
      </UL>

      <H2>Common Mistakes</H2>
      <UL>
        <LI>Entering a hostname instead of an IP address (that's a CNAME, not an A record)</LI>
        <LI>Using a private IP like <InlineCode>192.168.1.1</InlineCode> — this won't work on the public internet</LI>
        <LI>Forgetting to update the A record when migrating servers</LI>
        <LI>Setting an extremely high TTL, then trying to migrate quickly</LI>
      </UL>
      <Tip>Before migrating servers, lower your TTL to 300 at least 24 hours in advance. Once the new server is live and tested, update the A record. Most users will see the change within 5 minutes.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/aaaa-record', title: 'AAAA Record (IPv6)', desc: 'The IPv6 equivalent of the A record' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'Create aliases between hostnames' },
        { href: '/guides/domain-management/point-domain-to-server', title: 'Point a Domain to a Server', desc: 'Full walkthrough for connecting your domain' },
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'Fix common A record issues' },
      ]} />
    </GuideLayout>
  );
}