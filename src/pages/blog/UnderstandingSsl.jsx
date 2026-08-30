import BlogLayout from '@/components/BlogLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function UnderstandingSsl() {
  return (
    <BlogLayout
      title="Understanding SSL Certificates — No Jargon"
      description="SSL, TLS, HTTPS — what does it all actually mean? This guide cuts through the jargon and explains why HTTPS matters for every website."
      author="Open Domains Team"
      date="April 2026"
      category="Security"
      tags={['ssl', 'https', 'security', 'certificates']}
      readTime={8}
    >
      <P>
        If you've ever clicked the padlock icon in your browser's address bar and seen a bunch of technical-sounding terms, you've encountered SSL. But what does it actually mean, why does it matter, and do you really need it? (Spoiler: yes, every website needs HTTPS in 2026.)
      </P>

      <H2>SSL vs. TLS — What's the Difference?</H2>
      <P>
        SSL (Secure Sockets Layer) is an older encryption protocol, now replaced by TLS (Transport Layer Security). In practice, people still say "SSL" to mean what's technically TLS. When someone says "SSL certificate," they mean a TLS certificate. Same thing — different name.
      </P>
      <P>
        The current standard is TLS 1.3 (released 2018), which is faster and more secure than all previous versions. If you're using a modern hosting platform or Cloudflare, you're already using TLS 1.3.
      </P>

      <H2>What Does SSL Actually Do?</H2>
      <P>An SSL/TLS certificate does three things:</P>
      <UL>
        <LI><strong>Encryption:</strong> Data transmitted between the user's browser and your server is encrypted. Nobody intercepting the traffic can read it.</LI>
        <LI><strong>Authentication:</strong> The certificate proves that the server really belongs to the domain it claims. This prevents "man in the middle" attacks where someone impersonates your server.</LI>
        <LI><strong>Integrity:</strong> Data can't be tampered with in transit without detection.</LI>
      </UL>
      <Note>Without HTTPS, any network between your user and your server — their ISP, a coffee shop Wi-Fi, a mobile carrier — can read and modify the data. This is particularly serious for login forms, payment details, and personal information.</Note>

      <InArticleAd />

      <H2>Types of SSL Certificates</H2>
      <UL>
        <LI><strong>Domain Validated (DV):</strong> Proves you control the domain. Issued in minutes. The green padlock. Used by 99% of websites. What Let's Encrypt gives you.</LI>
        <LI><strong>Organisation Validated (OV):</strong> Verifies your organisation's identity. Takes days. Better for business sites.</LI>
        <LI><strong>Extended Validation (EV):</strong> Strict verification. Previously showed the company name in green in browsers — most browsers have removed this UI distinction now.</LI>
        <LI><strong>Wildcard:</strong> Covers all subdomains (<InlineCode>*.yourdomain.com</InlineCode>). More expensive from commercial CAs, but free with Let's Encrypt via DNS challenge.</LI>
        <LI><strong>Multi-domain (SAN):</strong> Covers multiple different domain names in one certificate.</LI>
      </UL>

      <H2>Free SSL with Let's Encrypt</H2>
      <P>
        Before 2016, SSL certificates cost £50-200/year. Let's Encrypt changed everything — it's a free, automated, open Certificate Authority that's now trusted by all browsers. Most hosting platforms (Netlify, Vercel, Cloudflare Pages) automatically provision Let's Encrypt certificates for your custom domains.
      </P>
      <CodeBlock label="Get Let's Encrypt cert manually (Certbot)">
{`# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificates auto-renew every 90 days`}
      </CodeBlock>

      <H2>Why Every Site Needs HTTPS in 2026</H2>
      <UL>
        <LI><strong>Google ranking:</strong> HTTPS has been a ranking signal since 2014. HTTP sites rank lower.</LI>
        <LI><strong>Browser warnings:</strong> Chrome marks HTTP sites as "Not Secure" — users will leave</LI>
        <LI><strong>User trust:</strong> The padlock icon signals safety. Its absence destroys credibility.</LI>
        <LI><strong>Modern web features:</strong> Service workers, geolocation, camera access — all require HTTPS</LI>
        <LI><strong>HTTP/2 and HTTP/3:</strong> These faster protocols require HTTPS in practice</LI>
      </UL>
      <Tip>With Let's Encrypt and platforms like Cloudflare handling certificate management automatically, there's no reason any website should be running on HTTP in 2026. It's free and automatic.</Tip>

      <RelatedArticles articles={[
        { href: '/guides/troubleshooting/ssl-issues', title: 'SSL Certificate Issues', desc: 'Fix common HTTPS problems' },
        { href: '/blog/how-to-secure-your-domain', title: 'How to Secure Your Domain', desc: 'Broader domain security guide' },
        { href: '/guides/hosting-providers/vps-nginx', title: 'VPS + NGINX', desc: 'Set up SSL on your own server' },
      ]} />
    </BlogLayout>
  );
}