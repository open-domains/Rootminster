import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Note, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function CloudflarePages() {
  return (
    <GuideLayout
      title="Cloudflare Pages — Setup & DNS Guide"
      description="Cloudflare Pages is a free, fast static site hosting platform. Learn how to deploy your site and configure a custom domain."
      category="Hosting Providers"
      lastUpdated="April 2026"
    >
      <H2>What is Cloudflare Pages?</H2>
      <P>Cloudflare Pages is a JAMstack hosting platform built directly into Cloudflare's global network. Unlike competitors, your site is served from Cloudflare's edge — meaning it's delivered from data centres near your visitors worldwide, not from a single server. The free plan is very generous.</P>
      <H3>Pros</H3>
      <UL>
        <LI>Unlimited bandwidth on the free plan</LI>
        <LI>Global CDN — served from 300+ locations</LI>
        <LI>Automatic HTTPS with no configuration</LI>
        <LI>Direct Git integration (GitHub, GitLab)</LI>
        <LI>Preview deployments for every branch/PR</LI>
        <LI>Cloudflare Workers for serverless functions</LI>
        <LI>No cold starts (unlike some serverless platforms)</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>Only static sites and JAMstack (no traditional server-side rendering without Workers)</LI>
        <LI>Build times limited on free tier (500 builds/month)</LI>
        <LI>Less mature ecosystem than Vercel/Netlify for some frameworks</LI>
      </UL>
      <H3>Best For</H3>
      <UL>
        <LI>Static HTML/CSS/JS sites</LI>
        <LI>React, Vue, Svelte, Astro apps</LI>
        <LI>Documentation sites</LI>
        <LI>Marketing and landing pages</LI>
      </UL>

      <InArticleAd />

      <H2>Step-by-Step: Deploy to Cloudflare Pages</H2>
      <UL>
        <LI>Push your project to GitHub or GitLab</LI>
        <LI>Log into Cloudflare Dashboard → Pages → Create a project</LI>
        <LI>Connect your GitHub/GitLab account and select the repository</LI>
        <LI>Configure the build settings for your framework</LI>
      </UL>
      <CodeBlock label="Build settings by framework">
{`# React (Create React App)
Build command: npm run build
Build output: /build

# Vite (React/Vue/Svelte)
Build command: npm run build
Build output: /dist

# Astro
Build command: npm run build
Build output: /dist

# Next.js (static export)
Build command: npm run build && npm run export
Build output: /out`}
      </CodeBlock>

      <H2>DNS Configuration for Custom Domain</H2>
      <P>After deploying, add a custom domain in the Pages dashboard. Cloudflare provides CNAME targets:</P>
      <CodeBlock label="DNS setup for Cloudflare Pages">
{`# For root domain (Cloudflare auto-configures with CNAME flattening)
Type: CNAME
Name: @
Value: yourproject.pages.dev

# For www subdomain
Type: CNAME
Name: www
Value: yourproject.pages.dev`}
      </CodeBlock>
      <Note>If your domain is already on Cloudflare, the DNS is configured automatically when you add the custom domain in the Pages dashboard. For external domains, add CNAME records pointing to your <InlineCode>.pages.dev</InlineCode> URL.</Note>

      <Tip>Enable Cloudflare Pages' "Automatic HTTPS Rewrites" to ensure all HTTP traffic is redirected to HTTPS automatically.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/hosting-providers/vercel', title: 'Vercel', desc: 'Alternative JAMstack hosting' },
        { href: '/guides/hosting-providers/netlify', title: 'Netlify', desc: 'Another popular static hosting option' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Move your DNS to Cloudflare' },
      ]} />
    </GuideLayout>
  );
}