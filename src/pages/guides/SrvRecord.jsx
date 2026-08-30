import GuideLayout from '@/components/GuideLayout';
import { H2, P, UL, LI, Note, CodeBlock, InlineCode, Divider, InArticleAd, RelatedArticles } from '@/components/GuideContent';

export default function SrvRecord() {
  return (
    <GuideLayout
      title="SRV Record — Advanced Use Cases"
      description="SRV records specify how to find services on your domain. Used for VoIP, game servers, Microsoft Office 365, and more."
      category="DNS Record Types"
      lastUpdated="April 2026"
    >
      <H2>What is an SRV Record?</H2>
      <P>
        An SRV (Service) record specifies the location — hostname and port — of servers for specific services. It allows service discovery via DNS, meaning software can automatically find where a service lives without hardcoding servers or ports. SRV records are used for things like SIP (VoIP), XMPP (chat), Minecraft servers, and Microsoft Teams/Office 365 integration.
      </P>
      <CodeBlock label="SRV Record format">
{`_service._proto.name. TTL IN SRV priority weight port target.

# Example: SIP over TCP
_sip._tcp.example.com. 3600 IN SRV 10 20 5060 sipserver.example.com.
#                                   ^  ^   ^    ^
#                                   |  |   |    hostname
#                                   |  |   port
#                                   |  weight (load balancing)
#                                   priority (lower = preferred)`}
      </CodeBlock>

      <H2>SRV Record Fields Explained</H2>
      <UL>
        <LI><strong>_service:</strong> The symbolic name of the service (e.g., <InlineCode>_sip</InlineCode>, <InlineCode>_xmpp</InlineCode>, <InlineCode>_minecraft</InlineCode>)</LI>
        <LI><strong>_proto:</strong> Protocol — <InlineCode>_tcp</InlineCode> or <InlineCode>_udp</InlineCode></LI>
        <LI><strong>Priority:</strong> Lower value = higher priority. Clients try lowest priority first.</LI>
        <LI><strong>Weight:</strong> Used for load balancing among records with the same priority. Higher weight = more traffic.</LI>
        <LI><strong>Port:</strong> The port number the service listens on (e.g., 5060 for SIP, 25565 for Minecraft)</LI>
        <LI><strong>Target:</strong> The hostname of the server running the service. Must have an A/AAAA record.</LI>
      </UL>

      <InArticleAd />

      <H2>Real-World Examples</H2>
      <H2>Microsoft 365 / Teams</H2>
      <CodeBlock label="Microsoft 365 SRV records">
{`# Lync/Teams SIP Federation
_sipfederationtls._tcp.yourdomain.com. SRV 100 1 5061 sipfed.online.lync.com.

# Lync/Teams SIP
_sip._tls.yourdomain.com. SRV 100 1 443 sipdir.online.lync.com.`}
      </CodeBlock>

      <H2>Minecraft Server Discovery</H2>
      <CodeBlock label="Minecraft SRV record">
{`# Lets players connect to "play.yourdomain.com" instead of "yourdomain.com:25565"
_minecraft._tcp.play.yourdomain.com. SRV 0 5 25565 mc.yourserver.com.`}
      </CodeBlock>

      <H2>XMPP (Jabber/Chat)</H2>
      <CodeBlock label="XMPP SRV records">
{`_xmpp-client._tcp.yourdomain.com. SRV 5 0 5222 xmpp.yourdomain.com.
_xmpp-server._tcp.yourdomain.com. SRV 5 0 5269 xmpp.yourdomain.com.`}
      </CodeBlock>

      <Note>SRV records only work if the client application supports SRV lookups. Web browsers don't use SRV records — they're for application-level protocols.</Note>

      <H2>Common Mistakes</H2>
      <UL>
        <LI>Setting target to an IP address instead of a hostname</LI>
        <LI>Forgetting that the target hostname needs its own A record</LI>
        <LI>Incorrect service/protocol names — check your application's documentation for the exact strings</LI>
        <LI>Setting weight to 0 when you want load balancing (weight 0 means rarely used as backup)</LI>
      </UL>

      <Divider />
      <RelatedArticles articles={[
        { href: '/guides/dns-record-types/a-record', title: 'A Record', desc: 'Set target hostname IP addresses' },
        { href: '/guides/dns-record-types/mx-record', title: 'MX Record', desc: 'Similar priority/weight concepts for email' },
        { href: '/guides/dns-basics/what-is-dns', title: 'What is DNS?', desc: 'DNS fundamentals' },
      ]} />
    </GuideLayout>
  );
}