import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Users, Globe, GitPullRequest, AlertTriangle, RefreshCw, Server } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { format, subMonths, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({});
  const [recentRequests, setRecentRequests] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [requestsChart, setRequestsChart] = useState([]);
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      const me = await rootminster.auth.me();
      setUser(me);
      const isAdmin = me.role === 'admin';
      const [users, records, requests, syncLogsData, domainsData] = await Promise.all([
        isAdmin ? rootminster.entities.User.list() : Promise.resolve([]),
        rootminster.entities.DnsRecord.list(),
        rootminster.entities.SubdomainRequest.list(),
        rootminster.entities.SyncLog.list('-created_date', 5),
        rootminster.entities.Domain.list()
      ]);
      setStats({
        users: isAdmin ? users.length : null,
        managed: records.filter(r => r.managed).length,
        totalRecords: records.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        failedSyncs: syncLogsData.filter(s => s.status === 'failed').length,
      });
      setRecentRequests(requests.filter(r => r.status === 'pending').slice(0, 5));
      setSyncLogs(syncLogsData);
      setDomains(domainsData);

      const now = new Date();
      const chartData = Array.from({ length: 6 }, (_, i) => {
        const monthStart = startOfMonth(subMonths(now, 5 - i));
        const label = format(monthStart, 'MMM yy');
        const count = requests.filter(r => {
          const d = new Date(r.created_date);
          return d >= monthStart && d < startOfMonth(subMonths(now, 4 - i));
        }).length;
        return { month: label, requests: count };
      });
      setRequestsChart(chartData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const syncAll = async () => {
    setSyncing(true);
    try {
      for (const d of domains) {
        await rootminster.functions.invoke('syncCloudflare', { zone_id: d.zone_id, zone_name: d.name });
      }
      toast.success(t('adminDashboard.syncAllSuccess'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || t('adminDashboard.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const overviewStats = [
    ...(user?.role === 'admin' ? [{ label: t('adminDashboard.labelUsers'), value: stats.users, icon: Users }] : []),
    { label: t('adminDashboard.labelDnsRecords'), value: stats.totalRecords, icon: Globe },
    { label: t('adminDashboard.labelManaged'), value: stats.managed, icon: Server },
    { label: t('adminDashboard.labelPendingRequests'), value: stats.pendingRequests, icon: GitPullRequest },
    { label: t('adminDashboard.labelFailedSyncs'), value: stats.failedSyncs, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('adminDashboard.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{user?.role === 'admin' ? t('adminDashboard.titleAdmin') : t('adminDashboard.titleStaff')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('adminDashboard.subtitle')}</p>
        </div>
        {user?.role === 'admin' && (
          <Button onClick={syncAll} disabled={syncing} variant="outline" className="h-9 gap-2">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('adminDashboard.syncing') : t('adminDashboard.syncAll')}
          </Button>
        )}
      </div>

      <div className={`grid overflow-hidden rounded-lg border border-border bg-card ${overviewStats.length === 5 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
        {overviewStats.map((item, index) => (
          <div key={item.label} className={`${index > 0 ? 'border-l border-border' : ''} px-4 py-3.5`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <item.icon size={13} />
              <span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{item.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6 shadow-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-foreground font-semibold text-sm">{t('adminDashboard.chartTitle')}</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="h-[200px] flex items-end justify-between gap-3 px-2" aria-hidden="true">
              {[40, 65, 30, 80, 50, 70].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full rounded-t bg-primary/30 animate-pulse" style={{ height: `${h}%` }} />
                  <div className="h-2.5 w-10 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={requestsChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'hsl(var(--primary))', fillOpacity: 0.12 }} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} labelStyle={{ color: 'hsl(var(--foreground))' }} itemStyle={{ color: 'hsl(var(--primary))' }} />
                <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-foreground font-semibold text-sm">{t('adminDashboard.pendingTitle')}</h2>
            <Link to="/admin-requests" className="text-primary text-xs hover:opacity-80 transition-opacity">{t('adminDashboard.viewAll')}</Link>
          </div>
          <div className="divide-y divide-border/60">
            {recentRequests.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">{t('adminDashboard.noPending')}</p>
            ) : recentRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium font-mono truncate">{r.subdomain}.{r.root_domain}</p>
                  <p className="text-muted-foreground text-xs truncate">{r.requester_email} · {r.record_type}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-foreground font-semibold text-sm">{t('adminDashboard.syncJobsTitle')}</h2>
            <Link to="/admin-domains" className="text-primary text-xs hover:opacity-80 transition-opacity">{t('adminDashboard.manage')}</Link>
          </div>
          <div className="divide-y divide-border/60">
            {syncLogs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">{t('adminDashboard.noSync')}</p>
            ) : syncLogs.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-foreground text-sm">{s.zone_name}</p>
                  <p className="text-muted-foreground text-xs">{t('adminDashboard.recordsSynced', { count: s.records_synced || 0 })} · {s.created_date ? format(new Date(s.created_date), 'MMM d, HH:mm') : '—'}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}