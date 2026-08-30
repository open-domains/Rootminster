import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { useTranslation } from 'react-i18next';
import {
  Globe, CheckCircle2, Plus, ChevronRight, MessageCircle, Github,
  AlertTriangle, ArrowRight, Server, Activity, MoreHorizontal, ShieldCheck,
} from 'lucide-react';
import CarbonAd from '@/components/CarbonAd';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RequestModal from '@/components/RequestModal';
import GithubMigrateModal from '@/components/GithubMigrateModal';
import StatusBadge from '@/components/StatusBadge';
import ConversationThread from '@/components/ConversationThread';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Mini Metric ────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'text-muted-foreground bg-muted/60',
    blue: 'text-primary bg-primary/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-accent bg-accent/10',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted/30">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tones[tone])}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-foreground text-lg font-semibold leading-none tabular-nums">{value}</p>
        <p className="text-muted-foreground text-[11px] mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Card shell ─────────────────────────────────────────────────────────────
function Card({ title, description, actions, children, empty, icon: Icon }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon size={15} className="text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-foreground font-semibold text-sm">{title}</h2>
            {description && <p className="text-muted-foreground text-xs mt-0.5 truncate">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children || (
        <div className="py-14 text-center px-6">
          <Globe size={24} className="text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">{empty}</p>
        </div>
      )}
    </div>
  );
}

// ─── Subdomain Row ──────────────────────────────────────────────────────────
function SubdomainRow({ records, pendingSubs, needsInfoSubs }) {
  const [expanded, setExpanded] = useState(false);
  const primary = records[0];
  const hasMultiple = records.length > 1;
  const overallStatus = records.some(r => r.status === 'active') ? 'active' : primary.status;
  const name = primary.name;
  const isPending = pendingSubs.has(name);
  const isIssue = needsInfoSubs.has(name) || records.some(r => r.status === 'suspended' || r.dns_verified === false);

  return (
    <div className="border-b border-border last:border-0 transition-colors hover:bg-muted/30">
      <div className="w-full flex items-center gap-3 px-5 py-3.5">
        <button
          onClick={() => hasMultiple && setExpanded(e => !e)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <Server size={14} className="text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-mono text-sm font-medium truncate">{name}</p>
            {!hasMultiple && (
              <p className="text-muted-foreground text-xs mt-0.5 font-mono truncate">{primary.record_type} → {primary.content}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPending && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">pending</span>}
            {isIssue && <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">issue</span>}
            {hasMultiple && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{records.length}</span>}
            <StatusBadge status={overallStatus} />
            {hasMultiple && <ChevronRight size={13} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-90')} />}
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Row actions" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <MoreHorizontal size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to={`/subdomain-dns-manager?subdomain=${encodeURIComponent(name)}`} className="flex items-center gap-2 cursor-pointer">
                <Server size={14} /> Manage DNS
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/my-requests" className="flex items-center gap-2 cursor-pointer">
                <Activity size={14} /> View Requests
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasMultiple && expanded && (
        <div className="bg-muted/20 border-t border-border divide-y divide-border/60">
          {records.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{r.record_type}</span>
              <span className="text-muted-foreground text-xs font-mono truncate flex-1">{r.content}</span>
              {r.proxied && <span className="text-accent text-xs" title="Proxied">☁</span>}
              <StatusBadge status={r.status || 'active'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Request Row ────────────────────────────────────────────────────────────
function RequestRow({ request, onView }) {
  const needsReply = request.status === 'needs_info';
  const { t } = useTranslation();
  return (
    <button
      onClick={() => onView(request)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left group border-b border-border last:border-0"
    >
      <Activity size={14} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-foreground font-mono text-sm truncate">{request.subdomain}.{request.root_domain}</p>
          {needsReply && (
            <span className="flex items-center gap-1 text-accent text-xs bg-accent/10 px-2 py-0.5 rounded border border-accent/25 shrink-0">
              <MessageCircle size={9} /> {t('dashboard.replyNeeded')}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs mt-0.5">
          {request.record_type} · {request.created_date ? formatDistanceToNow(new Date(request.created_date), { addSuffix: true }) : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={request.status} />
        <ChevronRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function UserDashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [ownedRecords, setOwnedRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [tab, setTab] = useState('all');

  const load = async () => {
    try {
      const u = await rootminster.auth.me();
      setUser(u);
      const [records, reqs] = await Promise.all([
        rootminster.entities.DnsRecord.filter({ owner_email: u.email }),
        rootminster.entities.SubdomainRequest.filter({ requester_email: u.email })
      ]);
      setOwnedRecords(records.filter(r => r.status !== 'suspended'));
      setRequests(reqs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex justify-center items-center py-32">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (selectedRequest) {
    return <RequestDetailView request={selectedRequest} user={user} onBack={() => { setSelectedRequest(null); load(); }} />;
  }

  const pending = requests.filter(r => r.status === 'pending').length;
  const needsInfo = requests.filter(r => r.status === 'needs_info').length;
  const approved = requests.filter(r => r.status === 'approved').length;

  const groupedRecords = Object.values(
    ownedRecords.reduce((acc, r) => { (acc[r.name] ||= []).push(r); return acc; }, {})
  );

  const pendingSubs = new Set(
    requests.filter(r => r.status === 'pending').map(r => `${r.subdomain}.${r.root_domain}`)
  );
  const needsInfoSubs = new Set(
    requests.filter(r => r.status === 'needs_info').map(r => `${r.subdomain}.${r.root_domain}`)
  );

  const tabPredicate = (group) => {
    const name = group[0].name;
    const isPending = pendingSubs.has(name);
    const isIssue = needsInfoSubs.has(name) || group.some(r => r.status === 'suspended' || r.dns_verified === false);
    const active = group.some(r => r.status === 'active');
    if (tab === 'all') return true;
    if (tab === 'active') return active && !isIssue;
    if (tab === 'pending') return isPending;
    if (tab === 'issues') return isIssue;
    return true;
  };

  const filteredGroups = groupedRecords.filter(tabPredicate);
  const hasIssues = groupedRecords.some(g => needsInfoSubs.has(g[0].name) || g.some(r => r.status === 'suspended' || r.dns_verified === false));

  // Activity feed: merge record creations + request events, newest first
  const activity = [
    ...ownedRecords.map(r => ({
      id: 'r' + r.id, date: r.created_date, type: 'record',
      label: `Subdomain ${r.name} added`, icon: Server,
    })),
    ...requests.map(r => ({
      id: 'q' + r.id, date: r.created_date, type: 'request', status: r.status,
      label: `Request for ${r.subdomain}.${r.root_domain}`,
      sub: r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : r.status === 'needs_info' ? 'Needs your reply' : 'Pending review',
      icon: r.status === 'needs_info' ? AlertTriangle : r.status === 'approved' ? CheckCircle2 : Activity,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

  const tabs = [
    { id: 'all', label: 'All', count: groupedRecords.length },
    { id: 'active', label: 'Active', count: groupedRecords.filter(g => g.some(r => r.status === 'active') && !(needsInfoSubs.has(g[0].name) || g.some(r => r.status === 'suspended' || r.dns_verified === false))).length },
    { id: 'pending', label: 'Pending', count: [...pendingSubs].filter(n => groupedRecords.some(g => g[0].name === n)).length },
    { id: 'issues', label: 'Issues', count: groupedRecords.filter(g => needsInfoSubs.has(g[0].name) || g.some(r => r.status === 'suspended' || r.dns_verified === false)).length },
  ];

  const firstName = (user?.display_name || user?.full_name)?.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* ─── Workspace header ─────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {firstName ? `Welcome, ${firstName}` : t('dashboard.title')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Manage your domains, DNS records and registration requests.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setShowMigrateModal(true)} variant="outline" className="h-9 gap-2">
            <Github size={14} /> Migrate
          </Button>
          <Button onClick={() => setShowModal(true)} className="h-9 gap-2 px-4">
            <Plus size={15} /> Add domain
          </Button>
        </div>
      </div>

      {/* Display name prompt */}
      {!user?.display_name && (
        <div className="bg-card border border-border rounded-2xl px-5 py-4">
          <p className="text-foreground text-sm font-medium mb-0.5">{t('dashboard.setDisplayName')}</p>
          <p className="text-muted-foreground text-xs mb-3">{t('dashboard.setDisplayNameSub')}</p>
          <div className="flex gap-2 max-w-sm">
            <Input
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder={t('dashboard.namePlaceholder')}
              className="h-9 text-sm"
              onKeyDown={e => e.key === 'Enter' && !savingName && displayNameInput.trim() && (async () => {
                setSavingName(true);
                await rootminster.auth.updateMe({ display_name: displayNameInput.trim() });
                const u = await rootminster.auth.me();
                setUser(u);
                setSavingName(false);
              })()}
            />
            <Button
              size="sm"
              disabled={!displayNameInput.trim() || savingName}
              onClick={async () => {
                setSavingName(true);
                await rootminster.auth.updateMe({ display_name: displayNameInput.trim() });
                const u = await rootminster.auth.me();
                setUser(u);
                setSavingName(false);
              }}
              className="shrink-0"
            >
              {savingName ? t('dashboard.saving') : t('dashboard.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Needs-info alert */}
      {needsInfo > 0 && (
        <div className="flex items-center gap-3 bg-accent/10 border border-accent/25 rounded-2xl px-5 py-3.5">
          <AlertTriangle size={15} className="text-accent shrink-0" />
          <p className="text-accent text-sm flex-1">{t('dashboard.needsInfoAlert', { count: needsInfo })}</p>
          <button
            onClick={() => { const r = requests.find(r => r.status === 'needs_info'); if (r) setSelectedRequest(r); }}
            className="text-accent text-xs flex items-center gap-1 hover:opacity-80 transition-opacity shrink-0 font-medium"
          >
            {t('dashboard.view')} <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ─── Account overview ─────────────────────────────── */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
        {[
          { label: 'Domains', value: groupedRecords.length, detail: 'registered' },
          { label: 'Approved', value: approved, detail: 'requests' },
          { label: 'Pending', value: pending, detail: 'under review' },
          { label: 'Needs attention', value: needsInfo, detail: needsInfo ? 'reply required' : 'all clear' },
        ].map((stat, index) => (
          <div key={stat.label} className={cn('px-4 py-3.5', index > 0 && 'border-l border-border')}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-foreground">{stat.value}</span>
              <span className="hidden text-xs text-muted-foreground md:inline">{stat.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Primary workspace ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">

          {/* Domain list with tabs */}
          <Card
            icon={Globe}
            title={t('dashboard.mySubdomains')}
            description={groupedRecords.length > 0 ? t('dashboard.subdomainsRegistered', { count: groupedRecords.length }) : undefined}
            actions={
              <Button onClick={() => setShowMigrateModal(true)} size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                <Github size={13} /> {t('dashboard.migrate')}
              </Button>
            }
            empty={t('dashboard.noSubdomains')}
          >
            {groupedRecords.length > 0 && (
              <div>
                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3 pb-3 border-b border-border">
                  {tabs.map(tb => {
                    const active = tab === tb.id;
                    return (
                      <button
                        key={tb.id}
                        onClick={() => setTab(tb.id)}
                        className={cn(
                          'group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                          active
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <span>{tb.label}</span>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] tabular-nums',
                          active ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground'
                        )}>{tb.count}</span>
                      </button>
                    );
                  })}
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="py-12 text-center px-6">
                    <Globe size={24} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground text-sm">No subdomains match this filter.</p>
                  </div>
                ) : (
                  filteredGroups.map(group => (
                    <SubdomainRow key={group[0].name} records={group} pendingSubs={pendingSubs} needsInfoSubs={needsInfoSubs} />
                  ))
                )}

                <div className="px-5 py-3 border-t border-border">
                  <Link to="/my-subdomains" className="text-primary hover:opacity-80 text-xs flex items-center gap-1 transition-opacity font-medium">
                    {t('dashboard.manageAll')} <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )}
          </Card>

          {/* Recent requests */}
          <Card
            icon={Activity}
            title={t('dashboard.recentRequests')}
            description={t('dashboard.requestHistory')}
            empty={t('dashboard.noRequests')}
          >
            {requests.length > 0 && (
              <div>
                {requests.slice(0, 8).map(r => (
                  <RequestRow key={r.id} request={r} onView={setSelectedRequest} />
                ))}
                {requests.length > 8 && (
                  <div className="px-5 py-3 border-t border-border">
                    <Link to="/my-requests" className="text-primary hover:opacity-80 text-xs flex items-center gap-1 transition-opacity font-medium">
                      {t('dashboard.viewAll', { count: requests.length })} <ArrowRight size={11} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>

          <CarbonAd />
        </div>

        {/* Right column — useful context only */}
          <aside className="space-y-6">

            {/* Quick Actions */}
            <Card icon={Plus} title="Quick Actions">
              <div className="p-4 grid grid-cols-2 gap-2.5">
                <button onClick={() => setShowModal(true)} className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 hover:bg-muted/40 transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Plus size={15} /></span>
                  <span className="text-sm font-medium text-foreground">New Subdomain</span>
                </button>
                <button onClick={() => setShowMigrateModal(true)} className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 hover:bg-muted/40 transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-foreground/10 text-foreground flex items-center justify-center"><Github size={15} /></span>
                  <span className="text-sm font-medium text-foreground">Migrate GitHub</span>
                </button>
                <Link to="/my-subdomains" className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 hover:bg-muted/40 transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Server size={15} /></span>
                  <span className="text-sm font-medium text-foreground">Manage DNS</span>
                </Link>
                <Link to="/settings" className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 hover:bg-muted/40 transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><ShieldCheck size={15} /></span>
                  <span className="text-sm font-medium text-foreground">Settings</span>
                </Link>
              </div>
            </Card>

            {/* Activity Feed (timeline) */}
            <Card icon={Activity} title="Activity" description="Recent account activity">
              <div className="p-4">
                {activity.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">No activity yet.</p>
                ) : (
                  <ol className="relative space-y-4">
                    <span aria-hidden className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />
                    {activity.map(ev => (
                      <li key={ev.id} className="relative flex items-start gap-3 pl-0">
                        <span className={cn('relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card bg-muted text-muted-foreground')}>
                          <ev.icon size={12} />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-foreground text-sm leading-snug">{ev.label}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {ev.sub ? ev.sub + ' · ' : ''}{ev.date ? formatDistanceToNow(new Date(ev.date), { addSuffix: true }) : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>

            {/* System Status / Health */}
            <Card icon={ShieldCheck} title="System Status">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full', hasIssues ? 'bg-accent' : 'bg-emerald-400')} />
                  <p className="text-sm font-medium text-foreground">{hasIssues ? 'Attention needed' : 'All Systems Operational'}</p>
                </div>
                <div className="space-y-2 pt-1">
                  {[
                    { label: 'DNS Sync', ok: true },
                    { label: 'Record Verification', ok: !ownedRecords.some(r => r.dns_verified === false) },
                    { label: 'Request Queue', ok: needsInfo === 0 },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className={cn('flex items-center gap-1.5 font-medium', s.ok ? 'text-emerald-400' : 'text-accent')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', s.ok ? 'bg-emerald-400' : 'bg-accent')} />
                        {s.ok ? 'Healthy' : 'Action'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

          </aside>
      </div>

      <RequestModal open={showModal} onClose={() => setShowModal(false)} onSuccess={load} />
      <GithubMigrateModal open={showMigrateModal} onClose={() => setShowMigrateModal(false)} onSuccess={load} />
    </div>
  );
}

// ─── Request Detail View ────────────────────────────────────────────────────
function RequestDetailView({ request, user, onBack }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        {t('dashboard.backToDashboard')}
      </button>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-primary font-mono font-semibold text-base truncate">{request.subdomain}.{request.root_domain}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{request.record_type} record</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{t('dashboard.pointsTo')}</p>
            <p className="text-foreground font-mono text-xs break-all">{request.record_value}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{t('dashboard.submitted')}</p>
            <p className="text-foreground text-xs">{request.created_date ? format(new Date(request.created_date), 'MMM d, yyyy') : '—'}</p>
          </div>
          {request.reason && (
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{t('dashboard.description')}</p>
              <p className="text-muted-foreground text-xs">{request.reason}</p>
            </div>
          )}
        </div>

        {request.rejection_reason && (
          <div className="mx-5 mb-4 bg-destructive/10 border border-destructive/25 rounded-lg px-4 py-3">
            <p className="text-destructive text-xs font-semibold mb-1">{t('dashboard.rejectionReason')}</p>
            <p className="text-destructive/90 text-xs">{request.rejection_reason}</p>
          </div>
        )}
      </div>

      {request.status === 'needs_info' && (
        <div className="flex items-start gap-3 bg-accent/10 border border-accent/25 rounded-2xl px-5 py-4">
          <AlertTriangle size={15} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-accent text-sm font-medium">{t('dashboard.responseRequired')}</p>
            <p className="text-accent/80 text-xs mt-0.5">{t('dashboard.responseRequiredSub')}</p>
          </div>
        </div>
      )}

      <ConversationThread requestId={request.id} requestType="subdomain" currentUser={user} />
    </div>
  );
}