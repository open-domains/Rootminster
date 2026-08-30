import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function DnsNotResolving() {
  return (
    <GuideLayout
      title="DNS Not Resolving — Troubleshooting Guide"
      description="Your domain isn't resolving? Work through this step-by-step checklist to diagnose and fix common DNS resolution problems."
      category="Troubleshooting"
      lastUpdated="April 2026"
    >
      <H2>Before You Start</H2>
      <P>DNS issues can be frustrating because the problem can exist at multiple levels. Work through this guide systematically from top to bottom.</P>

      <H2>Step 1: Check If It's a Propagation Delay</H2>
      <P>If you recently made a DNS change, it may simply not have propagated yet. Check the current status globally:</P>
      <CodeBlock label="Check DNS from multiple locations">
{`# Check from your machine
dig yourdomain.com A +short

# Query specific resolvers to compare
dig @1.1.1.1 yourdomain.com A +short   # Cloudflare
dig @8.8.8.8 yourdomain.com A +short   # Google
dig @9.9.9.9 yourdomain.com A +short   # Quad9

# If they return different values, propagation is still in progress`}
      </CodeBlock>
      <Note>Use <InlineCode>dnschecker.org</InlineCode> to check from 100+ global locations at once. If some show the old record and some show the new, propagation is in progress — wait and check again in 30 minutes.</Note>

      <H2>Step 2: Verify Your DNS Records Are Correct</H2>
      <P>Log into your DNS provider and double-check:</P>
      <UL>
        <LI>The record type is correct (A for IP addresses, CNAME for hostnames)</LI>
        <LI>The record name is correct (<InlineCode>@</InlineCode> for root, or the exact subdomain)</LI>
        <LI>The value has no typos (especially for IPs)</LI>
        <LI>The record is published/saved (not just in draft)</LI>
        <LI>The TTL isn't set to something extremely high (86400+) that would delay updates</LI>
      </UL>

      <InArticleAd />

      <H2>Step 3: Check Nameservers Are Set Correctly</H2>
      <CodeBlock label="Check nameservers">
{`# Check what nameservers your domain is using
dig yourdomain.com NS +short
# or
nslookup -type=NS yourdomain.com

# These should match what you have set at your registrar
# If they point to the wrong provider, update at your registrar`}
      </CodeBlock>

      <H2>Step 4: Flush DNS Cache</H2>
      <P>Your local machine or router may have a cached old record:</P>
      <CodeBlock label="Flush DNS cache by OS">
{`# Windows
ipconfig /flushdns

# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux (systemd-resolved)
sudo resolvectl flush-caches

# Or try in incognito/private browsing mode
# Or try on your mobile data connection (different resolver)`}
      </CodeBlock>

      <H2>Step 5: Check for CNAME Conflicts</H2>
      <P>CNAME records conflict with other record types on the same hostname. If you have a CNAME, you can't also have MX, TXT, or A records on the same name. Check for conflicts:</P>
      <CodeBlock label="Check all record types for a hostname">
{`dig yourdomain.com ANY
# Look for conflicting CNAME + other record types on the same name`}
      </CodeBlock>

      <H2>Step 6: Test NXDOMAIN vs. No Response</H2>
      <UL>
        <LI><strong>NXDOMAIN:</strong> The domain doesn't exist. Check your registrar — domain may have expired, or NS records are wrong.</LI>
        <LI><strong>SERVFAIL:</strong> The authoritative nameserver returned an error. Check your DNS provider's status page.</LI>
        <LI><strong>NOERROR with no records:</strong> The domain resolves but the record type doesn't exist. You may have created the wrong record type.</LI>
        <LI><strong>Timeout:</strong> Network issue or nameserver unreachable. Try a different DNS resolver.</LI>
      </UL>
      <Tip>If your domain recently expired, you need to renew it at your registrar. DNS records won't resolve for an expired domain even if everything else looks correct.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation Explained', desc: 'Why changes take time' },
        { href: '/guides/troubleshooting/cloudflare-proxy-problems', title: 'Cloudflare Proxy Problems', desc: 'Fix Cloudflare-specific issues' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Issues', desc: 'Fix HTTPS certificate problems' },
      ]} />
    </GuideLayout>
  );
}