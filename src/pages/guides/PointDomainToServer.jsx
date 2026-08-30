import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function PointDomainToServer() {
  return (
    <GuideLayout
      title="How to Point a Domain to a Server"
      description="A step-by-step walkthrough for connecting your domain name to a web server — whether it's a VPS, cloud instance, or managed host."
      category="Domain Management"
      lastUpdated="April 2026"
    >
      <H2>Overview</H2>
      <P>
        Buying a domain name and renting a server are separate things. After you have both, you need to connect them through DNS so that people who type your domain get directed to your server. This guide walks through the most common scenarios.
      </P>

      <H2>What You Need</H2>
      <UL>
        <LI>Your domain name (registered with any registrar)</LI>
        <LI>Your server's public IPv4 address (and optionally IPv6)</LI>
        <LI>Access to your DNS provider or registrar's DNS settings</LI>
        <LI>A web server running on your server (Apache, NGINX, etc.)</LI>
      </UL>

      <H2>Step 1: Find Your Server's IP Address</H2>
      <P>Log into your VPS or cloud provider (e.g., DigitalOcean, Linode, AWS EC2) and find the public IP address. It will look something like <InlineCode>203.0.113.42</InlineCode>.</P>
      <CodeBlock label="Finding your server IP (SSH)">
{`# Check your server's public IP
curl ifconfig.me
# or
curl ipinfo.io/ip`}
      </CodeBlock>

      <H2>Step 2: Create an A Record in DNS</H2>
      <P>Log into your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and create an A record:</P>
      <CodeBlock label="DNS A record setup">
{`Type:    A
Name:    @        (for yourdomain.com)
Value:   203.0.113.42
TTL:     3600 (1 hour)

# Also add www if you want www.yourdomain.com to work:
Type:    A
Name:    www
Value:   203.0.113.42
TTL:     3600`}
      </CodeBlock>

      <InArticleAd />

      <H2>Step 3: Wait for DNS Propagation</H2>
      <P>DNS changes take time. With a 3600 TTL, expect changes to propagate globally within 1–4 hours. You can check progress with:</P>
      <CodeBlock label="Check DNS propagation">
{`# Command line check
dig yourdomain.com A +short

# Or use these online tools:
# https://dnschecker.org
# https://whatsmydns.net`}
      </CodeBlock>

      <H2>Step 4: Configure Your Web Server</H2>
      <P>Once DNS resolves to your server, make sure your web server is configured to respond to your domain:</P>
      <H3>NGINX configuration</H3>
      <CodeBlock label="NGINX server block">
{`server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/yourdomain;
    index index.html index.php;

    location / {
        try_files $uri $uri/ =404;
    }
}`}
      </CodeBlock>
      <H3>Apache configuration</H3>
      <CodeBlock label="Apache VirtualHost">
{`<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    DocumentRoot /var/www/yourdomain
    ErrorLog /var/log/apache2/error.log
    CustomLog /var/log/apache2/access.log combined
</VirtualHost>`}
      </CodeBlock>

      <H2>Step 5: Set Up SSL (HTTPS)</H2>
      <P>Use Let's Encrypt for a free SSL certificate:</P>
      <CodeBlock label="Let's Encrypt with Certbot">
{`# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get a certificate (NGINX)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificate auto-renews — test renewal with:
sudo certbot renew --dry-run`}
      </CodeBlock>
      <Tip>If you're using Cloudflare proxying (orange cloud), use Cloudflare's own SSL/TLS settings rather than Certbot. Set Cloudflare's SSL mode to "Full (Strict)" and let Cloudflare handle the certificate between users and Cloudflare, then install a Cloudflare Origin Certificate for the connection between Cloudflare and your server.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/a-record', title: 'A Record', desc: 'Understanding A records' },
        { href: '/guides/hosting-providers/vps-nginx', title: 'VPS with NGINX', desc: 'Full VPS hosting guide' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Add Cloudflare CDN and DDoS protection' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Issues', desc: 'Fix HTTPS certificate problems' },
      ]} />
    </GuideLayout>
  );
}