import { useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, AlertCircle, Globe, ExternalLink } from 'lucide-react';

export default function RdapLookup() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await rootminster.functions.invoke('rdapLookup', { domain: domain.trim().toLowerCase() });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.description?.[0] || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 mb-5">
            <Globe size={20} className="text-indigo-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">RDAP Lookup</h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Look up domain registration data for domains managed by Open Domains in standard ICANN RDAP format.
            All sensitive information is redacted.
          </p>

          <form onSubmit={handleLookup} className="mt-8 flex gap-2 max-w-md mx-auto">
            <Input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. open-comm.org"
              className="h-10"
            />
            <Button
              type="submit"
              disabled={loading || !domain.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 shrink-0"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </Button>
          </form>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 mt-8">
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/25 rounded-xl px-5 py-4">
            <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="max-w-3xl mx-auto px-6 mt-8 pb-16">
          <Card>
            <CardHeader className="pb-3 flex-row items-center gap-3 space-y-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Globe size={14} className="text-indigo-500" />
              </div>
              <div>
                <CardTitle className="font-mono text-sm">{result.ldhName}</CardTitle>
                <p className="text-muted-foreground text-xs">
                  {result.status.join(', ')} · {result.nameservers.length} nameserver(s)
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <RDAPSection data={result} />
            </CardContent>
          </Card>

          {/* Raw JSON toggle */}
          <details className="mt-4">
            <summary className="text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors">
              View raw RDAP JSON
            </summary>
            <pre className="mt-3 bg-muted border rounded-lg p-4 text-xs text-foreground overflow-x-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div className="max-w-3xl mx-auto px-6 mt-20 text-center pb-16">
          <Globe size={32} className="text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Enter a domain managed by Open Domains to see its RDAP record.</p>
        </div>
      )}
    </div>
  );
}

function RDAPSection({ data }) {
  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground text-xs uppercase tracking-wider">Status</span>
        {data.status.map(s => (
          <Badge key={s} variant="secondary" className="text-xs">
            {s}
          </Badge>
        ))}
      </div>

      {/* Events */}
      <div>
        <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">Events</span>
        <div className="space-y-1">
          {data.events?.map((ev, i) => (
            <div key={i} className="flex gap-3 text-xs">
              <span className="text-indigo-500 w-24 shrink-0">{ev.eventAction}</span>
              <span className="text-foreground font-mono">{new Date(ev.eventDate).toISOString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nameservers */}
      {data.nameservers.length > 0 && (
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">
            Nameservers ({data.nameservers.length})
          </span>
          <div className="space-y-1">
            {data.nameservers.map((ns, i) => (
              <span key={i} className="text-foreground text-xs font-mono block">{ns.ldhName}</span>
            ))}
          </div>
        </div>
      )}

      {/* Remarks */}
      {data.remarks?.map((r, i) => (
        <div key={i} className="bg-muted/50 rounded-lg p-3 border">
          <p className="text-foreground text-xs font-medium mb-1">{r.title}</p>
          {r.description?.map((d, j) => (
            <p key={j} className="text-muted-foreground text-xs">{d}</p>
          ))}
          {r.links?.map((l, k) => (
            <a
              key={k}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-400 text-xs mt-1 transition-colors"
            >
              {l.value} <ExternalLink size={10} />
            </a>
          ))}
        </div>
      ))}

      {/* Notices */}
      {data.notices?.map((n, i) => (
        <div key={i} className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
          <p className="text-amber-500 text-xs font-medium mb-1">{n.title}</p>
          {n.description?.map((d, j) => (
            <p className="text-amber-500/70 text-xs">{d}</p>
          ))}
        </div>
      ))}
    </div>
  );
}