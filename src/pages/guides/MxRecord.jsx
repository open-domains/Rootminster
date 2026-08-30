import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, Tip, Warning, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function MxRecord() {
  return (
    <GuideLayout
      title="MX Record (Email Routing) — Complete Guide"
      description="MX records control where email for your domain gets delivered. Learn how to set them up for Google Workspace, Microsoft 365, and custom mail servers."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is an MX Record?</H2>
      <P>
        An MX (Mail Exchanger) record specifies which mail servers are responsible for accepting email for a domain. Without MX records, nobody can send email to addresses at your domain. The MX record maps your domain to the hostname of one or more mail servers, along with a priority value that controls which server email gets delivered to first.
      </P>
      <CodeBlock label="MX Record format">
{`yourdomain.com. 3600 IN MX 10 mail.yourdomain.com.
yourdomain.com. 3600 IN MX 20 mail2.yourdomain.com.`}
      </CodeBlock>

      <H2>Understanding MX Priority</H2>
      <P>
        The number in an MX record (10, 20, etc.) is the priority. Lower numbers mean higher priority. Mail servers try the lowest priority server first; if it's unavailable, they try the next highest, and so on. This provides redundancy and fallback routing.
      </P>
      <UL>
        <LI>Priority 10 → tried first (primary mail server)</LI>
        <LI>Priority 20 → tried second if priority 10 fails (backup)</LI>
        <LI>Equal priorities → load balanced between servers</LI>
      </UL>
      <Note>Priority 0 is the highest possible priority. Some providers (like Google Workspace) use values like 1, 5, and 10 to allow room for backup servers.</Note>

      <InArticleAd />

      <H2>Setting Up Google Workspace (Gmail) MX Records</H2>
      <CodeBlock label="Google Workspace MX records">
{`yourdomain.com. MX 1  aspmx.l.google.com.
yourdomain.com. MX 5  alt1.aspmx.l.google.com.
yourdomain.com. MX 5  alt2.aspmx.l.google.com.
yourdomain.com. MX 10 alt3.aspmx.l.google.com.
yourdomain.com. MX 10 alt4.aspmx.l.google.com.`}
      </CodeBlock>

      <H2>Setting Up Microsoft 365 (Outlook) MX Record</H2>
      <CodeBlock label="Microsoft 365 MX record">
{`# Microsoft generates a unique MX record for your tenant:
yourdomain.com. MX 0 yourdomain-com.mail.protection.outlook.com.`}
      </CodeBlock>

      <H2>Setting Up ProtonMail MX Records</H2>
      <CodeBlock label="ProtonMail MX records">
{`yourdomain.com. MX 10 mail.protonmail.ch.
yourdomain.com. MX 20 mailsec.protonmail.ch.`}
      </CodeBlock>

      <H2>How MX Records Work</H2>
      <P>When someone sends an email to <InlineCode>you@yourdomain.com</InlineCode>, here's what happens:</P>
      <UL>
        <LI>The sending mail server queries DNS for the MX records of <InlineCode>yourdomain.com</InlineCode></LI>
        <LI>DNS returns all MX records, ordered by priority</LI>
        <LI>The sending server connects to the lowest-priority mail server (port 25)</LI>
        <LI>If that server is unavailable, it tries the next in priority order</LI>
        <LI>The mail is delivered and placed in your inbox</LI>
      </UL>
      <Warning>MX records must point to hostnames, not IP addresses. <InlineCode>yourdomain.com MX 203.0.113.42</InlineCode> is invalid. You need a hostname like <InlineCode>mail.yourdomain.com</InlineCode> that itself has an A record.</Warning>

      <H2>MX Records and CNAME Conflicts</H2>
      <P>
        You cannot have MX records on a hostname that also has a CNAME record. This is a fundamental DNS rule. If you need both a CNAME (e.g., for a website) and email on the same name, you must use an A record for the website instead.
      </P>

      <H2>Common MX Record Mistakes</H2>
      <UL>
        <LI>Pointing MX to an IP address instead of a hostname</LI>
        <LI>Forgetting to add SPF, DKIM, and DMARC TXT records for email authentication</LI>
        <LI>Having a CNAME on the same hostname as MX records</LI>
        <LI>Not removing old MX records when switching email providers</LI>
        <LI>Using the wrong priority value (check your provider's documentation)</LI>
      </UL>
      <Tip>After changing MX records, send a test email from an external address (like Gmail) to verify delivery. Tools like mail-tester.com can check your full email setup including SPF and DKIM.</Tip>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/txt-record', title: 'TXT Record (SPF, DKIM, DMARC)', desc: 'Secure your email with authentication records' },
        { href: '/guides/dns-record-types/cname-record', title: 'CNAME Record', desc: 'CNAME conflicts with MX explained' },
        { href: '/guides/dns-basics/what-is-dns', title: 'What is DNS?', desc: 'DNS fundamentals' },
      ]} />
    </GuideLayout>
  );
}