import BlogLayout from '@/components/BlogLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, InArticleAd, RelatedArticles } from '@/components/GuideContent';
import { Link } from 'react-router-dom';

export default function WhatIsSubdomain() {
  return (
    <BlogLayout
      title="What is a Subdomain and Why Should You Use One?"
      description="Subdomains are one of the most useful tools in a developer's toolkit. Here's everything you need to know, in plain English."
      author="Open Domains Team"
      date="April 2026"
      category="DNS"
      tags={['subdomain', 'dns', 'beginners']}
      readTime={5}
    >
      <P>
        If you've spent any time on the web, you've used subdomains without even realising it. <InlineCode>mail.google.com</InlineCode>, <InlineCode>docs.github.com</InlineCode>, <InlineCode>app.notion.so</InlineCode> — these are all subdomains. Understanding how they work and when to use them is one of the most practical DNS skills you can develop.
      </P>

      <H2>So, What Actually Is a Subdomain?</H2>
      <P>
        A subdomain is an extension that goes in front of your main domain name, separated by a dot. If your domain is <InlineCode>example.com</InlineCode>, then <InlineCode>anything.example.com</InlineCode> is a subdomain — where "anything" is the subdomain label.
      </P>
      <P>
        From a DNS perspective, a subdomain is simply a hostname at a lower level in the DNS hierarchy. You create it by adding a DNS record (usually an A or CNAME record) with the subdomain name in the Name/Host field.
      </P>
      <CodeBlock label="Common subdomain examples">
{`www.example.com       → Traditional website prefix
blog.example.com      → Blog or content section  
app.example.com       → Web application
api.example.com       → API endpoint
staging.example.com   → Pre-production environment
docs.example.com      → Documentation`}
      </CodeBlock>

      <H2>Why Use Subdomains?</H2>
      <P>Subdomains let you organise your web presence in ways that are both technically useful and user-friendly:</P>
      <UL>
        <LI><strong>Separate services:</strong> Your main site, blog, and app can live on completely different servers</LI>
        <LI><strong>Different technologies:</strong> <InlineCode>api.yourdomain.com</InlineCode> can run Node.js while <InlineCode>yourdomain.com</InlineCode> runs a static site</LI>
        <LI><strong>Development environments:</strong> <InlineCode>staging.yourdomain.com</InlineCode> for testing, <InlineCode>yourdomain.com</InlineCode> for production</LI>
        <LI><strong>They're free:</strong> Subdomains are just DNS records — no extra cost</LI>
        <LI><strong>Clean URLs:</strong> Much cleaner than <InlineCode>yourdomain.com/app</InlineCode> when the "app" is actually a separate service</LI>
      </UL>

      <InArticleAd />

      <H2>Subdomains vs. Subdirectories</H2>
      <P>
        A question that comes up a lot: should your blog live at <InlineCode>blog.yourdomain.com</InlineCode> or <InlineCode>yourdomain.com/blog</InlineCode>? Both work, and the right answer depends on your setup.
      </P>
      <P>
        Use a subdomain when the service is truly separate — different technology, different server, deployed independently. Use a subdirectory when it's part of the same application and you want to keep SEO authority consolidated.
      </P>
      <Note>Google treats subdomains as separate entities for indexing purposes, though in practice the SEO difference is minimal for most sites. If SEO is critical, subdirectories are slightly safer; for everything else, use whichever is architecturally cleaner.</Note>

      <H2>Getting a Free Subdomain</H2>
      <P>
        If you don't have your own domain yet, you can get a free, professional subdomain through Open Domains. Subdomains like <InlineCode>myproject.is-a.dev</InlineCode> are hosted on Cloudflare's DNS network, reviewed by a real person, and completely free.
      </P>
      <div className="mt-4 mb-6">
        <Link to="/dashboard" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors">
          Request Your Free Subdomain →
        </Link>
      </div>
      <Tip>Free subdomains are perfect for side projects, portfolios, and experiments. When your project grows into a real product, you can migrate to your own domain and point it at the same server.</Tip>

      <RelatedArticles articles={[
        { href: '/guides/domain-management/subdomains-explained', title: 'Subdomains Deep Dive', desc: 'Full technical guide to subdomains' },
        { href: '/guides/domain-management/wildcard-dns', title: 'Wildcard DNS', desc: 'Cover all subdomains with one record' },
        { href: '/blog/how-to-set-up-a-website-for-free', title: 'Set Up a Website for Free', desc: 'Complete free website guide' },
      ]} />
    </BlogLayout>
  );
}