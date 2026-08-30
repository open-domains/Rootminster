import BlogLayout from '@/components/BlogLayout';
import { H2, P, UL, LI, Note, Tip, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function FreeVsPaidHosting() {
  return (
    <BlogLayout
      title="Free vs Paid Hosting — What You Actually Need to Know"
      description="The honest breakdown of when free hosting is perfectly fine, and when it's time to pay for something better."
      author="Open Domains Team"
      date="April 2026"
      category="Web Hosting"
      tags={['hosting', 'comparison', 'vps', 'budget']}
      readTime={7}
    >
      <P>
        If you search for web hosting advice, you'll find endless opinions. Some people say free hosting is fine; others insist you need a paid VPS from day one. The truth, as usual, depends entirely on what you're building. Here's the genuinely honest breakdown.
      </P>

      <H2>When Free Hosting is Absolutely Fine</H2>
      <P>
        Free hosting platforms like Vercel, Netlify, and Cloudflare Pages are not "cheap" in the traditional sense — they're built on enterprise infrastructure and serve real production traffic for millions of websites. Free works perfectly for:
      </P>
      <UL>
        <LI><strong>Personal portfolios and CVs:</strong> Low traffic, static content — free hosting handles this with ease</LI>
        <LI><strong>Side projects and experiments:</strong> If nobody's paying to use it, you shouldn't be paying to run it</LI>
        <LI><strong>Open-source project docs:</strong> GitHub Pages and Cloudflare Pages are perfect here</LI>
        <LI><strong>Landing pages:</strong> Marketing sites with occasional traffic spikes are exactly what CDN-based free hosting handles best</LI>
        <LI><strong>Student projects:</strong> Learning to code doesn't require spending money on hosting</LI>
      </UL>

      <H2>The Real Limitations of Free Hosting</H2>
      <UL>
        <LI><strong>No server-side processing:</strong> Free static hosting can't run a database, process payments, or handle user authentication natively</LI>
        <LI><strong>Bandwidth limits:</strong> Most free tiers cap at 100GB/month — fine for most sites, a problem for media-heavy or popular ones</LI>
        <LI><strong>No SLA:</strong> Free plans don't come with uptime guarantees. If Vercel has an outage, you have no recourse.</LI>
        <LI><strong>Commercial restrictions:</strong> Vercel's free plan explicitly prohibits commercial use</LI>
        <LI><strong>Cold starts:</strong> Serverless functions on free tiers may have latency spikes after inactivity</LI>
      </UL>

      <InArticleAd />

      <H2>When to Pay for Hosting</H2>
      <P>The transition from free to paid makes sense when:</P>
      <UL>
        <LI><strong>You're making money from the project:</strong> If users are paying, you should pay for reliable infrastructure</LI>
        <LI><strong>You need a database:</strong> Any serious app needs persistent server-side storage</LI>
        <LI><strong>Traffic exceeds free tier limits:</strong> Consistent traffic over 100GB/month means you need to upgrade</LI>
        <LI><strong>Uptime matters:</strong> If people's workflows depend on your service being up, you need an SLA</LI>
        <LI><strong>You need SSH access:</strong> For debugging, custom software, or complex setups, a VPS is necessary</LI>
      </UL>

      <H2>The Budget-Conscious Paid Options</H2>
      <P>Paid doesn't have to mean expensive. Some genuinely affordable options:</P>
      <UL>
        <LI><strong>Hetzner CX22:</strong> ~£4/month for a 2-core, 4GB RAM VPS in Europe. Excellent value.</LI>
        <LI><strong>DigitalOcean Droplet:</strong> $6/month for a basic VPS. Good documentation, great for beginners.</LI>
        <LI><strong>Vercel Pro:</strong> $20/month — removes commercial restrictions and raises limits significantly</LI>
        <LI><strong>Railway:</strong> Pay-as-you-go, usually $5-20/month for small apps with a database</LI>
      </UL>
      <Note>A £4/month VPS from Hetzner is more powerful than most shared hosting plans that cost £8-15/month. If you're comfortable with Linux, a VPS is almost always the better value at any price point.</Note>

      <H2>The Hybrid Approach (What Most Professionals Do)</H2>
      <P>Most experienced developers use a hybrid approach:</P>
      <UL>
        <LI>Static front-end on Cloudflare Pages or Vercel (free)</LI>
        <LI>Backend API on a small VPS or Railway (cheap paid)</LI>
        <LI>Database on managed service or the same VPS</LI>
        <LI>CDN via Cloudflare (free)</LI>
      </UL>
      <Tip>This hybrid approach gives you the speed and simplicity of CDN-hosted frontend with the flexibility of a real backend server, typically for under £10/month total.</Tip>

      <RelatedArticles articles={[
        { href: '/blog/best-free-hosting-providers-2026', title: 'Best Free Hosting Providers 2026', desc: 'Full free hosting comparison' },
        { href: '/blog/beginners-guide-to-web-hosting', title: "Beginner's Guide to Web Hosting", desc: 'All hosting types explained' },
        { href: '/guides/hosting-providers/vps-nginx', title: 'VPS with NGINX', desc: 'Set up your own server' },
      ]} />
    </BlogLayout>
  );
}