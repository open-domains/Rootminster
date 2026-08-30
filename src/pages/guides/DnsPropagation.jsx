import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, Warning, CodeBlock, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function DnsPropagation() {
  return (
    <GuideLayout
      title="DNS Propagation Explained"
      description="Why do DNS changes take time? Learn what propagation means, how long it takes, and how to check whether your changes are live."
      category="DNS Basics"
      lastUpdated="April 2026"
    >
      <H2>What is DNS Propagation?</H2>
      <P>
        DNS propagation is the process by which DNS record changes spread across the global network of DNS resolvers and caches. When you change a DNS record — like updating an A record to point to a new server — that change doesn't appear everywhere at once. Instead, it gradually "propagates" across the internet as different resolvers refresh their cached data.
      </P>
      <P>
        You've probably experienced this before: you update a DNS record, it works immediately on your phone but not your laptop, or it works in the UK but not the US. This is propagation at work — different resolvers around the world are working from different cached values.
      </P>

      <H2>Why Doesn't DNS Update Instantly?</H2>
      <P>
        DNS uses caching to reduce load on servers and speed up lookups for users. Every DNS record has a TTL (Time To Live) value — the number of seconds a resolver is allowed to cache that record. Until that TTL expires, resolvers will continue serving the old cached value, regardless of what's now on your authoritative nameserver.
      </P>
      <P>
        For example, if your A record has a TTL of 3600 (1 hour), resolvers that recently cached it will continue serving the old IP for up to an hour. After the TTL expires, they'll fetch fresh data from your nameserver. If some resolvers cached it just before you made the change, they could serve the old IP for almost a full hour. Others that cached it hours ago may already be seeing the new value.
      </P>

      <H2>How Long Does Propagation Take?</H2>
      <UL>
        <LI><strong>With a low TTL (300 seconds / 5 minutes):</strong> Most of the world should see changes within 15–30 minutes</LI>
        <LI><strong>With a default TTL (3600 / 1 hour):</strong> Generally 1–4 hours for most users</LI>
        <LI><strong>With a high TTL (86400 / 24 hours):</strong> Could take up to 48 hours globally</LI>
        <LI><strong>Nameserver changes:</strong> These can take the full 24–48 hours due to registrar processing</LI>
      </UL>
      <Note>The commonly quoted "24–48 hours" is a worst-case scenario for most DNS changes. In practice, with a low TTL, changes typically propagate within an hour for most users worldwide.</Note>

      <InArticleAd />

      <H2>How to Speed Up Propagation</H2>
      <P>The best way to minimise propagation time is to lower your TTL before making changes:</P>
      <UL>
        <LI>At least 24 hours before the change, set your record's TTL to 300 (5 minutes)</LI>
        <LI>Make your DNS change</LI>
        <LI>Wait for the old TTL to expire (at most the previous TTL value)</LI>
        <LI>After the change is confirmed working, raise TTL back to 3600 or higher</LI>
      </UL>
      <Tip>Cloudflare's DNS is particularly fast at propagation — changes made through Cloudflare typically appear globally within 5 minutes, even with higher TTLs, because Cloudflare uses a massive distributed network.</Tip>

      <H2>How to Check DNS Propagation</H2>
      <P>There are several tools to check whether your DNS changes are live in different locations:</P>
      <UL>
        <LI><strong>dnschecker.org</strong> — Check a record from 100+ locations worldwide</LI>
        <LI><strong>whatsmydns.net</strong> — Visual propagation checker with a world map</LI>
        <LI><strong>dig</strong> (command line) — Query specific DNS servers directly</LI>
        <LI><strong>nslookup</strong> (Windows/Mac/Linux) — Basic DNS lookup tool</LI>
      </UL>
      <CodeBlock label="Check DNS with dig">
{`# Check your A record against Cloudflare's DNS
dig @1.1.1.1 yourdomain.com A

# Check propagation against Google's DNS
dig @8.8.8.8 yourdomain.com A

# Check with short output
dig yourdomain.com A +short`}
      </CodeBlock>

      <H2>Common Propagation Questions</H2>
      <H2>Why can I see the change but others can't?</H2>
      <P>
        Your local resolver may have fetched the new record already (or you have a low local cache TTL), while others are still holding the old cached value. This is completely normal during propagation.
      </P>
      <H2>Why can I see the change in some countries but not others?</H2>
      <P>
        Propagation isn't uniform — it depends on when each resolver last cached your record and what its TTL was at that point. Resolvers in different regions update at different times.
      </P>
      <Warning>Don't make rapid successive changes to a DNS record during propagation. This creates confusion where some resolvers see version 1, some see version 2, and some see version 3. Make one change, wait for it to propagate, then make the next.</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-basics/what-is-dns', title: 'What is DNS?', desc: 'How the Domain Name System works' },
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'Fix common DNS resolution problems' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Use Cloudflare for fast DNS management' },
      ]} />
    </GuideLayout>
  );
}