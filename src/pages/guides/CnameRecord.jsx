import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Note, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function CnameRecord() {
  return (
    <GuideLayout
      title="CNAME Record — Complete Guide"
      description="CNAME records create aliases between hostnames. Learn when to use them, how they work, and the critical rules around CNAME placement."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is a CNAME Record?</H2>
      <P>
        A CNAME (Canonical Name) record creates an alias from one hostname to another. Instead of mapping directly to an IP address like an A record, a CNAME points to another hostname that eventually resolves to an IP. The name you're aliasing is called the "alias", and the hostname it points to is the "canonical name."
      </P>
      <CodeBlock label="CNAME Record example">
{`www.example.com.  3600  IN  CNAME  example.com.
blog.example.com. 3600  IN  CNAME  mysite.wordpress.com.
shop.example.com. 3600  IN  CNAME  myshop.myshopify.com.`}
      </CodeBlock>

      <H2>When to Use a CNAME Record</H2>
      <P>CNAME records are ideal when:</P>
      <UL>
        <LI>You're hosting with a platform like Vercel, Netlify, or GitHub Pages that gives you a hostname (not an IP)</LI>
        <LI>You want multiple subdomains to point to the same place without maintaining multiple A records</LI>
        <LI>The destination IP address changes frequently and the provider manages it</LI>
        <LI>You want <InlineCode>www.yourdomain.com</InlineCode> to resolve the same as <InlineCode>yourdomain.com</InlineCode></LI>
      </UL>

      <H2>Real-World Examples</H2>
      <H3>Hosting on Vercel</H3>
      <CodeBlock label="CNAME for Vercel deployment">
{`# Point your subdomain to your Vercel deployment
www.myapp.com. CNAME cname.vercel-dns.com.`}
      </CodeBlock>
      <H3>Hosting on GitHub Pages</H3>
      <CodeBlock label="CNAME for GitHub Pages">
{`# Point a custom domain to GitHub Pages
www.myblog.com. CNAME yourusername.github.io.`}
      </CodeBlock>

      <InArticleAd />

      <H2>Critical Rules for CNAME Records</H2>
      <Warning>
        CNAME records cannot be used on the root (apex) domain. You cannot set <InlineCode>example.com</InlineCode> itself as a CNAME — only subdomains like <InlineCode>www.example.com</InlineCode>. This is a fundamental DNS specification requirement.
      </Warning>
      <UL>
        <LI><strong>No root domain CNAME:</strong> <InlineCode>example.com CNAME something.else.com</InlineCode> is invalid</LI>
        <LI><strong>No mixing:</strong> A hostname with a CNAME cannot have any other records. No MX, no A, no TXT on the same name.</LI>
        <LI><strong>No pointing to IPs:</strong> CNAME values must be hostnames, never IP addresses</LI>
        <LI><strong>No CNAME chains (avoid):</strong> CNAME pointing to another CNAME is technically allowed but adds latency and is bad practice</LI>
      </UL>
      <Note>The root domain CNAME problem is why Cloudflare invented "CNAME flattening" (also called ALIAS or ANAME records). Cloudflare resolves the CNAME to an IP at their edge and serves it as an A record, making root domain aliases possible.</Note>

      <H2>CNAME Lookup Process</H2>
      <P>When a browser looks up <InlineCode>www.example.com</InlineCode> and it's a CNAME:</P>
      <UL>
        <LI>DNS resolver finds <InlineCode>www.example.com CNAME example.com</InlineCode></LI>
        <LI>Resolver then looks up <InlineCode>example.com</InlineCode> to find its A record</LI>
        <LI>Returns the final IP address to the browser</LI>
        <LI>Extra lookup happens — CNAME adds one round trip vs. a direct A record</LI>
      </UL>

      <H2>Common Mistakes</H2>
      <UL>
        <LI>Setting a CNAME on the root domain — this breaks your entire domain</LI>
        <LI>Creating MX records on a hostname that has a CNAME — email will stop working</LI>
        <LI>Forgetting the trailing dot in zone files (providers usually handle this for you)</LI>
        <LI>Creating CNAME chains that add unnecessary DNS lookups</LI>
        <LI>Pointing CNAME to an IP address — use an A record instead</LI>
      </UL>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/a-record', title: 'A Record', desc: 'Direct IP mapping for domains' },
        { href: '/guides/hosting-providers/vercel', title: 'Hosting on Vercel', desc: 'Set up custom domains with Vercel' },
        { href: '/guides/hosting-providers/github-pages', title: 'GitHub Pages', desc: 'Connect a custom domain to GitHub Pages' },
        { href: '/guides/domain-management/subdomains-explained', title: 'Subdomains Explained', desc: 'How subdomains work' },
      ]} />
    </GuideLayout>
  );
}