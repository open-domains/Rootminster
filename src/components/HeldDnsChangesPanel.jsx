import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, Loader2, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// DNS changes on approved subdomains that re-screening held for staff. Hidden when empty.
export default function HeldDnsChangesPanel() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = async () => {
    try {
      setItems(await rootminster.entities.EditRequest.filter({ kind: 'dns_change', status: 'pending' }, '-created_date', 100));
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const review = async (item, decision) => {
    setBusy(`${item.id}:${decision}`);
    try {
      await rootminster.functions.invoke('reviewHeldDnsChange', { id: item.id, decision, note: notes[item.id] || '' });
      toast.success(decision === 'approve' ? 'Change applied and the user was emailed.' : 'Change rejected and the user was emailed.');
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not review the change');
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldAlert size={15} className="text-amber-500" /> DNS Changes Held for Review ({items.length})</h2>
      <p className="mt-1 text-xs text-muted-foreground">These edits to approved subdomains matched a threat check, so they were not applied. Approving applies the change exactly as submitted.</p>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const proposed = item.proposed || {};
          return (
            <li key={item.id} className="rounded-md border border-border bg-card p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm text-foreground">{item.hostname}</p>
                <span className="text-muted-foreground">{item.requester_email} · {item.created_date ? format(new Date(item.created_date), 'd MMM yyyy, HH:mm') : ''} · {item.source}</span>
              </div>
              <div className="mt-2 grid gap-1 font-mono sm:grid-cols-2">
                <p className="text-muted-foreground">{item.previous ? `Was: ${item.previous.record_type} ${item.previous.content}` : 'New Record'}</p>
                <p className="break-all text-foreground">Now: {proposed.record_type} {proposed.content}</p>
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {(item.safety_signals || []).map((signal, index) => <li key={`${signal.code}-${index}`} className="break-words">{signal.label}{signal.evidence ? `: ${signal.evidence}` : ''}</li>)}
              </ul>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input value={notes[item.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Note to the user (sent if rejected)" className="h-8 text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => review(item, 'reject')} className="h-8 gap-1">{busy === `${item.id}:reject` ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Reject</Button>
                  <Button size="sm" disabled={!!busy} onClick={() => review(item, 'approve')} className="h-8 gap-1">{busy === `${item.id}:approve` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve</Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
