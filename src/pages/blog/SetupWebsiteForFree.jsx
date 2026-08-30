import BlogLayout from '@/components/BlogLayout';
import { H2, H3, P, UL, LI, Note, Tip, CodeBlock, InlineCode, InArticleAd, RelatedArticles } from '@/components/GuideContent';
import { Link } from 'react-router-dom';

export default function SetupWebsiteForFree() {
  return (
    <BlogLayout
      title="How to Set Up a Website for Free in 2026"
      description="From domain to deployed — a complete walkthrough for getting a website live without spending a penny."
      author="Open Domains Team"
      date="April 2026"
      category="Web Hosting"
      tags={['hosting', 'free', 'beginners', 'web']}
      readTime={8}
    >
      <P>
        The good news: it has never been easier — or cheaper — to get a website live. Between free hosting platforms, free DNS services, and free SSL certificates, you can have a real, functioning website on the public internet for exactly £0. This guide walks through exactly how to do it.
      </P>

      <H2>What You Actually Need</H2>
      <P>Before diving in, let's separate the necessities from the nice-to-haves:</P>
      <UL>
        <LI><strong>A domain name</strong> — Either get a free subdomain (like <InlineCode>yourproject.is-a.dev</InlineCode>) or buy a <InlineCode>.com</InlineCode> for ~£10/year</LI>
        <LI><strong>Somewhere to host your files</strong> — There are excellent free options</LI>
        <LI><strong>SSL certificate</strong> — Completely free through Let's Encrypt or your hosting provider</LI>
        <LI><strong>A website to deploy</strong> — Your HTML/CSS/JS files, or a framework project</LI>
      </UL>

      <H2>Option 1: The Completely Free Stack</H2>
      <P>This is the stack that costs you nothing, works reliably, and is used by tens of thousands of developers:</P>
      <UL>
        <LI><strong>Domain:</strong> Free subdomain from <Link to="/dashboard" className="text-indigo-400 hover:text-indigo-300">Open Domains</Link> (e.g., <InlineCode>yourproject.is-a.dev</InlineCode>)</LI>
        <LI><strong>Hosting:</strong> Vercel, Netlify, or Cloudflare Pages (all have free tiers)</LI>
        <LI><strong>SSL:</strong> Automatically provisioned by your hosting platform</LI>
        <LI><strong>CDN:</strong> Built into all three hosting platforms above</LI>
      </UL>
      <Note>A free subdomain from Open Domains is a real, professional URL. It's not a sketchy free service — your subdomain is hosted on Cloudflare's global DNS network and reviewed by a human before going live.</Note>

      <H2>Step 1: Build Your Website</H2>
      <P>If you don't have a website yet, here's the quickest path:</P>
      <H3>For a simple HTML site:</H3>
      <CodeBlock label="Basic HTML site structure">
{`my-website/
├── index.html      ← Your homepage
├── about.html      ← About page
├── style.css       ← Your styles
└── script.js       ← Optional JavaScript`}
      </CodeBlock>
      <H3>For a React/Vite app:</H3>
      <CodeBlock label="Create a Vite React app">
{`npm create vite@latest my-website -- --template react
cd my-website
npm install
npm run dev       # Preview locally
npm run build     # Build for deployment (outputs to /dist)`}
      </CodeBlock>

      <InArticleAd />

      <H2>Step 2: Deploy to Netlify (Easiest for Beginners)</H2>
      <P>Netlify's drag-and-drop deployment is the fastest way to get a site live:</P>
      <UL>
        <LI>Build your project locally (<InlineCode>npm run build</InlineCode>)</LI>
        <LI>Go to <InlineCode>app.netlify.com</InlineCode> and create a free account</LI>
        <LI>Drag your <InlineCode>/dist</InlineCode> or <InlineCode>/build</InlineCode> folder onto the Netlify drop zone</LI>
        <LI>Your site is instantly live at a random Netlify URL like <InlineCode>random-name-123.netlify.app</InlineCode></LI>
      </UL>
      <P>For automatic deployments on every code push, connect a GitHub repository instead.</P>

      <H2>Step 3: Get Your Free Subdomain</H2>
      <P>Visit Open Domains and request a subdomain. You'll get a URL like <InlineCode>myproject.is-a.dev</InlineCode>. Then create a CNAME record pointing it to your Netlify/Vercel deployment URL.</P>

      <H2>Step 4: Connect the Domain to Your Hosting</H2>
      <CodeBlock label="Add custom domain on Netlify/Vercel">
{`# In Netlify: Site Settings → Domain Management → Add Custom Domain
# In Vercel: Project Settings → Domains → Add Domain

# Netlify will give you a CNAME target like:
# yoursite.netlify.app

# Add this in your DNS (Open Domains dashboard):
Type: CNAME
Name: myproject   (your subdomain)
Value: yoursite.netlify.app`}
      </CodeBlock>
      <P>SSL is automatically provisioned — your site will be live at <InlineCode>https://myproject.is-a.dev</InlineCode> within minutes of DNS propagating.</P>

      <H2>When to Pay for Hosting</H2>
      <P>Free hosting is great for personal projects, portfolios, and experiments. Consider paying when:</P>
      <UL>
        <LI>Your site gets significant traffic and hits bandwidth limits</LI>
        <LI>You need a backend (database, server-side processing)</LI>
        <LI>You're running a commercial project (Vercel's free tier requires non-commercial use)</LI>
        <LI>You need 99.9% uptime SLAs with customer-facing services</LI>
      </UL>
      <Tip>Even when you do pay, VPS hosting starts from around £4/month (Hetzner, DigitalOcean) and gives you full control. That's significantly cheaper than traditional shared hosting with fewer limitations.</Tip>

      <RelatedArticles articles={[
        { href: '/blog/best-free-hosting-providers-2026', title: 'Best Free Hosting Providers in 2026', desc: 'Full comparison of every option' },
        { href: '/guides/hosting-providers/netlify', title: 'Netlify Guide', desc: 'Complete Netlify setup guide' },
        { href: '/guides/domain-management/subdomains-explained', title: 'Subdomains Explained', desc: 'How subdomains work' },
      ]} />
    </BlogLayout>
  );
}