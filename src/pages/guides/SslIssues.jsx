import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function SslIssues() {
  return (
    <GuideLayout
      title="SSL Certificate Issues — Fix Guide"
      description="HTTPS not working? This guide covers the most common SSL certificate problems and how to fix them, including Cloudflare, Let's Encrypt, and mixed content errors."
      category="Troubleshooting"
      lastUpdated="April 2026"
    >
      <H2>Common SSL Errors and What They Mean</H2>
      <UL>
        <LI><strong>ERR_SSL_PROTOCOL_ERROR:</strong> The server isn't responding on HTTPS at all, or sent a non-SSL response</LI>
        <LI><strong>NET::ERR_CERT_AUTHORITY_INVALID:</strong> The certificate is self-signed or from an untrusted authority</LI>
        <LI><strong>NET::ERR_CERT_COMMON_NAME_INVALID:</strong> The certificate doesn't match the domain name</LI>
        <LI><strong>NET::ERR_CERT_DATE_INVALID:</strong> The certificate has expired</LI>
        <LI><strong>Mixed Content:</strong> Page loads over HTTPS but some resources load over HTTP</LI>
        <LI><strong>ERR_TOO_MANY_REDIRECTS:</strong> Often a Cloudflare SSL mode misconfiguration</LI>
      </UL>

      <H2>Fix: ERR_TOO_MANY_REDIRECTS with Cloudflare</H2>
      <P>This is one of the most common issues with Cloudflare. It happens when Cloudflare is set to "Flexible" SSL but your server also redirects HTTP to HTTPS — creating an infinite redirect loop.</P>
      <P><strong>Fix:</strong> In Cloudflare Dashboard → SSL/TLS → change mode to "Full" or "Full (Strict)" instead of "Flexible".</P>
      <Note>The recommended SSL mode is <strong>Full (Strict)</strong> if your origin server has a valid SSL certificate (e.g., from Let's Encrypt). This encrypts both the connection between visitors and Cloudflare, and between Cloudflare and your server.</Note>

      <InArticleAd />

      <H2>Fix: Certificate Expired</H2>
      <P>Let's Encrypt certificates expire every 90 days. They should auto-renew, but this can fail:</P>
      <CodeBlock label="Renew Let's Encrypt certificate manually">
{`# Check current certificate expiry
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Test auto-renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer`}
      </CodeBlock>

      <H2>Fix: Certificate Doesn't Match Domain</H2>
      <P>This happens when the certificate was issued for a different domain, or you're accessing via IP. Ensure your certificate covers the exact domain names being accessed:</P>
      <CodeBlock label="Get certificate for your domain">
{`# Get a new cert for your domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Or add the domain to an existing cert
sudo certbot --expand -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com`}
      </CodeBlock>

      <H2>Fix: Mixed Content Warnings</H2>
      <P>Mixed content warnings appear when an HTTPS page loads resources (images, scripts, stylesheets) over HTTP. Fix by:</P>
      <UL>
        <LI>Using protocol-relative URLs (<InlineCode>//example.com/style.css</InlineCode>) or HTTPS URLs everywhere</LI>
        <LI>Enabling "Automatic HTTPS Rewrites" in Cloudflare (rewrites HTTP resource URLs to HTTPS)</LI>
        <LI>Adding a Content Security Policy header to upgrade all requests</LI>
      </UL>
      <CodeBlock label="Nginx - force HTTPS with CSP header">
{`# Add to your NGINX server block:
add_header Content-Security-Policy "upgrade-insecure-requests;";`}
      </CodeBlock>

      <H2>Fix: GitHub Pages SSL Not Working with Cloudflare</H2>
      <P>GitHub Pages manages its own SSL certificates. When you use Cloudflare, set the record to DNS Only (grey cloud). Cloudflare's proxy interferes with GitHub Pages' SSL certificate issuance via HTTP challenge.</P>
      <Warning>With Cloudflare proxying enabled for GitHub Pages, GitHub cannot issue an SSL certificate for your custom domain. Set the CNAME/A record to DNS-only (grey cloud icon) in Cloudflare.</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/troubleshooting/cloudflare-proxy-problems', title: 'Cloudflare Proxy Problems', desc: 'Fix Cloudflare-specific issues' },
        { href: '/guides/troubleshooting/dns-not-resolving', title: 'DNS Not Resolving', desc: 'General DNS troubleshooting' },
        { href: '/guides/hosting-providers/vps-nginx', title: 'VPS with NGINX', desc: 'Configure SSL on a VPS' },
      ]} />
    </GuideLayout>
  );
}