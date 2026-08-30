import BlogLayout from '@/components/BlogLayout';
import { H2, H3, P, UL, LI, Note, Tip, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function BeginnersGuideHosting() {
  return (
    <BlogLayout
      title="Beginner's Guide to Web Hosting — Everything You Need to Know"
      description="Never rented web hosting before? This guide explains every type of hosting, what the specs mean, and how to choose the right option for your project."
      author="Open Domains Team"
      date="April 2026"
      category="Web Hosting"
      tags={['hosting', 'vps', 'beginners', 'shared-hosting']}
      readTime={10}
    >
      <P>
        Web hosting is where your website's files live. When someone visits your domain, their browser connects to your hosting server and downloads your pages. Choose the wrong type of hosting and you'll either overpay, struggle with limitations, or both. This guide explains every type so you can make an informed decision.
      </P>

      <H2>Type 1: Shared Hosting</H2>
      <P>
        Your website shares a server with hundreds of other websites. It's the cheapest option and was the dominant hosting type for years. Think GoDaddy, Bluehost, SiteGround.
      </P>
      <H3>Pros</H3>
      <UL>
        <LI>Very cheap (£2-8/month)</LI>
        <LI>No server management required — it's all handled</LI>
        <LI>Usually includes cPanel for easy file and database management</LI>
        <LI>Good for WordPress and basic PHP sites</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>"Noisy neighbour" problem — another site on your server consuming resources slows you down</LI>
        <LI>Limited performance and resources</LI>
        <LI>You can't install custom software</LI>
        <LI>Security risks from sharing infrastructure</LI>
      </UL>
      <H3>Best for</H3>
      <UL>
        <LI>WordPress blogs with moderate traffic</LI>
        <LI>Small business informational websites</LI>
        <LI>Beginners who want the simplest possible setup</LI>
      </UL>

      <H2>Type 2: Static / JAMstack Hosting (Modern Free Tier)</H2>
      <P>
        Platforms like Vercel, Netlify, and Cloudflare Pages serve pre-built static files from a global CDN. There's no traditional "server" — your files are edge-cached worldwide.
      </P>
      <H3>Pros</H3>
      <UL>
        <LI>Incredibly fast (served from CDN edge nodes near users)</LI>
        <LI>Free tier is genuinely excellent</LI>
        <LI>No server management</LI>
        <LI>Automatic SSL and deployment</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>Only works for static content or frameworks with server-side support (Next.js, Nuxt)</LI>
        <LI>No persistent file storage or traditional databases</LI>
      </UL>

      <InArticleAd />

      <H2>Type 3: VPS (Virtual Private Server)</H2>
      <P>
        A virtual machine with dedicated resources (CPU, RAM, storage) running on a physical server. You have full root access and can install anything. The most popular choice for developers who need backend capabilities.
      </P>
      <H3>Pros</H3>
      <UL>
        <LI>Full control — install any language, database, or software</LI>
        <LI>Dedicated resources (no noisy neighbour)</LI>
        <LI>Highly customisable</LI>
        <LI>Cost-effective at scale</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>You manage security, updates, backups yourself</LI>
        <LI>Requires Linux knowledge (or willingness to learn)</LI>
        <LI>Costs money (~£4-20/month)</LI>
      </UL>
      <H3>Best for</H3>
      <UL>
        <LI>Backend APIs, Node.js/Python/Go apps</LI>
        <LI>Self-hosted databases</LI>
        <LI>Experienced developers who want control</LI>
      </UL>

      <H2>Type 4: Cloud Hosting (AWS, GCP, Azure)</H2>
      <P>
        Infrastructure from the big three cloud providers. Infinitely scalable, highly available, but complex and expensive if not managed carefully. Best for large, traffic-intensive applications or teams with DevOps expertise.
      </P>
      <Note>Most startups and side projects don't need cloud infrastructure. A well-configured VPS handles millions of monthly visitors. Don't let anyone sell you AWS for a portfolio site.</Note>

      <H2>Understanding Hosting Specifications</H2>
      <UL>
        <LI><strong>CPU cores:</strong> More cores = better at handling many simultaneous users</LI>
        <LI><strong>RAM:</strong> More RAM = ability to run more applications and handle more requests</LI>
        <LI><strong>Storage (SSD vs HDD):</strong> Always prefer SSD — significantly faster for database queries and file serving</LI>
        <LI><strong>Bandwidth:</strong> Amount of data transferred per month. 1TB/month is sufficient for most sites.</LI>
        <LI><strong>Location:</strong> Choose a server location close to your primary audience for lower latency</LI>
      </UL>

      <H2>How to Choose</H2>
      <P>Answer these questions:</P>
      <UL>
        <LI><strong>Do you need server-side code?</strong> No → Static hosting. Yes → VPS or cloud.</LI>
        <LI><strong>What's your budget?</strong> £0 → Free static hosting. £4-10/month → VPS. More → Cloud or managed.</LI>
        <LI><strong>Are you comfortable with Linux?</strong> No → Shared or managed hosting. Yes → VPS.</LI>
        <LI><strong>How much traffic do you expect?</strong> Low/medium → any option. High → VPS, cloud, or CDN.</LI>
      </UL>
      <Tip>Start with the simplest option that meets your needs. You can always migrate as your project grows. Many successful products run on a £4/month VPS for years.</Tip>

      <RelatedArticles articles={[
        { href: '/blog/free-vs-paid-hosting', title: 'Free vs Paid Hosting', desc: 'When to upgrade from free' },
        { href: '/blog/best-free-hosting-providers-2026', title: 'Best Free Hosting Providers', desc: 'Full free hosting comparison' },
        { href: '/guides/hosting-providers/vps-nginx', title: 'VPS with NGINX Guide', desc: 'Set up your own VPS' },
      ]} />
    </BlogLayout>
  );
}