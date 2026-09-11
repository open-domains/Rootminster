import { useEffect, useMemo, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ChevronDown, Search, ShieldAlert, UserX } from 'lucide-react';

const statusClass = {
  pending: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  denied: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/10 text-red-400',
};

function SummaryBlock({ title, rows = [], render }) {
  return (
    <section className="rounded-lg border border-border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{rows.length}</span>
      </div>
      {!rows.length ? <p className="text-xs text-muted-foreground">None</p> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id || JSON.stringify(row)} className="rounded border border-border/70 bg-card p-3 text-xs">
              {render ? render(row) : <pre className="whitespace-pre-wrap break-all">{JSON.stringify(row, null, 2)}</pre>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CaseRow({ item, onChanged }) {
  const [open, setOpen] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    if (caseData) return;
    setLoading(true);
    try {
      const result = await rootminster.accountDeletion.getAdmin(item.id);
      setCaseData(result.request);
    } catch (error) {
      toast.error(error.message || 'Failed to load deletion case');
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const decide = async (decision) => {
    if (decision === 'approve' && !window.confirm('Permanently delete this account, managed DNS records and associated Rootminster data? This cannot be undone.')) return;
    if (decision === 'deny' && !reason.trim()) return toast.error('Enter a reason before denying the request.');
    setActing(true);
    try {
      await rootminster.accountDeletion.decide(item.id, decision, reason);
      toast.success(decision === 'approve' ? 'Account deletion approved' : 'Deletion request denied');
      await onChanged();
    } catch (error) {
      toast.error(error.message || 'Could not process deletion request');
      await onChanged();
    } finally {
      setActing(false);
    }
  };

  const snapshot = caseData?.snapshot || item.snapshot || {};
  const account = snapshot.account || {};

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button onClick={toggle} className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/40">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"><UserX size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{item.user_name || item.user_email}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[item.status] || statusClass.pending}`}>{item.status}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{item.user_email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requested {new Date(item.requested_at).toLocaleString()}</p>
        </div>
        <ChevronDown size={16} className={`mt-2 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading case…</p> : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-background/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Role</p><p className="mt-1 text-sm font-medium">{account.role || item.user_role || 'user'}</p></div>
                <div className="rounded-lg border border-border bg-background/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account status</p><p className="mt-1 text-sm font-medium">{account.status || 'Unknown'}</p></div>
                <div className="rounded-lg border border-border bg-background/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subdomains</p><p className="mt-1 text-sm font-medium">{snapshot.subdomains?.length || 0}</p></div>
                <div className="rounded-lg border border-border bg-background/50 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requests</p><p className="mt-1 text-sm font-medium">{snapshot.requests?.length || 0}</p></div>
              </div>

              <section className="rounded-lg border border-border bg-background/50 p-4">
                <h3 className="text-sm font-semibold">Deletion request</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{caseData?.reason || item.reason || 'No reason supplied.'}</p>
              </section>

              <SummaryBlock title="Subdomains" rows={snapshot.subdomains || []} render={(row) => (
                <div><p className="font-mono text-primary">{row.full_name || [row.subdomain, row.root_domain].filter(Boolean).join('.')}</p><p className="mt-1 text-muted-foreground">Status: {row.status || 'unknown'}</p></div>
              )} />
              <SummaryBlock title="DNS records" rows={snapshot.dns_records || []} render={(row) => (
                <div><p className="font-mono text-foreground">{row.record_type || row.type} {row.name}</p><p className="mt-1 break-all text-muted-foreground">{row.content || row.record_value}</p></div>
              )} />
              <SummaryBlock title="Subdomain requests" rows={snapshot.requests || []} render={(row) => (
                <div><p className="font-mono text-primary">{row.full_name || [row.subdomain, row.root_domain].filter(Boolean).join('.')}</p><p className="mt-1 text-muted-foreground">Status: {row.status || 'unknown'} · {new Date(row.created_date).toLocaleString()}</p></div>
              )} />
              <SummaryBlock title="Other account data" rows={[
                ...(snapshot.donations || []).map((x) => ({ ...x, _kind: 'Donation' })),
                ...(snapshot.abuse_reports || []).map((x) => ({ ...x, _kind: 'Abuse report' })),
                ...(snapshot.api_tokens || []).map((x) => ({ ...x, _kind: 'API token' })),
                ...(snapshot.trusted_devices || []).map((x) => ({ ...x, _kind: 'Trusted device' })),
              ]} render={(row) => <div><p className="font-medium">{row._kind}</p><p className="mt-1 break-all text-muted-foreground">{row.name || row.subdomain || row.email || row.id}</p></div>} />

              {['pending', 'failed'].includes(item.status) && (
                <section className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Admin decision notes / denial reason</label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 min-h-24" placeholder="Required when denying. Optional internal context when approving." />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.status === 'pending' && <Button variant="outline" disabled={acting} onClick={() => decide('deny')}>Deny request</Button>}
                    <Button variant="destructive" disabled={acting} onClick={() => decide('approve')}>{item.status === 'failed' ? 'Retry permanent deletion' : 'Approve & permanently delete'}</Button>
                  </div>
                </section>
              )}

              {!['pending', 'failed'].includes(item.status) && (
                <section className="rounded-lg border border-border bg-background/50 p-4 text-sm">
                  <p><strong>Decision:</strong> {item.status}</p>
                  {caseData?.decision_reason && <p className="mt-1 text-muted-foreground">{caseData.decision_reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Notification: {caseData?.notification_status || item.notification_status || 'unknown'}</p>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAccountDeletionRequests() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await rootminster.accountDeletion.listAdmin();
      setItems(result.requests || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load account deletion requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.user_email, item.user_name, item.status, item.reason].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [items, search]);

  const pending = items.filter((item) => item.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Identity & privacy</p>
          <h1 className="text-2xl font-semibold tracking-tight">Account deletion requests</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Review each request with the user's account, subdomains, DNS records and request history before making a decision.</p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert size={14} /> {pending} pending</div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, email, status or reason…" className="pl-9" />
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading deletion cases…</p> : filtered.length ? (
        <div className="space-y-3">{filtered.map((item) => <CaseRow key={item.id} item={item} onChanged={load} />)}</div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No account deletion requests found.</div>
      )}
    </div>
  );
}
