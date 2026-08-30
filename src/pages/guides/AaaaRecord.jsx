import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function AaaaRecord() {
  return (
    <GuideLayout
      title="AAAA Record (IPv6) — Complete Guide"
      description="IPv6 is the future of internet addressing. Learn how AAAA records work, how to set them up, and when to use them alongside A records."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is an AAAA Record?</H2>
      <P>
        An AAAA record (pronounced "quad-A") maps a domain name to an IPv6 address, the next-generation IP addressing system. Just as an A record points a domain to an IPv4 address like <InlineCode>203.0.113.42</InlineCode>, an AAAA record points it to an IPv6 address like <InlineCode>2606:4700:4700::1111</InlineCode>.
      </P>
      <CodeBlock label="AAAA Record example">
{`example.com. 3600 IN AAAA 2001:0db8:85a3:0000:0000:8a2e:0370:7334`}
      </CodeBlock>

      <H2>Why IPv6 Exists</H2>
      <P>
        IPv4 addresses are 32-bit numbers, giving a theoretical maximum of about 4.3 billion unique addresses. With billions of devices now connected to the internet, we've essentially run out. IPv6 uses 128-bit addresses, providing an astronomically large address space — approximately 340 undecillion unique addresses. That's enough for every atom on Earth to have its own address.
      </P>
      <P>
        IPv6 adoption has been accelerating. As of 2026, over 40% of internet traffic globally uses IPv6, with countries like India and the USA leading adoption. Google, Cloudflare, and most major CDNs fully support IPv6.
      </P>

      <InArticleAd />

      <H2>IPv6 Address Format</H2>
      <P>IPv6 addresses are 128-bit numbers written as eight groups of four hexadecimal digits, separated by colons:</P>
      <CodeBlock label="IPv6 address formats">
{`Full:       2001:0db8:85a3:0000:0000:8a2e:0370:7334
Compressed: 2001:db8:85a3::8a2e:370:7334  (leading zeros & :: for consecutive zeros)
Loopback:   ::1  (equivalent to 127.0.0.1 in IPv4)`}
      </CodeBlock>

      <H2>Should You Add an AAAA Record?</H2>
      <P>Best practice is to add both A and AAAA records for any public-facing service. This is called "dual-stack" configuration:</P>
      <UL>
        <LI>IPv6-capable devices will use the AAAA record (often faster, no NAT)</LI>
        <LI>IPv4-only devices fall back to the A record seamlessly</LI>
        <LI>Improves performance for a growing portion of users</LI>
        <LI>Future-proofs your infrastructure</LI>
      </UL>
      <Note>Browsers implement "Happy Eyeballs" (RFC 6555) — they try IPv6 first and fall back to IPv4 almost instantly if IPv6 fails. This means adding a valid AAAA record never hurts performance.</Note>

      <H2>How to Create an AAAA Record</H2>
      <CodeBlock label="AAAA record setup (Cloudflare-style)">
{`Type:    AAAA
Name:    @          (root) or  www  (subdomain)
Content: 2606:4700:4700::1111
TTL:     Auto`}
      </CodeBlock>

      <H2>Common Mistakes</H2>
      <UL>
        <LI>Adding an AAAA record pointing to a server that doesn't actually have IPv6 enabled</LI>
        <LI>Misconfiguring the IPv6 address (check for typos — they're long!)</LI>
        <LI>Using a link-local IPv6 address (<InlineCode>fe80::</InlineCode>) which won't route on the public internet</LI>
      </UL>
      <Tip>Use <InlineCode>ping6 yourdomain.com</InlineCode> or <InlineCode>dig AAAA yourdomain.com</InlineCode> to verify your AAAA record is resolving correctly from the command line.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/a-record', title: 'A Record (IPv4)', desc: 'The IPv4 counterpart to AAAA records' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'Create hostname aliases' },
        { href: '/guides/domain-management/point-domain-to-server', title: 'Point a Domain to a Server', desc: 'Connect your domain to a web server' },
      ]} />
    </GuideLayout>
  );
}