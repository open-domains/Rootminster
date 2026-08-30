import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';
import { Link } from 'react-router-dom';

export default function SubdomainsExplained() {
  return (
    <GuideLayout
      title="Subdomains Explained"
      description="What are subdomains, why should you use them, and how do you set them up? A complete guide for beginners and developers."
      category="Domain Management"
      lastUpdated="April 2026"
    >
      <H2>What is a Subdomain?</H2>
      <P>
        A subdomain is a prefix added to your root domain, separated by a dot. If your domain is <InlineCode>example.com</InlineCode>, then <InlineCode>blog.example.com</InlineCode>, <InlineCode>app.example.com</InlineCode>, and <InlineCode>api.example.com</InlineCode> are all subdomains. Subdomains are a free, flexible way to organise your web presence without buying additional domains.
      </P>
      <CodeBlock label="Subdomain examples">
{`www.example.com        → Main website (traditional)
blog.example.com       → Blog section
app.example.com        → Web application
api.example.com        → REST/GraphQL API
staging.example.com    → Staging environment
docs.example.com       → Documentation
mail.example.com       → Mail server
cdn.example.com        → Content delivery`}
      </CodeBlock>

      <H2>Why Use Subdomains?</H2>
      <UL>
        <LI><strong>Organisation:</strong> Separate different services clearly without multiple domain purchases</LI>
        <LI><strong>Different servers:</strong> Each subdomain can point to a completely different server or service</LI>
        <LI><strong>Environments:</strong> <InlineCode>staging.app.com</InlineCode> vs <InlineCode>app.com</InlineCode> — deploy preview and production separately</LI>
        <LI><strong>Team ownership:</strong> Different teams manage different subdomains independently</LI>
        <LI><strong>Free:</strong> Creating subdomains costs nothing — they're just DNS records</LI>
      </UL>

      <InArticleAd />

      <H2>How to Create a Subdomain</H2>
      <P>Creating a subdomain is as simple as adding a DNS record:</P>
      <CodeBlock label="Creating subdomains in DNS">
{`# Point blog subdomain to a server
Type: A
Name: blog
Value: 203.0.113.42
TTL: 3600

# Point app subdomain to a Vercel deployment
Type: CNAME
Name: app
Value: cname.vercel-dns.com.
TTL: 3600

# Point api subdomain to a different server
Type: A
Name: api
Value: 203.0.113.99
TTL: 3600`}
      </CodeBlock>

      <H2>Subdomains vs. Subdirectories</H2>
      <P>
        A common question for website owners: should your blog be at <InlineCode>blog.example.com</InlineCode> (subdomain) or <InlineCode>example.com/blog</InlineCode> (subdirectory)?
      </P>
      <UL>
        <LI><strong>Subdomain pros:</strong> Can be on a completely different server, different framework, independently deployed</LI>
        <LI><strong>Subdomain cons:</strong> Google historically treated subdomains as separate sites (less shared SEO equity)</LI>
        <LI><strong>Subdirectory pros:</strong> All SEO equity rolls up to one domain, simpler setup for same-server deployments</LI>
        <LI><strong>Subdirectory cons:</strong> Must be served from the same server/application</LI>
      </UL>
      <Note>Google has stated that it now treats subdomains similarly to subdirectories for most purposes. For a blog or docs site on a different platform, a subdomain is perfectly fine from an SEO perspective.</Note>

      <H2>Infinite Subdomain Depth</H2>
      <P>
        You can technically create multiple levels of subdomains: <InlineCode>dev.api.example.com</InlineCode>, <InlineCode>v2.api.example.com</InlineCode>, etc. However, most use cases only need one level deep. Deep nesting can confuse users and create complex DNS management.
      </P>

      <H2>Free Subdomains with Open Domains</H2>
      <P>
        Don't have your own domain yet? Open Domains provides free subdomains on shared root domains like <InlineCode>*.is-a.dev</InlineCode>. Perfect for developers who want a professional URL without buying a domain.
      </P>
      <div className="mt-4">
        <Link to="/dashboard" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors">
          Get a Free Subdomain →
        </Link>
      </div>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/domain-management/wildcard-dns', title: 'Wildcard DNS', desc: 'Cover all subdomains with one record' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'Point subdomains to other services' },
        { href: '/guides/hosting-providers/vercel', title: 'Hosting on Vercel', desc: 'Deploy per subdomain with Vercel' },
      ]} />
    </GuideLayout>
  );
}