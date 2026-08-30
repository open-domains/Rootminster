import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function VpsNginx() {
  return (
    <GuideLayout
      title="VPS Hosting with NGINX — Complete DNS Guide"
      description="Run your own server with NGINX for maximum control. Learn the full setup: DNS, server configuration, SSL, and deployment."
      category="Hosting Providers"
      lastUpdated="April 2026"
    >
      <H2>Why Use a VPS?</H2>
      <P>A VPS (Virtual Private Server) gives you a fully controlled Linux environment where you can run anything — not just static files. It's the choice for backend applications, databases, APIs, and any custom server setup.</P>
      <H3>Pros</H3>
      <UL>
        <LI>Full control — run any language, framework, or database</LI>
        <LI>Predictable pricing (not usage-based)</LI>
        <LI>No vendor lock-in</LI>
        <LI>Can host multiple sites on one server</LI>
        <LI>SSH access for debugging and customisation</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>You manage security, updates, and backups yourself</LI>
        <LI>Higher complexity than managed platforms</LI>
        <LI>Costs money (from ~$4/month at DigitalOcean, Hetzner, etc.)</LI>
        <LI>No automatic deployment — you set that up yourself</LI>
      </UL>
      <H3>Best For</H3>
      <UL>
        <LI>Node.js, Python, Go, PHP applications</LI>
        <LI>Databases (PostgreSQL, MySQL, MongoDB, Redis)</LI>
        <LI>Self-hosted open-source software (Ghost, Nextcloud, etc.)</LI>
        <LI>Custom server configurations</LI>
      </UL>

      <InArticleAd />

      <H2>Step 1: DNS Setup</H2>
      <P>Create A records pointing your domain to your VPS's public IP:</P>
      <CodeBlock label="DNS A records for VPS">
{`Type: A   Name: @    Value: YOUR_VPS_IP
Type: A   Name: www  Value: YOUR_VPS_IP`}
      </CodeBlock>

      <H2>Step 2: Install NGINX</H2>
      <CodeBlock label="Install NGINX on Ubuntu/Debian">
{`sudo apt update
sudo apt install nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Check it's running
sudo systemctl status nginx
# Visit http://YOUR_VPS_IP — you should see the NGINX welcome page`}
      </CodeBlock>

      <H2>Step 3: Configure a Virtual Host</H2>
      <CodeBlock label="NGINX virtual host config">
{`# /etc/nginx/sites-available/yourdomain.com
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/yourdomain;
    index index.html index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    # Node.js app proxy example
    # location /api {
    #     proxy_pass http://localhost:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    # }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx`}
      </CodeBlock>

      <H2>Step 4: Free SSL with Let's Encrypt</H2>
      <CodeBlock label="SSL with Certbot">
{`# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate and configure NGINX automatically
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot modifies your NGINX config to redirect HTTP→HTTPS
# Auto-renewal is configured automatically

# Test renewal
sudo certbot renew --dry-run`}
      </CodeBlock>

      <H2>Step 5: Firewall Setup</H2>
      <CodeBlock label="UFW firewall configuration">
{`sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # Allow HTTP and HTTPS
sudo ufw enable
sudo ufw status`}
      </CodeBlock>
      <Warning>Always allow SSH through the firewall before enabling it. Running <InlineCode>sudo ufw enable</InlineCode> without allowing SSH will lock you out of your server.</Warning>

      <H2>Deploying Node.js Apps with PM2</H2>
      <CodeBlock label="PM2 process manager">
{`# Install PM2 globally
npm install -g pm2

# Start your app
pm2 start app.js --name "myapp"

# Auto-start on server reboot
pm2 startup
pm2 save`}
      </CodeBlock>
      <Tip>For a complete deployment workflow, pair PM2 with a GitHub Actions CI/CD pipeline that SSH's into your server and runs <InlineCode>git pull && npm install && pm2 restart myapp</InlineCode> on each push.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/domain-management/point-domain-to-server', title: 'Point a Domain to a Server', desc: 'DNS setup for VPS' },
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Certificate Issues', desc: 'Fix HTTPS problems' },
        { href: '/guides/domain-management/connect-to-cloudflare', title: 'Connect to Cloudflare', desc: 'Add CDN in front of your VPS' },
      ]} />
    </GuideLayout>
  );
}