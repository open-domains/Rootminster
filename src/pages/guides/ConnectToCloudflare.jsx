import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, Warning, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function ConnectToCloudflare() {
  return (
    <GuideLayout
      title="How to Connect a Domain to Cloudflare"
      description="Cloudflare is the world's leading DNS provider. This guide walks you through adding your domain to Cloudflare for faster DNS, CDN, and DDoS protection."
      category="Domain Management"
      lastUpdated="April 2026"
    >
      <H2>Why Use Cloudflare?</H2>
      <P>Cloudflare offers a free plan that gives you:</P>
      <UL>
        <LI>The world's fastest DNS resolution (1.1.1.1 network)</LI>
        <LI>Free CDN — your static assets cached globally</LI>
        <LI>Free DDoS protection — up to any size attack on the free plan</LI>
        <LI>Free SSL/TLS certificates</LI>
        <LI>DNS analytics and insights</LI>
        <LI>Page Rules and redirect management</LI>
      </UL>
      <Note>Open Domains itself uses Cloudflare for all subdomain DNS — the same infrastructure that powers millions of websites.</Note>

      <H2>Step 1: Create a Cloudflare Account</H2>
      <P>Go to <InlineCode>cloudflare.com</InlineCode> and create a free account. The free plan covers most use cases for personal projects and small websites.</P>

      <H2>Step 2: Add Your Site</H2>
      <P>From the Cloudflare dashboard, click "Add a site" and enter your root domain (e.g., <InlineCode>yourdomain.com</InlineCode>). Select the Free plan.</P>

      <H2>Step 3: Scan Existing DNS Records</H2>
      <P>Cloudflare will automatically scan and import your existing DNS records. Review them carefully:</P>
      <UL>
        <LI>Make sure all A, CNAME, MX, and TXT records are present</LI>
        <LI>Check that no records are missing (especially MX records for email)</LI>
        <LI>Add any that Cloudflare missed before proceeding</LI>
      </UL>
      <Warning>If you miss any DNS records before changing nameservers, those services (email, subdomains, etc.) will break as soon as the nameserver change propagates. Double-check everything.</Warning>

      <InArticleAd />

      <H2>Step 4: Change Your Nameservers</H2>
      <P>Cloudflare will give you two nameservers (e.g., <InlineCode>hazel.ns.cloudflare.com</InlineCode>). You need to enter these at your domain registrar:</P>
      <UL>
        <LI><strong>Namecheap:</strong> Domain List → Manage → Nameservers → Custom DNS</LI>
        <LI><strong>GoDaddy:</strong> My Products → DNS → Nameservers → Change</LI>
        <LI><strong>Google Domains / Squarespace:</strong> DNS → Nameservers → Use custom nameservers</LI>
        <LI><strong>Porkbun:</strong> Domain Management → Nameservers → Custom</LI>
      </UL>
      <P>Replace the existing nameservers with the two Cloudflare provided. Save the changes.</P>

      <H2>Step 5: Wait for Activation</H2>
      <P>Nameserver changes typically take 5 minutes to 24 hours to propagate. Cloudflare will email you when your domain is active on their network. You can check progress in the Cloudflare dashboard.</P>

      <H2>Step 6: Configure Cloudflare Settings</H2>
      <P>Once active, configure these key settings:</P>
      <UL>
        <LI><strong>SSL/TLS → Full (Strict):</strong> Best security if your origin server has a valid certificate</LI>
        <LI><strong>SSL/TLS → Flexible:</strong> If your origin doesn't have SSL (not recommended for production)</LI>
        <LI><strong>Speed → Auto Minify:</strong> Enable for JavaScript, CSS, HTML minification</LI>
        <LI><strong>Caching → Browser Cache TTL:</strong> Set to 1 day or more for static assets</LI>
      </UL>

      <H2>Understanding the Proxy Toggle (Orange Cloud)</H2>
      <P>
        In Cloudflare's DNS editor, records can be "proxied" (orange cloud) or "DNS only" (grey cloud). Proxied records route traffic through Cloudflare's CDN network, providing CDN caching, DDoS protection, and hiding your origin IP. DNS-only records bypass Cloudflare's proxy and behave like normal DNS.
      </P>
      <UL>
        <LI><strong>Orange cloud (Proxied):</strong> Good for web traffic (A and CNAME records for websites)</LI>
        <LI><strong>Grey cloud (DNS only):</strong> Required for MX, FTP, non-HTTP services, and some hosting platforms</LI>
      </UL>
      <Tip>Keep MX records as DNS only. Proxying email traffic through Cloudflare doesn't work for SMTP — it will break your email.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/hosting-providers/cloudflare-pages', title: 'Cloudflare Pages', desc: 'Host websites directly on Cloudflare' },
        { href: '/guides/dns-basics/what-is-a-nameserver', title: 'What is a Nameserver?', desc: 'How nameservers work' },
        { href: '/guides/troubleshooting/cloudflare-proxy-problems', title: 'Cloudflare Proxy Problems', desc: 'Fix common proxy-related issues' },
      ]} />
    </GuideLayout>
  );
}