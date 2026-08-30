import BlogLayout from '@/components/BlogLayout';
import { H2, P, Tip, Warning, CodeBlock, InlineCode, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function CommonDnsMistakes() {
  return (
    <BlogLayout
      title="Common DNS Mistakes Beginners Make (And How to Fix Them)"
      description="Setting up DNS for the first time? These are the mistakes almost everyone makes — and exactly how to avoid them."
      author="Open Domains Team"
      date="April 2026"
      category="DNS"
      tags={['dns', 'beginners', 'troubleshooting']}
      readTime={6}
    >
      <P>
        DNS looks simple — you're just pointing a domain name to an IP, right? In practice, DNS has enough subtle rules and gotchas that almost everyone makes at least one mistake when they first set it up. Here are the most common ones, and how to fix them fast.
      </P>

      <H2>Mistake 1: CNAME on the Root Domain</H2>
      <P>
        The most common mistake. You want <InlineCode>yourdomain.com</InlineCode> to point to your Netlify site, so you create a CNAME record with name <InlineCode>@</InlineCode> pointing to <InlineCode>yoursite.netlify.app</InlineCode>. This is technically invalid according to DNS specifications (RFC 1912).
      </P>
      <P><strong>Why it breaks:</strong> CNAME records on the apex (root) domain prevent any other records from being set on that name — including MX (email) and NS (nameserver) records. Some DNS providers accept it, others silently ignore it, and others corrupt your zone.</P>
      <P><strong>Fix:</strong> Use an A record for the root domain (pointing to the service's IP), or use a DNS provider that supports CNAME flattening (Cloudflare calls theirs "CNAME Flattening" — it resolves the CNAME to an IP behind the scenes).</P>
      <Warning>If you have a CNAME on your root domain and email isn't working, this is almost certainly why. Remove the CNAME and use an A record instead.</Warning>

      <H2>Mistake 2: Forgetting to Set a TTL Before Migration</H2>
      <P>
        You're migrating servers. You update the A record to the new IP. But your old TTL was 86400 (24 hours) — meaning up to 50% of your users could still see the old IP for up to a day after the change.
      </P>
      <P><strong>Fix:</strong> At least 24 hours before any planned migration, lower your TTL to 300 (5 minutes). After migration, raise it back. This gives you fast propagation without permanently impacting DNS performance.</P>

      <InArticleAd />

      <H2>Mistake 3: Multiple SPF Records</H2>
      <P>
        You're using Google Workspace for email, and you also just added Mailchimp. So you add a second TXT record: <InlineCode>v=spf1 include:mailchimp.com ~all</InlineCode>. Now you have two SPF records. This breaks SPF — receivers only look at the first SPF record and ignore the rest, or mark your emails as failing SPF.
      </P>
      <P><strong>Fix:</strong> Merge all your sending services into a single SPF record:</P>
      <CodeBlock label="Correct: one SPF record with multiple includes">
{`v=spf1 include:_spf.google.com include:mailchimp.com include:sendgrid.net ~all`}
      </CodeBlock>

      <H2>Mistake 4: Proxying Email Records Through Cloudflare</H2>
      <P>
        You added your domain to Cloudflare and happily turned on the orange cloud for every record. Now email is broken. Cloudflare's proxy handles HTTP/HTTPS traffic only — SMTP (email) cannot be proxied.
      </P>
      <P><strong>Fix:</strong> In Cloudflare, set all mail-related records to DNS Only (grey cloud): your MX records' targets, and any A record for a <InlineCode>mail.</InlineCode> subdomain.</P>

      <H2>Mistake 5: Pointing CNAME to an IP Address</H2>
      <P>
        A CNAME must point to a hostname, not an IP. <InlineCode>www CNAME 203.0.113.42</InlineCode> is invalid. CNAME values must be fully qualified domain names.
      </P>
      <P><strong>Fix:</strong> If you have an IP, use an A record. CNAME is only for aliasing one hostname to another hostname.</P>

      <H2>Mistake 6: Not Removing Old Records When Switching Providers</H2>
      <P>
        You switch from Google Workspace to ProtonMail. You add the new MX records but forget to delete the old Google MX records. Now your domain has both sets of MX records, and email delivery becomes unpredictable — some emails go to Google, some go to ProtonMail.
      </P>
      <P><strong>Fix:</strong> Always clean up old records when switching. Do a full audit before and after any provider change.</P>

      <H2>Mistake 7: Ignoring Propagation</H2>
      <P>
        You make a change, check immediately, it doesn't work, and you change it again. Now you have multiple changes in flight and no idea which state the world is in.
      </P>
      <P><strong>Fix:</strong> Make one change at a time. Use <InlineCode>dnschecker.org</InlineCode> to check propagation status globally before concluding something is broken.</P>
      <Tip>When diagnosing DNS issues, always specify which DNS server you're querying: <InlineCode>dig @1.1.1.1 yourdomain.com A</InlineCode>. Your local resolver cache may be stale.</Tip>

      <RelatedArticles articles={[
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'Full troubleshooting guide' },
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation Explained', desc: 'Why changes take time' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record Guide', desc: 'Rules and limitations of CNAMEs' },
      ]} />
    </BlogLayout>
  );
}