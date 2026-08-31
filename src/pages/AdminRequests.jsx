import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import StatusBadge from '@/components/StatusBadge';
import ReviewRequestModal from '@/components/ReviewRequestModal';
import SafetyBadge from '@/components/SafetyBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, AlertTriangle, Loader2, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

function RequestCard({ request, onReview, userNames = {} }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/20">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="font-mono text-primary text-sm font-medium truncate">
            {request.subdomain}.{request.root_domain}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5 truncate" title={request.requester_email}>{userNames[request.requester_email] || request.requester_email}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 min-w-0">
          {request._records?.map((r, i) => (
            <span key={i} className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{r.record_type}</span>
          ))}
        </div>
        <span className="text-muted-foreground text-xs shrink-0">{request.created_date ? format(new Date(request.created_date), 'MMM d, yyyy') : '—'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">Automated safety</span>
        <SafetyBadge verdict={request._safety?.verdict || request.safety_verdict} score={request._safety?.score ?? request.safety_score} overridden={request._safety?.overridden || request.safety_overridden} />
      </div>

      <Button size="sm" onClick={() => onReview(request)} className="w-full h-8 text-xs gap-1.5">
        <Eye size={13} /> {t('adminRequests.reviewRequest')}
      </Button>
    </div>
  );
}

function DnsIssueCard({ record, userNames = {} }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-destructive/30 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-primary text-sm font-medium truncate">{record.name}</p>
        <span className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">{record.record_type}</span>
      </div>
      <p className="font-mono text-xs text-foreground truncate">{record.content}</p>
      <p className="text-destructive text-xs">{record.dns_mismatch_reason || t('adminRequests.verificationFailed')}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span title={record.owner_email} className="truncate">{(record.owner_email && (userNames[record.owner_email] || record.owner_email)) || '—'}</span>
        <span className="shrink-0">{record.dns_last_checked ? format(new Date(record.dns_last_checked), 'MMM d, HH:mm') : '—'}</span>
      </div>
    </div>
  );
}

export default function AdminRequests() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('subdomain');
  const [requests, setRequests] = useState([]);
  const [safetyAssessments, setSafetyAssessments] = useState([]);
  const [dnsIssues, setDnsIssues] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dnsCheckRunning, setDnsCheckRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, reqs, dnsRecs, assessments] = await Promise.all([
        rootminster.auth.me(),
        rootminster.entities.SubdomainRequest.list('-created_date', 200),
        rootminster.entities.DnsRecord.filter({ managed: true, dns_verified: false }),
        rootminster.entities.SafetyAssessment.list('-created_date', 1000),
      ]);
      setUser(u);
      setRequests(reqs);
      setDnsIssues(dnsRecs);
      setSafetyAssessments(assessments);
      try {
        const users = await rootminster.entities.User.list();
        const map = {};
        users.forEach(usr => { if (usr.email) map[usr.email] = usr.display_name || usr.full_name || usr.email; });
        setUserNames(map);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const runDnsCheck = async () => {
    if (user?.role !== 'admin') return;
    setDnsCheckRunning(true);
    try {
      const res = await rootminster.functions.invoke('verifyDnsRecords', {});
      const result = res.data || {};
      toast.success(t('adminRequests.dnsCheckComplete', {
        checked: result.checked ?? 0,
        verified: result.verified ?? 0,
        failed: result.failed ?? 0,
      }));
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || t('adminRequests.dnsCheckFailed'));
    } finally {
      setDnsCheckRunning(false);
    }
  };

  useEffect(() => { load(); }, []);

  const assessmentByRequest = new Map();
  safetyAssessments.forEach((assessment) => {
    if (!assessmentByRequest.has(assessment.request_id)) assessmentByRequest.set(assessment.request_id, assessment);
  });

  const groupRequests = (reqs) => {
    const map = new Map();
    reqs.forEach(r => {
      const key = `${r.subdomain}.${r.root_domain}`;
      const enriched = { ...r, _safety: assessmentByRequest.get(r.id) || null };
      if (!map.has(key)) {
        map.set(key, { ...enriched, _records: [enriched] });
      } else {
        const group = map.get(key);
        group._records.push(enriched);
        const priority = { pending: 4, needs_info: 3, approved: 2, rejected: 1 };
        if ((priority[r.status] || 0) > (priority[group.status] || 0)) group.status = r.status;
        if (Number(enriched._safety?.score || r.safety_score || 0) > Number(group._safety?.score || group.safety_score || 0)) {
          group._safety = enriched._safety;
          group.safety_score = r.safety_score;
          group.safety_verdict = r.safety_verdict;
          group.safety_overridden = r.safety_overridden;
        }
      }
    });
    return Array.from(map.values());
  };

  const filteredRaw = statusFilter === 'all' ? requests : statusFilter === 'pending'
    ? requests.filter(r => r.status === 'pending' || r.status === 'user_responded')
    : requests.filter(r => r.status === statusFilter);
  const grouped = groupRequests(filteredRaw);
  const riskFiltered = riskFilter === 'all' ? grouped : grouped.filter((request) => {
    const assessment = request._safety;
    if (riskFilter === 'overridden') return assessment?.overridden || request.safety_overridden;
    if (riskFilter === 'incomplete') return !assessment || ['incomplete', 'disabled'].includes(assessment.verdict) || assessment.provider_status === 'failed';
    return (assessment?.verdict || request.safety_verdict) === riskFilter;
  });
  const filtered = (search
    ? riskFiltered.filter(r => `${r.subdomain}.${r.root_domain} ${r.requester_email}`.toLowerCase().includes(search.toLowerCase()))
    : riskFiltered).sort((a, b) => Number(b._safety?.score || b.safety_score || 0) - Number(a._safety?.score || a.safety_score || 0));

  const dnsFiltered = search
    ? dnsIssues.filter(r => `${r.name} ${r.owner_email} ${r.dns_mismatch_reason}`.toLowerCase().includes(search.toLowerCase()))
    : dnsIssues;


  const pendingSubdomains = groupRequests(requests.filter(r => r.status === 'pending' || r.status === 'user_responded')).length;
  const dnsIssueCount = dnsIssues.length;

  const tabs = [
    { id: 'subdomain', label: t('adminRequests.tabRequests'), count: pendingSubdomains, countColor: 'bg-amber-500/15 text-amber-400' },
    { id: 'dns', label: t('adminRequests.tabDns'), count: dnsIssueCount, countColor: 'bg-red-500/15 text-red-400', icon: <AlertTriangle size={13} /> },
  ];

  const filterLabels = {
    all: t('adminRequests.filterAll'),
    pending: t('adminRequests.filterPending'),
    approved: t('adminRequests.filterApproved'),
    rejected: t('adminRequests.filterRejected'),
    needs_info: t('adminRequests.filterNeedsInfo'),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('adminRequests.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('adminRequests.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('adminRequests.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && tab === 'dns' && (
            <Button onClick={runDnsCheck} disabled={dnsCheckRunning} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              {dnsCheckRunning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {dnsCheckRunning ? t('adminRequests.checkingDns') : t('adminRequests.checkAllDns')}
            </Button>
          )}
          <Button onClick={load} variant="ghost" size="icon" aria-label={t('adminRequests.refresh')} className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(tl => (
          <button key={tl.id} onClick={() => setTab(tl.id)}
            className={`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${tab === tl.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tl.icon}
            <span>{tl.label}</span>
            {tl.count > 0 && <span className={`${tl.countColor} text-xs px-1.5 py-0.5 rounded-full`}>{tl.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
          <div className="relative w-full flex-1 sm:min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder={t('adminRequests.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          {tab === 'subdomain' && (
            <div className="flex gap-2 flex-wrap">
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All risk levels</option>
                <option value="high_risk">High risk</option>
                <option value="review">Needs review</option>
                <option value="clear">Clear</option>
                <option value="incomplete">Incomplete</option>
                <option value="overridden">Staff overrides</option>
              </select>
              <div className="flex gap-1 flex-wrap">
              {['all', 'pending', 'approved', 'rejected', 'needs_info'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                  {filterLabels[s]}
                </button>
              ))}
              </div>
            </div>
          )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'subdomain' ? (
        filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{t('adminRequests.noSubdomain')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => <RequestCard key={r.id} request={r} onReview={setSelected} userNames={userNames} />)}
          </div>
        )
      ) : (
        dnsFiltered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">{t('adminRequests.noDns')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dnsFiltered.map(r => <DnsIssueCard key={r.id} record={r} userNames={userNames} />)}
          </div>
        )
      )}

      <ReviewRequestModal
        open={!!selected}
        request={selected}
        onClose={() => setSelected(null)}
        onSuccess={load}
      />
    </div>
  );
}
