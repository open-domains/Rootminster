import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Note, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function Vercel() {
  return (
    <GuideLayout
      title="Hosting on Vercel — Setup & DNS Guide"
      description="Vercel is the leading platform for frontend deployment. Learn how to deploy your project and connect a custom domain with the right DNS settings."
      category="Hosting Providers"
      lastUpdated="April 2026"
    >
      <H2>What is Vercel?</H2>
      <P>Vercel is a cloud platform for deploying frontend applications and serverless functions. It was built by the creators of Next.js and has first-class support for it, but also works excellently with React, Vue, Svelte, Nuxt, SvelteKit, Astro, and more.</P>
      <H3>Pros</H3>
      <UL>
        <LI>Incredibly fast deployments (usually under 30 seconds)</LI>
        <LI>Preview deployments for every Git branch and PR</LI>
        <LI>First-class Next.js support (SSR, ISR, API routes)</LI>
        <LI>Serverless functions built in</LI>
        <LI>Excellent developer experience and dashboard</LI>
        <LI>Generous free tier (Hobby plan)</LI>
        <LI>Automatic SSL and global CDN</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>Commercial projects require a paid plan</LI>
        <LI>Serverless function execution limits on free tier</LI>
        <LI>Bandwidth limits on Hobby plan (100GB/month)</LI>
      </UL>
      <H3>Best For</H3>
      <UL>
        <LI>Next.js applications (its native platform)</LI>
        <LI>React, Vue, Svelte, Astro apps</LI>
        <LI>Projects needing SSR or API routes</LI>
        <LI>Teams wanting fast CI/CD deployment workflows</LI>
      </UL>

      <InArticleAd />

      <H2>Deploying to Vercel</H2>
      <CodeBlock label="Deploy via CLI">
{`# Install Vercel CLI
npm i -g vercel

# Deploy from your project directory
vercel

# Follow prompts to link your project
# Or push to GitHub and connect repo in dashboard`}
      </CodeBlock>

      <H2>DNS Configuration for Custom Domain</H2>
      <P>Vercel gives you two options for custom domain DNS:</P>
      <H3>Option 1: CNAME (Recommended for subdomains)</H3>
      <CodeBlock label="CNAME record for Vercel">
{`Type:  CNAME
Name:  www
Value: cname.vercel-dns.com.`}
      </CodeBlock>
      <H3>Option 2: A Record (For root domain)</H3>
      <CodeBlock label="A record for Vercel root domain">
{`Type:  A
Name:  @
Value: 76.76.21.21`}
      </CodeBlock>
      <Note>For the root domain, Vercel recommends using their A record IP (<InlineCode>76.76.21.21</InlineCode>). For subdomains like <InlineCode>www</InlineCode>, use the CNAME pointing to <InlineCode>cname.vercel-dns.com</InlineCode>.</Note>

      <H2>Connecting the Domain in Vercel Dashboard</H2>
      <UL>
        <LI>Go to your project in Vercel dashboard</LI>
        <LI>Settings → Domains → Add Domain</LI>
        <LI>Enter your domain (e.g., <InlineCode>yourdomain.com</InlineCode>)</LI>
        <LI>Vercel will show you the DNS records to add</LI>
        <LI>Add the records at your DNS provider</LI>
        <LI>Vercel automatically provisions an SSL certificate once DNS propagates</LI>
      </UL>
      <Tip>If you use Vercel's nameservers instead of your current DNS provider, Vercel automatically manages all DNS for you, including automatic updates when you connect new services.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/hosting-providers/netlify', title: 'Netlify', desc: 'Alternative to Vercel for static sites' },
        { href: '/guides/hosting-providers/cloudflare-pages', title: 'Cloudflare Pages', desc: 'CDN-first static hosting' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'How CNAME records work' },
      ]} />
    </GuideLayout>
  );
}