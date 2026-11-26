import { useEffect, useState } from 'react';
import { Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { rootminster } from '@/api/rootminsterClient';

// Read-only summary of the imported threat feeds. They are managed by the Threat
// intelligence module and kept apart from the manual blocklist entries below.
export default function ThreatFeedPanel({ isAdmin }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    rootminster.functions.invoke('getThreatIntelSummary', {}).then((response) => setSummary(response.data)).catch(() => setSummary(null));
  }, []);

  if (!summary) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Radar size={15} /> Imported Threat Feeds</h2>
      {!summary.enabled ? (
        <p className="mt-2 text-xs text-muted-foreground">
          The Threat intelligence module is off.{isAdmin && <> Turn it on in <Link to="/admin-modules" className="text-primary underline">Module Settings</Link> to import malware and phishing feeds.</>}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.blocking ? 'New CNAME, MX, NS and SRV records pointing at a listed hostname are refused.' : 'Feed matches are flagged only; nothing is refused.'} Listed IP addresses are flagged, never blocked. Live matches open an abuse report.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.feeds.map((feed) => (
              <li key={feed.id} className="rounded-md bg-muted/50 p-3 text-xs">
                <p className="font-medium text-foreground">{feed.label}</p>
                <p className="mt-0.5 text-muted-foreground">{!feed.enabled ? 'Not Imported' : `${feed.hosts.toLocaleString()} hosts${feed.last_synced_at ? ` · synced ${new Date(feed.last_synced_at).toLocaleString()}` : ' · not synced yet'}`}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Google Safe Browsing: {summary.safe_browsing ? 'on' : 'no API key set'}.</p>
        </>
      )}
    </section>
  );
}
