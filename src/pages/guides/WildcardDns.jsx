import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function WildcardDns() {
  return (
    <GuideLayout
      title="Wildcard DNS — Everything You Need to Know"
      description="A wildcard DNS record matches any subdomain. Learn how to use wildcard records, their limitations, and real-world applications."
      category="Domain Management"
      lastUpdated="April 2026"
    >
      <H2>What is a Wildcard DNS Record?</H2>
      <P>
        A wildcard DNS record uses an asterisk (<InlineCode>*</InlineCode>) as the leftmost label to match any subdomain that doesn't have a more specific record. For example, <InlineCode>*.example.com</InlineCode> would match <InlineCode>anything.example.com</InlineCode>, <InlineCode>random.example.com</InlineCode>, <InlineCode>test.example.com</InlineCode> — any subdomain that isn't explicitly defined.
      </P>
      <CodeBlock label="Wildcard DNS record">
{`*.example.com. 3600 IN A 203.0.113.42
# All subdomains of example.com resolve to 203.0.113.42
# unless a more specific record exists`}
      </CodeBlock>

      <H2>How Wildcard Records Work</H2>
      <P>Wildcards follow DNS specificity rules — more specific records always win:</P>
      <CodeBlock label="Wildcard vs. specific records">
{`*.example.com   A  203.0.113.42   # wildcard (catch-all)
www.example.com A  203.0.113.1    # specific (takes priority for www)
app.example.com A  203.0.113.99   # specific (takes priority for app)

# Result:
# www.example.com → 203.0.113.1  (specific record wins)
# app.example.com → 203.0.113.99 (specific record wins)
# foo.example.com → 203.0.113.42 (wildcard matches)
# xyz.example.com → 203.0.113.42 (wildcard matches)`}
      </CodeBlock>

      <InArticleAd />

      <H2>Real-World Uses for Wildcard DNS</H2>
      <UL>
        <LI><strong>Multi-tenant SaaS apps:</strong> Give each customer their own subdomain (<InlineCode>customer1.yourapp.com</InlineCode>) without creating individual DNS records</LI>
        <LI><strong>Dynamic preview environments:</strong> Deploy each pull request to a unique URL like <InlineCode>pr-123.staging.yourapp.com</InlineCode></LI>
        <LI><strong>Development environments:</strong> Route any <InlineCode>*.dev.example.com</InlineCode> to your local dev server</LI>
        <LI><strong>CDN edge caching:</strong> Serve assets from any subdomain through your CDN</LI>
      </UL>

      <H2>Wildcard SSL Certificates</H2>
      <P>
        A wildcard SSL certificate covers all first-level subdomains of a domain. A certificate for <InlineCode>*.example.com</InlineCode> covers <InlineCode>www.example.com</InlineCode>, <InlineCode>blog.example.com</InlineCode>, <InlineCode>app.example.com</InlineCode>, etc. — but not deeper nesting like <InlineCode>dev.api.example.com</InlineCode>.
      </P>
      <CodeBlock label="Getting a wildcard certificate with Certbot">
{`# Requires DNS challenge (not HTTP challenge)
sudo certbot certonly --manual --preferred-challenges dns -d "*.example.com" -d example.com

# Certbot will ask you to add a TXT record:
# _acme-challenge.example.com TXT "some-verification-string"`}
      </CodeBlock>
      <Tip>Cloudflare users can get wildcard certificates automatically with Cloudflare's proxying enabled. The Cloudflare Universal SSL certificate covers <InlineCode>*.yourdomain.com</InlineCode> for free.</Tip>

      <H2>Limitations of Wildcard Records</H2>
      <UL>
        <LI>Only matches one level deep — <InlineCode>*.example.com</InlineCode> won't match <InlineCode>a.b.example.com</InlineCode></LI>
        <LI>Can't be CNAME on the root domain</LI>
        <LI>All wildcard-matched subdomains go to the same destination — you can't differentiate within the wildcard</LI>
        <LI>Your application must handle the subdomain routing logic (e.g., read the <InlineCode>Host</InlineCode> header)</LI>
      </UL>
      <Warning>Using a wildcard on a public domain means anyone could type any subdomain and get a response from your server. Make sure your application handles unknown subdomains gracefully (e.g., 404 or redirect to main site).</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/domain-management/subdomains-explained', title: 'Subdomains Explained', desc: 'Understand how subdomains work' },
        { href: '/guides/dns-record-types/a-record', title: 'A Record', desc: 'The record type used for most wildcard setups' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Issues', desc: 'Fix wildcard certificate problems' },
      ]} />
    </GuideLayout>
  );
}