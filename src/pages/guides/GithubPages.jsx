import GuideLayout from '@/components/GuideLayout';
import { H2, H3, P, UL, LI, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function GithubPages() {
  return (
    <GuideLayout
      title="GitHub Pages — Setup & Custom Domain Guide"
      description="GitHub Pages offers free hosting for static sites directly from your GitHub repository. Learn how to deploy and connect a custom domain."
      category="Hosting Providers"
      lastUpdated="April 2026"
    >
      <H2>What is GitHub Pages?</H2>
      <P>GitHub Pages is a free static site hosting service that publishes files directly from a GitHub repository. It's perfect for open-source project documentation, personal portfolios, and simple websites. It's completely free with no bandwidth limits for public repositories.</P>
      <H3>Pros</H3>
      <UL>
        <LI>Completely free for public repositories</LI>
        <LI>No build server needed — deploy directly from repo</LI>
        <LI>Built-in Jekyll support for blogs</LI>
        <LI>Custom domain support with free SSL</LI>
        <LI>GitHub Actions integration for complex builds</LI>
        <LI>Excellent for open-source project documentation</LI>
      </UL>
      <H3>Cons</H3>
      <UL>
        <LI>Only static content — no server-side code</LI>
        <LI>Soft bandwidth limit of 100GB/month</LI>
        <LI>Builds can be slow (Jekyll)</LI>
        <LI>Repository must be public for free hosting</LI>
        <LI>Limited build environment compared to Vercel/Netlify</LI>
      </UL>
      <H3>Best For</H3>
      <UL>
        <LI>Personal portfolios and CVs</LI>
        <LI>Open-source project documentation</LI>
        <LI>Simple HTML/CSS/JS websites</LI>
        <LI>Jekyll blogs</LI>
      </UL>

      <InArticleAd />

      <H2>Setting Up GitHub Pages</H2>
      <UL>
        <LI>Create a repository named <InlineCode>yourusername.github.io</InlineCode> (for personal site) or any repo name (for project site)</LI>
        <LI>Push your HTML/CSS/JS files to the repo</LI>
        <LI>Go to Settings → Pages</LI>
        <LI>Select the branch to publish from (usually <InlineCode>main</InlineCode> or <InlineCode>gh-pages</InlineCode>)</LI>
        <LI>Your site is live at <InlineCode>yourusername.github.io</InlineCode></LI>
      </UL>
      <CodeBlock label="GitHub Actions deployment (React/Vue/Vite)">
{`# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${"${{ secrets.GITHUB_TOKEN }}"}
          publish_dir: ./dist`}
      </CodeBlock>

      <H2>Custom Domain DNS Configuration</H2>
      <H3>For a subdomain (www or other)</H3>
      <CodeBlock label="CNAME for GitHub Pages subdomain">
{`Type:  CNAME
Name:  www
Value: yourusername.github.io.`}
      </CodeBlock>
      <H3>For root domain (apex)</H3>
      <CodeBlock label="A records for GitHub Pages root domain">
{`# GitHub Pages IP addresses (all four for redundancy)
Type: A  Name: @  Value: 185.199.108.153
Type: A  Name: @  Value: 185.199.109.153
Type: A  Name: @  Value: 185.199.110.153
Type: A  Name: @  Value: 185.199.111.153`}
      </CodeBlock>
      <P>Then in your GitHub repository, go to Settings → Pages → Custom Domain and enter your domain. GitHub will automatically provision an SSL certificate via Let's Encrypt.</P>
      <Warning>When using Cloudflare in front of GitHub Pages, set the DNS record to "DNS only" (grey cloud). Cloudflare proxying can conflict with GitHub Pages' SSL certificate verification.</Warning>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/hosting-providers/netlify', title: 'Netlify', desc: 'More features than GitHub Pages' },
        { href: '/guides/hosting-providers/vercel', title: 'Vercel', desc: 'Better for React/Next.js apps' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'How CNAME records work' },
      ]} />
    </GuideLayout>
  );
}