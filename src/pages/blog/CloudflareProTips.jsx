import BlogLayout from '@/components/BlogLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function CloudflareProTips() {
  return (
    <BlogLayout
      title="How to Use Cloudflare Like a Pro"
      description="Most people only use Cloudflare for DNS. Here are the powerful free features hiding in your dashboard that you should be using."
      author="Open Domains Team"
      date="April 2026"
      category="Cloudflare"
      tags={['cloudflare', 'performance', 'security', 'cdn']}
      readTime={9}
    >
      <P>
        Cloudflare is often described as "free DNS" — but that's like calling a Swiss Army knife "a can opener." DNS is just the entry point. Cloudflare's free plan packs an extraordinary amount of capability that most users never discover. Here's how to use it properly.
      </P>

      <H2>1. Always Use Full (Strict) SSL Mode</H2>
      <P>
        The most important setting. Navigate to SSL/TLS → Overview and set the mode to <strong>Full (Strict)</strong>. This encrypts both the connection from visitors to Cloudflare, and from Cloudflare to your origin server. "Flexible" mode sends traffic to your origin unencrypted — never use it for production.
      </P>
      <Note>Full (Strict) requires a valid SSL certificate on your origin. Get one free with Let's Encrypt, or use a Cloudflare Origin Certificate (free, lasts 15 years) for the connection between Cloudflare and your server.</Note>

      <H2>2. Enable "Always Use HTTPS" and HSTS</H2>
      <P>In SSL/TLS → Edge Certificates:</P>
      <UL>
        <LI><strong>Always Use HTTPS:</strong> Redirects all HTTP to HTTPS automatically</LI>
        <LI><strong>HTTP Strict Transport Security (HSTS):</strong> Tells browsers to never connect to your site over HTTP</LI>
        <LI><strong>Minimum TLS Version:</strong> Set to TLS 1.2 to block old, insecure connections</LI>
        <LI><strong>Automatic HTTPS Rewrites:</strong> Fixes mixed content by upgrading HTTP resource URLs</LI>
      </UL>

      <InArticleAd />

      <H2>3. Page Rules (Redirects and Overrides)</H2>
      <P>Page Rules let you override settings and create redirects based on URL patterns. Free accounts get 3 rules — use them wisely:</P>
      <CodeBlock label="Page Rule examples">
{`# Redirect www to non-www
URL: www.yourdomain.com/*
Setting: Forwarding URL (301) → https://yourdomain.com/$1

# Force HTTPS on a specific path
URL: http://yourdomain.com/*
Setting: Always Use HTTPS

# Disable caching for admin area
URL: yourdomain.com/admin/*
Setting: Cache Level → Bypass`}
      </CodeBlock>

      <H2>4. Security — Bot Fight Mode and WAF</H2>
      <P>Under Security → Bots, enable <strong>Bot Fight Mode</strong>. This automatically challenges known malicious bots before they reach your server, reducing load and stopping crawlers that disrespect <InlineCode>robots.txt</InlineCode>.</P>
      <P>The free Web Application Firewall (WAF) under Security → WAF provides managed rules for common exploits — SQL injection, XSS, etc. It's basic on the free plan but better than nothing.</P>

      <H2>5. Speed — Minification and Compression</H2>
      <UL>
        <LI><strong>Speed → Optimisation → Auto Minify:</strong> Enable for JavaScript, CSS, and HTML — Cloudflare minifies these at the edge</LI>
        <LI><strong>Speed → Optimisation → Brotli:</strong> Enable Brotli compression (better than gzip)</LI>
        <LI><strong>Speed → Optimisation → Early Hints:</strong> Sends resource hints before the full HTML response — improves perceived load time</LI>
      </UL>

      <H2>6. Analytics Without Cookies</H2>
      <P>Cloudflare provides privacy-focused analytics that don't use cookies or fingerprinting — no GDPR banner needed. Go to Analytics → Traffic to see visitor counts, bandwidth, threat data, and performance metrics. It's not as detailed as Google Analytics but covers the basics without compliance headaches.</P>

      <H2>7. Email Routing (Free)</H2>
      <P>Cloudflare Email Routing lets you create custom email addresses at your domain (like <InlineCode>hello@yourdomain.com</InlineCode>) and forward them to any inbox — completely free. Set it up under Email → Email Routing.</P>
      <Tip>This is ideal for "catch-all" emails on custom domains without paying for Google Workspace. Emails to any address at your domain forward to your personal Gmail.</Tip>

      <H2>8. Zero Trust Tunnels</H2>
      <P>Cloudflare Tunnel (formerly Argo Tunnel) lets you expose a local server to the internet without opening ports in your firewall. Run the <InlineCode>cloudflared</InlineCode> daemon on your machine and Cloudflare creates a secure tunnel. Perfect for self-hosting or development environments.</P>

      <RelatedArticles articles={[
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Set up your domain on Cloudflare' },
        { href: '/guides/troubleshooting/cloudflare-proxy-problems', title: 'Cloudflare Proxy Problems', desc: 'Fix common issues' },
        { href: '/guides/hosting-providers/cloudflare-pages', title: 'Cloudflare Pages', desc: 'Host websites on Cloudflare' },
      ]} />
    </BlogLayout>
  );
}