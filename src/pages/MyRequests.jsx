import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Clock3, CheckCircle2, XCircle, MessageCircle, ChevronRight, Globe2, ExternalLink, RotateCcw } from 'lucide-react';
import CarbonAd from '@/components/CarbonAd';
import StatusBadge from '@/components/StatusBadge';
import RequestModal from '@/components/RequestModal';
import AppealModal from '@/components/AppealModal';
import ConversationThread from '@/components/ConversationThread';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_ICON = {
  pending: Clock3,
  needs_info: MessageCircle,
  approved: CheckCircle2,
  rejected: XCircle,
};

function useStatusMeta() {
  const { t } = useTranslation();
  return {
    pending: { label: t('myRequests.statusPendingLabel'), icon: Clock3, tone: 'text-primary', detail: t('myRequests.statusPendingDetail') },
    needs_info: { label: t('myRequests.statusNeedsInfoLabel'), icon: MessageCircle, tone: 'text-accent', detail: t('myRequests.statusNeedsInfoDetail') },
    approved: { label: t('myRequests.statusApprovedLabel'), icon: CheckCircle2, tone: 'text-emerald-400', detail: t('myRequests.statusApprovedDetail') },
    rejected: { label: t('myRequests.statusRejectedLabel'), icon: XCircle, tone: 'text-destructive', detail: t('myRequests.statusRejectedDetail') },
  };
}

function RequestDetail({ request, user, onBack, onAppeal }) {
  const { t } = useTranslation();
  const STATUS_META = useStatusMeta();
  const meta = STATUS_META[request.status] || STATUS_META.pending;
  const Icon = meta.icon;
  const fullName = request.full_name || `${request.subdomain}.${request.root_domain}`;

  const detailRows = [
    [t('myRequests.detailsDomain'), fullName],
    [t('myRequests.detailsRecordType'), request.record_type || '—'],
    [t('myRequests.detailsTarget'), request.record_value || '—'],
    [t('myRequests.detailsRoot'), request.root_domain || '—'],
    [t('myRequests.detailsSubmitted'), request.created_date ? format(new Date(request.created_date), 'd MMM yyyy, HH:mm') : '—'],
    [t('myRequests.detailsReviewed'), request.reviewed_at ? format(new Date(request.reviewed_at), 'd MMM yyyy, HH:mm') : t('myRequests.notReviewed')],
  ];
  const monoLabels = [t('myRequests.detailsDomain'), t('myRequests.detailsTarget'), t('myRequests.detailsRoot')];

  const nextKey = {
    pending: 'myRequests.nextPending',
    needs_info: 'myRequests.nextNeedsInfo',
    approved: 'myRequests.nextApproved',
    rejected: 'myRequests.nextRejected',
  }[request.status];

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight size={13} className="rotate-180" /> {t('myRequests.backToRequests')}
      </button>

      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('myRequests.eyebrowRequest')}</p>
          <h1 className="truncate font-mono text-2xl font-semibold tracking-tight text-foreground">{fullName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{request.created_date ? t('myRequests.submittedOn', { date: format(new Date(request.created_date), 'd MMMM yyyy') }) : t('myRequests.submittedRecently')}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3.5', request.status === 'needs_info' ? 'border-accent/30 bg-accent/10' : 'border-border bg-card')}>
        <Icon size={17} className={cn('mt-0.5 shrink-0', meta.tone)} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', meta.tone)}>{meta.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.detail}</p>
        </div>
        {request.status === 'rejected' && (
          <Button size="sm" variant="outline" onClick={() => onAppeal(request)} className="h-8 shrink-0 gap-1.5 text-xs">
            <RotateCcw size={12} /> {t('myRequests.appeal')}
          </Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">{t('myRequests.detailsTitle')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {detailRows.map(([label, value]) => (
                <div key={label} className="bg-card px-5 py-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className={cn('mt-1.5 text-sm text-foreground', monoLabels.includes(label) && 'font-mono break-all')}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          {(request.reason || request.preview_link) && (
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold text-foreground">{t('myRequests.projectInfo')}</h2></div>
              <div className="space-y-4 px-5 py-4">
                {request.reason && (
                  <div><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('myRequests.description')}</p><p className="mt-1.5 text-sm leading-relaxed text-foreground">{request.reason}</p></div>
                )}
                {request.preview_link && (
                  <a href={request.preview_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80">
                    <ExternalLink size={13} /> {t('myRequests.openPreview')}
                  </a>
                )}
              </div>
            </section>
          )}

          {request.rejection_reason && (
            <section className="rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-4">
              <p className="text-xs font-semibold text-destructive">{t('myRequests.reviewNote')}</p>
              <p className="mt-1.5 text-sm text-destructive/90">{request.rejection_reason}</p>
            </section>
          )}

          <ConversationThread requestId={request.id} requestType="subdomain" currentUser={user} readOnly={request.status === 'approved'} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground">{t('myRequests.timeline')}</p>
            <ol className="mt-4 space-y-4">
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><div><p className="text-xs font-medium text-foreground">{t('myRequests.tlSubmitted')}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{request.created_date ? formatDistanceToNow(new Date(request.created_date), { addSuffix: true }) : t('myRequests.recently')}</p></div></li>
              <li className="flex gap-3"><span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', request.status === 'pending' ? 'bg-primary' : 'bg-emerald-400')} /><div><p className="text-xs font-medium text-foreground">{t('myRequests.tlReview')}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{request.status === 'pending' ? t('myRequests.tlReviewInProgress') : request.reviewed_at ? format(new Date(request.reviewed_at), 'd MMM yyyy') : t('myRequests.tlReviewCompleted')}</p></div></li>
              <li className="flex gap-3"><span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', request.status === 'approved' ? 'bg-emerald-400' : request.status === 'rejected' ? 'bg-destructive' : request.status === 'needs_info' ? 'bg-accent' : 'bg-muted-foreground/30')} /><div><p className="text-xs font-medium text-foreground">{t('myRequests.tlOutcome')}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{meta.label}</p></div></li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground">{t('myRequests.whatsNext')}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {nextKey ? t(nextKey) : ''}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function MyRequests() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [appealRequest, setAppealRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const u = await rootminster.auth.me();
      setUser(u);
      const reqs = await rootminster.entities.SubdomainRequest.filter({ requester_email: u.email }, '-created_date', 100);
      setRequests(reqs);
      if (selectedRequest) {
        const fresh = reqs.find(r => r.id === selectedRequest.id);
        if (fresh) setSelectedRequest(fresh);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    needs_info: requests.filter(r => r.status === 'needs_info').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  const filtered = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${r.subdomain} ${r.root_domain} ${r.record_type} ${r.record_value || ''}`.toLowerCase().includes(q);
  });

  if (selectedRequest) {
    return <RequestDetail request={selectedRequest} user={user} onBack={() => setSelectedRequest(null)} onAppeal={setAppealRequest} />;
  }

  const stats = [
    [t('myRequests.statPending'), counts.pending],
    [t('myRequests.statNeedsReply'), counts.needs_info],
    [t('myRequests.statApproved'), counts.approved],
    [t('myRequests.statRejected'), counts.rejected],
  ];

  const filters = [
    ['all', t('myRequests.filterAll')],
    ['pending', t('myRequests.filterPending')],
    ['needs_info', t('myRequests.filterNeedsReply')],
    ['approved', t('myRequests.filterApproved')],
    ['rejected', t('myRequests.filterRejected')],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('myRequests.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('myRequests.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('myRequests.subtitle')}</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="h-9 gap-2 px-4"><Plus size={15} /> {t('myRequests.newRequest')}</Button>
      </div>

      {!loading && requests.length > 0 && (
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
          {stats.map(([label, value], index) => (
            <div key={label} className={cn('px-4 py-3.5', index > 0 && 'border-l border-border')}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <Globe2 size={34} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-foreground">{t('myRequests.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('myRequests.emptyBody')}</p>
          <Button onClick={() => setShowModal(true)} className="mt-5 gap-2"><Plus size={14} /> {t('myRequests.newRequest')}</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('myRequests.searchPlaceholder')} className="h-8 pl-9 text-xs" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {filters.map(([id, label]) => (
                <button key={id} onClick={() => setFilter(id)} className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors', filter === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
                  {label} <span className="ml-1 text-[10px] tabular-nums opacity-70">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {filtered.map(request => {
              const Icon = STATUS_ICON[request.status] || Clock3;
              const fullName = request.full_name || `${request.subdomain}.${request.root_domain}`;
              const tone = { pending: 'text-primary', needs_info: 'text-accent', approved: 'text-emerald-400', rejected: 'text-destructive' }[request.status] || 'text-primary';
              return (
                <button key={request.id} onClick={() => setSelectedRequest(request)} className="group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/35">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background', tone)}><Icon size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-sm font-medium text-foreground">{fullName}</p>
                      {request.status === 'needs_info' && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{t('myRequests.actionRequired')}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{request.record_type} · {request.record_value || t('myRequests.noTarget')} · {request.created_date ? formatDistanceToNow(new Date(request.created_date), { addSuffix: true }) : ''}</p>
                    {request.rejection_reason && <p className="mt-1 truncate text-xs text-destructive/90">{request.rejection_reason}</p>}
                  </div>
                  <div className="hidden shrink-0 sm:block"><StatusBadge status={request.status} /></div>
                  <ChevronRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && <div className="px-6 py-12 text-center text-sm text-muted-foreground">{t('myRequests.noMatch')}</div>}
        </div>
      )}

      <CarbonAd className="mt-6" />
      <RequestModal open={showModal} onClose={() => setShowModal(false)} onSuccess={load} />
      <AppealModal request={appealRequest} open={!!appealRequest} onClose={() => setAppealRequest(null)} onSuccess={load} />
    </div>
  );
}