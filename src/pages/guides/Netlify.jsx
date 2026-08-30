import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Note, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function Netlify() {
  return (
    <GuideLayout
      title="Hosting on Netlify — Setup & DNS Guide"
      description="Netlify is a powerful platform for deploying static sites and web apps. Learn how to deploy and configure custom domains with correct DNS settings."
      category="Hosting Providers"
      lastUpdated="April 2026"
    >
      <H2>What is Netlify?</H2>
      <P>Netlify is a web hosting and serverless backend platform that pioneered the JAMstack architecture. It's been a favourite of developers since 2015 for its simplicity, powerful features, and generous free tier.</P>
      <H3>Pros</H3>
      <UL>
        <LI>Simple drag-and-drop deployment for static sites</LI>
        <LI>Git-based CI/CD with automatic deployments</LI>
        <LI>Netlify Functions (serverless AWS Lambda under the hood)</LI>
        <LI>Form handling, identity, split testing — all built in</LI>
        <LI>Free tier includes 100GB bandwidth and 300 build minutes/month</LI>
        <LI>Deploy previews for every PR</LI>
        <LI>Built-in redirects and custom headers via <InlineCode>_redirects</InlineCode> file</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>Slower build times compared to Vercel</LI>
        <LI>Less Next.js optimisation than Vercel</LI>
        <LI>Bandwidth limits are strict on free tier</LI>
      </UL>
      <H3>Best For</H3>
      <UL>
        <LI>Static sites, portfolios, documentation</LI>
        <LI>Gatsby, Eleventy, Hugo, Jekyll sites</LI>
        <LI>Projects using Netlify CMS or form handling</LI>
        <LI>Teams wanting an all-in-one platform</LI>
      </UL>

      <InArticleAd />

      <H2>Deploying to Netlify</H2>
      <CodeBlock label="Deploy via CLI">
{`# Install Netlify CLI
npm install -g netlify-cli

# Login and deploy
netlify login
netlify deploy

# Or drag-and-drop your build folder at app.netlify.com
# Or connect a GitHub repo in the Netlify dashboard`}
      </CodeBlock>

      <H2>DNS Configuration for Custom Domain</H2>
      <H3>Using a Subdomain (CNAME)</H3>
      <CodeBlock label="CNAME for Netlify">
{`Type:  CNAME
Name:  www
Value: yoursite.netlify.app.`}
      </CodeBlock>
      <H3>Using Root Domain (Netlify DNS or A Record)</H3>
      <CodeBlock label="A record for Netlify root domain">
{`# Netlify load-balanced IPs (check Netlify docs for current IPs)
Type: A
Name: @
Value: 75.2.60.5

# Or use Netlify DNS (recommended for full feature support)
# Change your nameservers to Netlify's at your registrar`}
      </CodeBlock>
      <Note>Netlify recommends using Netlify DNS (changing your nameservers to Netlify) for the best experience. This enables features like automatic SSL provisioning and Netlify's global CDN routing.</Note>

      <H2>Netlify Redirects</H2>
      <P>Netlify's redirect engine is one of the best in the industry. Add a <InlineCode>_redirects</InlineCode> file to your build output:</P>
      <CodeBlock label="_redirects file examples">
{`# Simple redirect
/old-page    /new-page    301

# SPA fallback (important for React/Vue apps)
/*    /index.html    200

# Country-based redirect
/   /en    302    Country=US
/   /de    302    Country=DE`}
      </CodeBlock>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/hosting-providers/vercel', title: 'Vercel', desc: 'Compare with Netlify' },
        { href: '/guides/hosting-providers/github-pages', title: 'GitHub Pages', desc: 'Free hosting for open-source projects' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'How CNAME records work' },
      ]} />
    </GuideLayout>
  );
}