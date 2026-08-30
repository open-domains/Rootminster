import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ChevronRight, Globe, Search, Server, ShieldCheck, AlertTriangle } from 'lucide-react';
import RequestModal from '@/components/RequestModal';

export default function MySubdomains() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [ownerships, setOwnerships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const me = await rootminster.auth.me();
      const [recs, owned] = await Promise.all([
        rootminster.entities.DnsRecord.filter({ owner_id: me.id, managed: true }),
        rootminster.entities.SubdomainOwnership.filter({ owner_id: me.id })
      ]);
      setRecords(recs);
      setOwnerships(owned);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const domains = useMemo(() => ownerships.map(ownership => {
    const name = ownership.full_name;
    const recs = records.filter(r => r.name === name || r.name?.endsWith('.' + name));
    const verified = recs.length > 0 && !recs.some(r => r.dns_verified === false);
    return { name, zone: ownership.root_domain, recs, verified, suspended: ownership.status === 'suspended' };
  }).sort((a, b) => a.name.localeCompare(b.name)), [ownerships, records]);

  const filtered = domains.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const healthy = domains.filter(d => d.verified && !d.suspended).length;
  const attention = domains.length - healthy;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('mySubdomains.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('mySubdomains.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('mySubdomains.subtitle')}</p>
        </div>
        <Button onClick={() => setShowRequest(true)} className="h-9 gap-2 px-4">
          <Plus size={15} /> {t('mySubdomains.requestDomain')}
        </Button>
      </div>

      {!loading && domains.length > 0 && (
        <div className="grid grid-cols-1 overflow-hidden sm:grid-cols-3 rounded-lg border border-border bg-card">
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('mySubdomains.statDomains')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{domains.length}</p>
          </div>
          <div className="border-l border-border px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('mySubdomains.statHealthy')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{healthy}</p>
          </div>
          <div className="border-l border-border px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('mySubdomains.statAttention')}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{attention}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : domains.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Globe size={34} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-foreground">{t('mySubdomains.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('mySubdomains.emptyBody')}</p>
          <Button onClick={() => setShowRequest(true)} className="mt-5 gap-2"><Plus size={14} /> {t('mySubdomains.requestDomain')}</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('mySubdomains.searchPlaceholder')} className="h-8 pl-9 text-xs" />
            </div>
            <span className="text-xs text-muted-foreground">{t('mySubdomains.countOf', { count: filtered.length, total: domains.length })}</span>
          </div>

          <div className="divide-y divide-border sm:hidden">
            {filtered.map(domain => {
              const ok = domain.verified && !domain.suspended;
              return (
                <button
                  key={domain.name}
                  onClick={() => navigate(`/subdomain-dns-manager?subdomain=${encodeURIComponent(domain.name)}`)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors active:bg-muted/50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                    <Globe size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-medium text-foreground">{domain.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{domain.recs.length} records</span>
                      <span className="font-mono">{domain.zone}</span>
                    </span>
                    <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {ok ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                      {domain.suspended ? t('mySubdomains.statusSuspended') : domain.verified ? t('mySubdomains.statusActive') : t('mySubdomains.statusVerificationIssue')}
                    </span>
                  </span>
                  <ChevronRight size={16} className="mt-2 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">{t('mySubdomains.colDomain')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('mySubdomains.colStatus')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('mySubdomains.colRecords')}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t('mySubdomains.colZone')}</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(domain => {
                  const ok = domain.verified && !domain.suspended;
                  return (
                    <tr
                      key={domain.name}
                      className="group cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/35"
                      onClick={() => navigate(`/subdomain-dns-manager?subdomain=${encodeURIComponent(domain.name)}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                            <Globe size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-medium text-foreground">{domain.name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('mySubdomains.openDnsManager')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-400' : 'text-accent'}`}>
                          {ok ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                          {domain.suspended ? t('mySubdomains.statusSuspended') : domain.verified ? t('mySubdomains.statusActive') : t('mySubdomains.statusVerificationIssue')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Server size={13} /> {domain.recs.length}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{domain.zone}</td>
                      <td className="px-4 py-3.5 text-right"><ChevronRight size={15} className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">{t('mySubdomains.noMatch', { search })}</div>
          )}
        </div>
      )}

      <RequestModal open={showRequest} onClose={() => setShowRequest(false)} onSuccess={load} />
    </div>
  );
}