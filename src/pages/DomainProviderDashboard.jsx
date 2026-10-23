import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Globe2, BarChart3, GitPullRequest, Server, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

function StatCard({ icon: Icon, label, value, color = 'text-primary' }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon size={14} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function DomainCard({ domain }) {
  const { t } = useTranslation();
  const s = domain.stats;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Globe2 size={16} className="text-primary shrink-0" />
          <span className="font-semibold text-foreground">{domain.name}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            domain.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
          }`}>
            {domain.status}
          </span>
        </div>
        {domain.last_synced && (
          <span className="text-xs text-muted-foreground">
            {t('domainProvider.lastSynced', 'Synced')} {format(new Date(domain.last_synced), 'MMM d, HH:mm')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
        {[
          { label: t('domainProvider.activeSubdomains', 'Active Subdomains'), value: s.approved_subdomains, color: 'text-emerald-400' },
          { label: t('domainProvider.pendingRequests', 'Pending Requests'), value: s.pending_requests, color: 'text-amber-400' },
          { label: t('domainProvider.dnsRecords', 'DNS Records'), value: domain.record_count ?? s.dns_records, color: 'text-primary' },
          { label: t('domainProvider.new7d', 'New (7 days)'), value: s.new_requests_7d, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {domain.provider_assigned_at && (
        <div className="px-5 py-2.5 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {t('domainProvider.assignedAt', 'Provider since')} {format(new Date(domain.provider_assigned_at), 'MMM d, yyyy')}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DomainProviderDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const stats = await rootminster.domainProvider.stats();
      setData(stats);
    } catch {
      toast.error(t('domainProvider.loadError', 'Failed to load domain stats'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = data?.totals ?? { active_subdomains: 0, pending_requests: 0, dns_records: 0, new_requests_7d: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t('domainProvider.eyebrow', 'Domain Provider')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('domainProvider.title', 'Your Donated Domains')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t('domainProvider.subtitle', 'Live stats for the domains you have contributed to Open Domains.')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => load(true)}
          disabled={refreshing}
          className="h-9 gap-2 px-4 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Globe2} label={t('domainProvider.activeSubdomains', 'Active Subdomains')} value={totals.active_subdomains} color="text-emerald-400" />
            <StatCard icon={GitPullRequest} label={t('domainProvider.pendingRequests', 'Pending Requests')} value={totals.pending_requests} color="text-amber-400" />
            <StatCard icon={Server} label={t('domainProvider.dnsRecords', 'DNS Records')} value={totals.dns_records} />
            <StatCard icon={TrendingUp} label={t('domainProvider.new7d', 'New (7 days)')} value={totals.new_requests_7d} color="text-blue-400" />
          </div>

          {/* Per-domain breakdown */}
          {data?.domains?.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 size={14} />
                {t('domainProvider.breakdownTitle', 'Domain breakdown')}
              </h2>
              {data.domains.map((domain) => (
                <DomainCard key={domain.id} domain={domain} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Globe2 size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t('domainProvider.noDomains', 'No domains have been assigned to you yet. Contact an admin to get started.')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
