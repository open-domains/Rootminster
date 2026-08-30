import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function WhatIsNameserver() {
  return (
    <GuideLayout
      title="What is a Nameserver?"
      description="Nameservers are the backbone of DNS delegation. Learn how they work, why they matter, and how to change them."
      category="DNS Basics"
      lastUpdated="April 2026"
    >
      <H2>What is a Nameserver?</H2>
      <P>
        A nameserver is a server that stores DNS records for a domain and answers DNS queries about it. When someone types your domain into a browser, the DNS resolution process eventually reaches your nameserver to find out where your website, email, and other services live.
      </P>
      <P>
        Every domain has at least two nameservers (primary and secondary) for redundancy. These are set at your domain registrar and look something like this:
      </P>
      <CodeBlock label="Example nameservers">
{`ns1.cloudflare.com
ns2.cloudflare.com`}
      </CodeBlock>

      <H2>Authoritative vs. Recursive Nameservers</H2>
      <P>There are two fundamentally different types of nameservers:</P>
      <H3>Authoritative Nameservers</H3>
      <P>
        These are the servers that hold the actual DNS records for your domain. They're the final authority on what <InlineCode>yourdomain.com</InlineCode> resolves to. When a resolver asks "what's the IP for yourdomain.com?", the authoritative nameserver gives the definitive answer.
      </P>
      <H3>Recursive Resolvers (Recursive Nameservers)</H3>
      <P>
        These are the servers your computer talks to first. They don't hold records themselves — instead, they go out and find the answer on your behalf by querying root nameservers, TLD nameservers, and finally the authoritative nameserver. Your ISP provides one by default; alternatives include <InlineCode>1.1.1.1</InlineCode> (Cloudflare) and <InlineCode>8.8.8.8</InlineCode> (Google).
      </P>

      <InArticleAd />

      <H2>Root Nameservers</H2>
      <P>
        At the very top of the DNS hierarchy are 13 root nameserver clusters, labelled A through M. Despite the number "13" referring to IP addresses, there are actually hundreds of physical servers distributed worldwide using anycast routing. These servers know the nameservers for every TLD (<InlineCode>.com</InlineCode>, <InlineCode>.org</InlineCode>, <InlineCode>.net</InlineCode>, etc.) but don't hold records for individual domains.
      </P>

      <H2>How to Change Your Nameservers</H2>
      <P>You change nameservers at your domain registrar — the company where you bought your domain (GoDaddy, Namecheap, Google Domains, etc.). Here's the general process:</P>
      <UL>
        <LI>Log into your registrar account</LI>
        <LI>Find your domain in the dashboard</LI>
        <LI>Look for "Nameservers" or "DNS Settings"</LI>
        <LI>Replace the existing nameservers with the new ones</LI>
        <LI>Save and wait for propagation (up to 48 hours, usually much faster)</LI>
      </UL>
      <Warning>Changing nameservers moves all DNS control to the new provider. Make sure you've recreated all your existing DNS records on the new nameserver before switching, or your website and email could go offline.</Warning>

      <H2>Nameservers vs. DNS Records</H2>
      <P>
        People often confuse nameservers with DNS records. Here's the key difference: <strong>nameservers tell the internet where to find your DNS records</strong>. The DNS records themselves (A, CNAME, MX, etc.) live on those nameservers and tell the internet where your services are.
      </P>
      <P>
        Think of it like a library. The nameserver is the library building — it's where everything lives. The DNS records are the books inside — they contain the actual information you need.
      </P>

      <H2>Popular Nameserver Providers</H2>
      <UL>
        <LI><strong>Cloudflare</strong> — Fast, free, with DDoS protection and a CDN proxy option</LI>
        <LI><strong>AWS Route 53</strong> — Enterprise-grade, pay-per-query pricing</LI>
        <LI><strong>Google Cloud DNS</strong> — Reliable, integrated with GCP</LI>
        <LI><strong>Namecheap BasicDNS / PremiumDNS</strong> — Simple, beginner-friendly</LI>
        <LI><strong>Your registrar's nameservers</strong> — Most registrars provide free DNS hosting</LI>
      </UL>
      <Tip>Cloudflare's free nameservers are among the fastest in the world. If you're looking to speed up DNS resolution and get free DDoS protection, it's an excellent choice for any domain.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-basics/what-is-dns', title: 'What is DNS?', desc: 'The complete beginner guide to how DNS works' },
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation Explained', desc: 'Why changes take time to appear globally' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect a Domain to Cloudflare', desc: 'Step-by-step guide to using Cloudflare DNS' },
        { href: '/guides/dns-record-types/ns-record', title: 'NS Records', desc: 'How NS records delegate DNS control' },
      ]} />
    </GuideLayout>
  );
}