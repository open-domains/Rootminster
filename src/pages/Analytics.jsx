import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, ArrowUpRight, BarChart3, Check, Copy, Eye,
  Globe2, MousePointerClick, RefreshCw, Timer, Users,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';

function number(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function duration(totalSeconds, visits) {
  const seconds = visits ? Math.round(Number(totalSeconds || 0) / Number(visits || 1)) : 0;
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${mins}m ${remainder}s`;
}

function metricName(row) {
  return row?.x ?? row?.name ?? row?.value ?? row?.url ?? 'Unknown';
}

function metricValue(row) {
  return Number(row?.y ?? row?.count ?? row?.value ?? 0);
}

function MetricList({ title, rows, empty = 'No data yet' }) {
  const max = Math.max(1, ...rows.map(metricValue));
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border/70">
        {rows.length ? rows.map((row, index) => {
          const value = metricValue(row);
          const name = metricName(row);
          return (
            <div key={`${name}-${index}`} className="relative flex items-center gap-3 px-4 py-3">
              <div className="absolute inset-y-0 left-0 bg-primary/[0.045]" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
              <span className="relative min-w-0 flex-1 truncate text-xs text-foreground" title={String(name)}>{name || 'Direct'}</span>
              <span className="relative shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{number(value)}</span>
            </div>
          );
        }) : <p className="px-4 py-8 text-center text-xs text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="min-w-0 border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={14} /> {label}</div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Setup({ domain, status, onEnable, enabling }) {
  const snippet = status?.tracking_snippet;
  const copy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    toast.success('Tracking code copied');
  };

  if (!status?.enabled) {
    return (
      <div className="mx-auto max-w-3xl py-6 sm:py-12">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-7">
            <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BarChart3 size={20} /></span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Enable analytics for {domain}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Get privacy-friendly traffic analytics directly inside OpenDomains. Analytics is powered by our own Umami instance and is opt-in for each domain.
            </p>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-3">
            {[
              [Users, 'Visitors', 'Unique visitors and visits'],
              [MousePointerClick, 'Traffic', 'Pages and referrers'],
              [Globe2, 'Audience', 'Countries and devices'],
            ].map(([Icon, title, text]) => (
              <div key={title} className="bg-card p-4"><Icon size={16} className="text-primary" /><p className="mt-3 text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p></div>
            ))}
          </div>
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <p className="text-xs leading-5 text-muted-foreground">You will need to add one tracking script to your website after enabling analytics.</p>
            <Button onClick={onEnable} disabled={enabling} className="w-full gap-2 sm:w-auto">
              {enabling ? <RefreshCw size={14} className="animate-spin" /> : <BarChart3 size={14} />} Enable Analytics
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Check size={15} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Analytics is enabled</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Add this script before the closing <code>&lt;/head&gt;</code> tag on your site. Data will start appearing after visitors load a tracked page.</p>
          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] text-foreground"><code>{snippet}</code></pre>
            <Button variant="outline" onClick={copy} className="shrink-0 gap-2"><Copy size={14} /> Copy</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const query = new URLSearchParams(window.location.search);
  const requested = query.get('subdomain') || '';
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState(requested);
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [days, setDays] = useState('30');
  const [refreshing, setRefreshing] = useState(false);

  const loadDomains = async () => {
    const user = await rootminster.auth.me();
    const rows = await rootminster.entities.SubdomainOwnership.filter({ owner_id: user.id });
    const available = rows.filter(row => row.status !== 'suspended').sort((a, b) => a.full_name.localeCompare(b.full_name));
    setDomains(available);
    const validRequested = available.some(row => row.full_name === requested);
    const selected = validRequested ? requested : available[0]?.full_name || '';
    setDomain(selected);
    if (selected && selected !== requested) navigate(`/analytics?subdomain=${encodeURIComponent(selected)}`, { replace: true });
    return selected;
  };

  const loadStatus = async selected => {
    if (!selected) return null;
    const response = await rootminster.functions.invoke('analyticsManager', { action: 'status', subdomain: selected });
    setStatus(response.data);
    return response.data;
  };

  const loadStats = async (selected = domain, selectedDays = days) => {
    if (!selected) return;
    setRefreshing(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const response = await rootminster.functions.invoke('analyticsManager', {
        action: 'stats', subdomain: selected, days: Number(selectedDays), timezone,
      });
      setStats(response.data);
    } catch (error) {
      setStats(null);
      toast.error(error?.response?.data?.error || error?.message || 'Could not load analytics');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const selected = await loadDomains();
        if (selected) {
          const current = await loadStatus(selected);
          if (current?.enabled) await loadStats(selected, days);
        }
      } catch (error) {
        toast.error(error?.response?.data?.error || error?.message || 'Could not load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);  

  const changeDomain = async value => {
    setDomain(value);
    setStats(null);
    navigate(`/analytics?subdomain=${encodeURIComponent(value)}`, { replace: true });
    try {
      const current = await loadStatus(value);
      if (current?.enabled) await loadStats(value, days);
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Could not load analytics');
    }
  };

  const enable = async () => {
    setEnabling(true);
    try {
      const response = await rootminster.functions.invoke('analyticsManager', { action: 'enable', subdomain: domain });
      setStatus(response.data);
      toast.success('Analytics enabled');
      await loadStats(domain, days);
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Could not enable analytics');
    } finally {
      setEnabling(false);
    }
  };

  const traffic = useMemo(() => {
    const source = stats?.pageviews?.pageviews || stats?.pageviews?.views || [];
    const visitors = stats?.pageviews?.visitors || stats?.pageviews?.sessions || [];
    const visitorMap = new Map(visitors.map(point => [point.x, point.y]));
    return source.map(point => ({
      time: point.x,
      pageviews: Number(point.y || 0),
      visitors: Number(visitorMap.get(point.x) || 0),
      label: new Date(point.x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }));
  }, [stats]);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><RefreshCw size={20} className="animate-spin text-primary" /></div>;

  if (!domains.length) return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <Globe2 size={28} className="mx-auto text-muted-foreground" />
      <h1 className="mt-4 text-lg font-semibold text-foreground">No domains available</h1>
      <p className="mt-2 text-sm text-muted-foreground">Register a subdomain before enabling analytics.</p>
    </div>
  );

  const summary = stats?.stats || {};
  const bounce = summary.visits ? Math.round((Number(summary.bounces || 0) / Number(summary.visits)) * 100) : 0;
  const active = Number(stats?.active?.x ?? stats?.active?.visitors ?? stats?.active ?? 0);
  const metricRows = [
    ...(stats?.metrics?.pages || []),
    ...(stats?.metrics?.referrers || []),
    ...(stats?.metrics?.countries || []),
    ...(stats?.metrics?.devices || []),
  ];
  const hasAnalyticsData = Number(summary.visitors || 0) > 0
    || Number(summary.pageviews || 0) > 0
    || Number(summary.visits || 0) > 0
    || active > 0
    || traffic.some(point => point.pageviews > 0 || point.visitors > 0)
    || metricRows.some(row => metricValue(row) > 0);
  const waitingForFirstData = Boolean(status?.enabled && stats && !hasAnalyticsData);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Insights</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Privacy-friendly website analytics powered by OpenDomains.</p>
        </div>
        <Select value={domain} onValueChange={changeDomain}>
          <SelectTrigger className="h-9 w-full bg-card font-mono text-xs sm:w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>{domains.map(item => <SelectItem key={item.id} value={item.full_name} className="font-mono text-xs">{item.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!status?.enabled ? (
        <Setup domain={domain} status={status} onEnable={enable} enabling={enabling} />
      ) : (
        <>
          {waitingForFirstData && (
            <Setup domain={domain} status={status} onEnable={enable} enabling={enabling} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Tracking enabled for <span className="font-mono text-foreground">{domain}</span></div>
            <div className="flex items-center gap-2">
              <Select value={days} onValueChange={async value => { setDays(value); await loadStats(domain, value); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">Last 24 hours</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => loadStats()} disabled={refreshing} className="h-8 gap-2"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh</Button>
            </div>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
            <Stat icon={Users} label="Visitors" value={number(summary.visitors)} />
            <Stat icon={Eye} label="Pageviews" value={number(summary.pageviews)} />
            <Stat icon={Activity} label="Visits" value={number(summary.visits)} />
            <Stat icon={ArrowUpRight} label="Bounce rate" value={`${bounce}%`} />
            <Stat icon={Timer} label="Avg. visit" value={duration(summary.totaltime, summary.visits)} sub={`${number(active)} active now`} />
          </div>

          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div><h2 className="text-sm font-semibold text-foreground">Traffic</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Pageviews and visitors over time</p></div>
              <BarChart3 size={16} className="text-muted-foreground" />
            </div>
            <div className="h-[260px] w-full p-3 sm:h-[320px] sm:p-5">
              {traffic.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={traffic} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="pageviews" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="visitors" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Waiting for traffic data.</div>}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <MetricList title="Top pages" rows={stats?.metrics?.pages || []} />
            <MetricList title="Top referrers" rows={stats?.metrics?.referrers || []} empty="No referrer data yet" />
            <MetricList title="Countries" rows={stats?.metrics?.countries || []} />
            <MetricList title="Devices" rows={stats?.metrics?.devices || []} />
          </div>

          {!waitingForFirstData && (
            <Setup domain={domain} status={status} onEnable={enable} enabling={enabling} />
          )}

        </>
      )}
    </div>
  );
}
