import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function CloudflareProxyProblems() {
  return (
    <GuideLayout
      title="Cloudflare Proxy Problems — Fix Guide"
      description="Cloudflare's proxy adds CDN and DDoS protection but can cause unexpected issues. Learn how to diagnose and fix the most common Cloudflare proxy problems."
      category="Troubleshooting"
      lastUpdated="April 2026"
    >
      <H2>Understanding the Cloudflare Proxy</H2>
      <P>When a DNS record is "proxied" (orange cloud) in Cloudflare, traffic routes through Cloudflare's network before reaching your server. This adds CDN caching, DDoS protection, and hides your origin IP. However, it also means Cloudflare is a middleman that can sometimes cause issues.</P>

      <H2>Problem: ERR_TOO_MANY_REDIRECTS</H2>
      <P><strong>Cause:</strong> Cloudflare SSL mode is set to "Flexible" while your server also forces HTTPS. This creates a redirect loop: Cloudflare connects to your server over HTTP → server redirects to HTTPS → Cloudflare receives redirect → connects over HTTP again.</P>
      <P><strong>Fix:</strong> Change SSL/TLS mode to "Full" or "Full (Strict)" in Cloudflare Dashboard → SSL/TLS. If your server doesn't have SSL, either install one (use Let's Encrypt) or turn off the HTTP-to-HTTPS redirect on your server.</P>

      <H2>Problem: Email Not Working After Enabling Proxy</H2>
      <P><strong>Cause:</strong> Cloudflare proxying only works for web traffic (HTTP/HTTPS). SMTP (email) traffic cannot be proxied. If your MX records or mail subdomain records are proxied, email delivery will fail.</P>
      <P><strong>Fix:</strong> Set MX records and any mail-related A records (e.g., <InlineCode>mail.yourdomain.com</InlineCode>) to DNS Only (grey cloud).</P>
      <Warning>Never proxy MX records or mail server A records through Cloudflare. Email uses SMTP on port 25, which Cloudflare's proxy does not support.</Warning>

      <InArticleAd />

      <H2>Problem: WebSocket Connections Failing</H2>
      <P><strong>Cause:</strong> Cloudflare proxying supports WebSockets, but it's disabled by default on some plans or misconfigured.</P>
      <P><strong>Fix:</strong> In Cloudflare Dashboard → Network → enable "WebSockets". Also ensure your server is sending the correct <InlineCode>Upgrade: websocket</InlineCode> headers.</P>
      <CodeBlock label="NGINX WebSocket proxy config">
{`location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}`}
      </CodeBlock>

      <H2>Problem: Origin IP Exposed Despite Proxy</H2>
      <P>If your origin IP leaks through other means, Cloudflare's protection is less effective. Common leak sources:</P>
      <UL>
        <LI>Direct A records that aren't proxied (e.g., FTP subdomain)</LI>
        <LI>Email headers revealing the origin IP</LI>
        <LI>Old DNS records that bypass Cloudflare</LI>
        <LI>Certificate transparency logs showing your origin IP</LI>
      </UL>
      <Tip>Use Cloudflare's "Always Use HTTPS" and "Automatic HTTPS Rewrites" under SSL/TLS settings to ensure all traffic goes through the proxy.</Tip>

      <H2>Problem: Caching Too Aggressively</H2>
      <P>Cloudflare may cache responses you don't want cached (like API responses or dynamic pages).</P>
      <CodeBlock label="Disable caching for specific paths via Page Rules">
{`# Cloudflare Page Rule to bypass cache:
URL pattern: yourdomain.com/api/*
Setting: Cache Level = Bypass

# Or via Cache-Control header from your server:
Cache-Control: no-store, no-cache, must-revalidate`}
      </CodeBlock>

      <H2>Problem: Real Visitor IP Shows as Cloudflare IP</H2>
      <P>When proxied, your server sees Cloudflare's IP, not the visitor's. The real IP is in the <InlineCode>CF-Connecting-IP</InlineCode> header.</P>
      <CodeBlock label="Get real IP in NGINX">
{`# In your NGINX config, before the server block:
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
# (Add all Cloudflare IP ranges from cloudflare.com/ips)
real_ip_header CF-Connecting-IP;`}
      </CodeBlock>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Certificate Issues', desc: 'Fix HTTPS problems' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Set up Cloudflare correctly from the start' },
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'General DNS troubleshooting' },
      ]} />
    </GuideLayout>
  );
}