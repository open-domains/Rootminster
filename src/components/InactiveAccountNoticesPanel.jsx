import { useEffect, useMemo, useState } from 'react';
import { BellRing, Loader2, RefreshCw, Search, UserX } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeCountdown } from '@/lib/countdown';

const statusLabels = {
  notified: { label: 'Notified', className: 'bg-amber-500/10 text-amber-800 dark:text-amber-300' },
  reminded: { label: 'Reminder sent', className: 'bg-orange-500/10 text-orange-800 dark:text-orange-300' },
  closed: { label: 'Disabled', className: 'bg-muted text-muted-foreground' },
};

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function Countdown({ value, now, done }) {
  if (done) return <span className="text-muted-foreground">{done}</span>;
  if (!value) return <span className="text-muted-foreground">No reminder</span>;
  return <span className="flex flex-col"><span className="font-medium text-foreground">{describeCountdown(value, now)}</span><span className="text-[11px] text-muted-foreground">{formatDate(value)}</span></span>;
}

function StatusPill({ status }) {
  const item = statusLabels[status] || statusLabels.notified;
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.className}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{item.label}</span>;
}

export default function InactiveAccountNoticesPanel({ moduleEnabled }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await rootminster.modules.inactiveAccountNotices()); setNow(Date.now()); }
    catch (err) { setError(err?.response?.data?.error || err.message || 'Could not load notified accounts'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  // Keep the countdowns current while the tab stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const notices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.notices || []).filter((notice) => !term || `${notice.email} ${notice.full_name || ''}`.toLowerCase().includes(term));
  }, [data, search]);
  const open = (data?.notices || []).filter((notice) => notice.status !== 'closed');
  const nextClosure = open[0]?.closure_expected_at;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="font-semibold">Notified accounts</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Accounts that were emailed an inactivity notice. Signing in or any other activity removes an account from this list. Times are when the daily cleanup run (03:45 UTC) will act.</p></div>
      <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0 gap-2">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Refresh</Button>
    </div>
    {!moduleEnabled && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">The module is switched off, so no reminders or closures will happen until it is enabled again.</p>}
    {data && <dl className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Awaiting closure</dt><dd className="mt-1 text-xl font-semibold">{open.length}</dd></div>
      <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Reminders still to send</dt><dd className="mt-1 text-xl font-semibold">{open.filter((notice) => notice.reminder_expected_at).length}</dd></div>
      <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Next closure</dt><dd className="mt-1 text-sm font-medium">{nextClosure ? describeCountdown(nextClosure, now) : '—'}</dd></div>
    </dl>}
    <div className="relative max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search notified accounts" placeholder="Search by email or name…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" />Loading notified accounts…</div>}
    {data && !notices.length && <div className="rounded-xl border border-dashed border-border p-10 text-center"><BellRing className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-medium">{data.notices.length ? 'No matching accounts' : 'No accounts have been notified'}</p><p className="mt-1 text-xs text-muted-foreground">{data.notices.length ? 'Try another search.' : 'Accounts appear here after the daily run emails them.'}</p></div>}
    {notices.length > 0 && <>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Notified</th><th className="px-4 py-3 font-medium">Reminder email</th><th className="px-4 py-3 font-medium">Account closes</th></tr></thead>
          <tbody className="divide-y divide-border">{notices.map((notice) => <tr key={notice.user_id} className="align-top">
            <td className="px-4 py-3"><div className="font-medium text-foreground">{notice.email}</div>{notice.full_name && <div className="text-xs text-muted-foreground">{notice.full_name}</div>}<div className="text-[11px] text-muted-foreground">Last active {formatDate(notice.last_activity_at)}</div></td>
            <td className="px-4 py-3"><StatusPill status={notice.status} /></td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(notice.notified_at)}</td>
            <td className="px-4 py-3 text-xs"><Countdown value={notice.reminder_expected_at} now={now} done={notice.reminder_sent_at ? `Sent ${formatDate(notice.reminder_sent_at)}` : notice.status === 'closed' ? '—' : ''} /></td>
            <td className="px-4 py-3 text-xs"><Countdown value={notice.closure_expected_at} now={now} done={notice.closed_at ? `Disabled ${formatDate(notice.closed_at)}` : ''} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">{notices.map((notice) => <li key={notice.user_id} className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="break-all text-sm font-medium">{notice.email}</div><div className="text-[11px] text-muted-foreground">Notified {formatDate(notice.notified_at)}</div></div><StatusPill status={notice.status} /></div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div><dt className="mb-1 flex items-center gap-1 text-muted-foreground"><BellRing size={12} />Reminder</dt><dd><Countdown value={notice.reminder_expected_at} now={now} done={notice.reminder_sent_at ? `Sent ${formatDate(notice.reminder_sent_at)}` : notice.status === 'closed' ? '—' : ''} /></dd></div>
          <div><dt className="mb-1 flex items-center gap-1 text-muted-foreground"><UserX size={12} />Closes</dt><dd><Countdown value={notice.closure_expected_at} now={now} done={notice.closed_at ? `Disabled ${formatDate(notice.closed_at)}` : ''} /></dd></div>
        </dl>
      </li>)}</ul>
    </>}
  </div>;
}
