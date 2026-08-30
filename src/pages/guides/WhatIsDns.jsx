import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function WhatIsDns() {
  return (
    <GuideLayout
      title="What is DNS and How Does It Work?"
      description="A complete beginner's guide to the Domain Name System — the internet's phonebook that turns domain names into IP addresses."
      category="DNS Basics"
      lastUpdated="April 2026"
    >
      <H2>Introduction</H2>
      <P>
        Every time you type a website address into your browser — like <InlineCode>google.com</InlineCode> or <InlineCode>github.com</InlineCode> — something remarkable happens in milliseconds before the page loads. Your computer doesn't actually know where <InlineCode>google.com</InlineCode> lives. It only understands IP addresses, like <InlineCode>142.250.80.46</InlineCode>. The system that bridges the gap between human-readable names and machine-readable addresses is called the <strong>Domain Name System</strong>, or DNS.
      </P>
      <P>
        Think of DNS as the internet's phonebook. Just as a phonebook maps names to phone numbers, DNS maps domain names to IP addresses. Without DNS, you'd need to memorise the IP address of every website you want to visit.
      </P>

      <H2>Why DNS Exists</H2>
      <P>
        In the early days of the internet (then ARPANET), all computers were listed in a single file called <InlineCode>HOSTS.TXT</InlineCode>, maintained at Stanford. Every computer on the network downloaded this file to know who was who. As the network grew, this approach became completely unworkable — the file was updated only a couple of times a week, and the internet was doubling in size rapidly.
      </P>
      <P>
        In 1983, Paul Mockapetris invented the Domain Name System as a distributed, scalable solution. Instead of one central file, DNS uses a hierarchy of servers spread across the globe. Today, DNS handles trillions of lookups every day — and most of them complete in under 50 milliseconds.
      </P>

      <H2>How a DNS Lookup Works</H2>
      <P>Here's exactly what happens when you type <InlineCode>example.com</InlineCode> into your browser:</P>
      <UL>
        <LI><strong>Step 1 — Browser Cache:</strong> Your browser first checks its own cache. If you visited the site recently, it may still remember the IP address.</LI>
        <LI><strong>Step 2 — OS Cache:</strong> If not in the browser cache, your operating system checks its local DNS cache and the <InlineCode>hosts</InlineCode> file.</LI>
        <LI><strong>Step 3 — Recursive Resolver:</strong> Your computer asks a DNS resolver (usually provided by your ISP or a public DNS like <InlineCode>8.8.8.8</InlineCode>). This resolver does the heavy lifting on your behalf.</LI>
        <LI><strong>Step 4 — Root Nameservers:</strong> The resolver contacts one of the 13 root nameserver clusters (labelled A through M). These don't know the answer, but they know where to look — they point to the TLD nameservers.</LI>
        <LI><strong>Step 5 — TLD Nameservers:</strong> The resolver asks the Top-Level Domain (TLD) nameserver for <InlineCode>.com</InlineCode>. This server knows which nameservers are authoritative for <InlineCode>example.com</InlineCode>.</LI>
        <LI><strong>Step 6 — Authoritative Nameserver:</strong> The resolver queries the authoritative nameserver for <InlineCode>example.com</InlineCode>. This server holds the actual DNS records and returns the IP address.</LI>
        <LI><strong>Step 7 — Response:</strong> The resolver returns the IP address to your computer. Your browser connects to that IP and loads the page.</LI>
      </UL>

      <Note>This entire process typically takes 20–120 milliseconds. Once resolved, the result is cached according to the record's TTL (Time To Live), so subsequent lookups are nearly instant.</Note>

      <InArticleAd />

      <H2>The DNS Hierarchy</H2>
      <P>DNS is organised in a tree-like hierarchy:</P>
      <CodeBlock label="DNS Hierarchy">
{`. (root)
├── com (TLD)
│   ├── google.com
│   ├── github.com
│   └── example.com
├── org (TLD)
│   └── wikipedia.org
└── net (TLD)
    └── cloudflare.net`}
      </CodeBlock>
      <P>
        The root zone is represented by a single dot (<InlineCode>.</InlineCode>). Below that are Top-Level Domains (TLDs) like <InlineCode>.com</InlineCode>, <InlineCode>.org</InlineCode>, <InlineCode>.net</InlineCode>, and country codes like <InlineCode>.uk</InlineCode>, <InlineCode>.de</InlineCode>. Below those are the second-level domains you register, like <InlineCode>example.com</InlineCode>. And below those, you can create as many subdomains as you want.
      </P>

      <H2>Types of DNS Records</H2>
      <P>DNS isn't just about mapping names to IPs. Different record types handle different things:</P>
      <UL>
        <LI><strong>A record</strong> — Maps a domain to an IPv4 address</LI>
        <LI><strong>AAAA record</strong> — Maps a domain to an IPv6 address</LI>
        <LI><strong>CNAME record</strong> — Creates an alias pointing to another hostname</LI>
        <LI><strong>MX record</strong> — Directs email for a domain to a mail server</LI>
        <LI><strong>TXT record</strong> — Stores arbitrary text, used for verification and email security</LI>
        <LI><strong>NS record</strong> — Specifies which nameservers are authoritative for a domain</LI>
        <LI><strong>SOA record</strong> — Contains administrative information about a zone</LI>
      </UL>

      <H2>DNS Caching and TTL</H2>
      <P>
        Every DNS record has a TTL — Time To Live — measured in seconds. When a resolver caches a record, it stores it for exactly TTL seconds before discarding it and fetching fresh data. A TTL of <InlineCode>3600</InlineCode> means the record is cached for one hour.
      </P>
      <P>
        Lower TTLs mean changes propagate faster but put more load on DNS servers. Higher TTLs reduce DNS query load and speed up lookups for users, but mean changes take longer to be visible globally.
      </P>
      <Tip>If you're planning a DNS change (like migrating a server), lower your TTL to 300 (5 minutes) a day in advance. Once the change is live and stable, raise it back to 3600 or higher.</Tip>

      <H2>Public DNS Resolvers</H2>
      <P>Most people use their ISP's DNS resolver by default. But many switch to faster, more privacy-focused alternatives:</P>
      <UL>
        <LI><strong>Cloudflare:</strong> <InlineCode>1.1.1.1</InlineCode> and <InlineCode>1.0.0.1</InlineCode> — fastest, privacy-first</LI>
        <LI><strong>Google:</strong> <InlineCode>8.8.8.8</InlineCode> and <InlineCode>8.8.4.4</InlineCode> — reliable, well-known</LI>
        <LI><strong>Quad9:</strong> <InlineCode>9.9.9.9</InlineCode> — blocks malicious domains</LI>
        <LI><strong>OpenDNS:</strong> <InlineCode>208.67.222.222</InlineCode> — family filtering options</LI>
      </UL>

      <H2>Common DNS Mistakes</H2>
      <UL>
        <LI>Forgetting that DNS changes take time — don't expect instant updates</LI>
        <LI>Setting TTLs too high before a planned migration</LI>
        <LI>Confusing CNAME with A records — CNAME points to a hostname, not an IP</LI>
        <LI>Creating CNAME records on the root domain (this breaks email and other records)</LI>
        <LI>Forgetting to update MX records when changing email providers</LI>
      </UL>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-basics/what-is-a-nameserver', title: 'What is a Nameserver?', desc: 'Learn how nameservers control your DNS zone' },
        { href: '/guides/dns-basics/dns-propagation', title: 'DNS Propagation Explained', desc: 'Why DNS changes take time and how to check them' },
        { href: '/guides/dns-record-types/a-record', title: 'A Records (IPv4)', desc: 'How to point your domain to a server IP address' },
        { href: '/guides/dns-record-types/mx-record', title: 'MX Records', desc: 'Set up email routing for your domain' },
      ]} />
    </GuideLayout>
  );
}