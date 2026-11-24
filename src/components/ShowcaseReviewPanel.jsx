import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Staff queue for public showcase submissions. Hidden when empty.
export default function ShowcaseReviewPanel() {
  const [pending, setPending] = useState([]);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  const load = () => rootminster.functions.invoke('reviewShowcase', { action: 'list' })
    .then((response) => setPending(response.data?.pending || []))
    .catch(() => setPending([]));

  useEffect(() => { load(); }, []);

  const review = async (item, action) => {
    setBusy(`${item.id}:${action}`);
    try {
      await rootminster.functions.invoke('reviewShowcase', { action, id: item.id, note: notes[item.id] || '' });
      toast.success(action === 'approve' ? 'Listing approved.' : 'Listing rejected.');
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not review the listing');
    } finally {
      setBusy(null);
    }
  };

  if (!pending.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles size={15} /> Showcase submissions ({pending.length})</h2>
      <p className="mt-1 text-xs text-muted-foreground">Approved listings appear on the public showcase page. Check the site itself before approving: the platform vouches for this page.</p>
      <ul className="mt-3 space-y-3">
        {pending.map((item) => (
          <li key={item.id} className="rounded-md border border-border p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <a href={`https://${item.hostname}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-mono text-primary hover:underline">{item.hostname} <ExternalLink size={11} /></a>
            </div>
            <p className="mt-1 text-muted-foreground">{item.description}</p>
            <p className="mt-1 text-muted-foreground">{(item.tags || []).join(', ') || 'No tags'} · {item.owner_email}{item.show_owner ? ' · shows owner name' : ''}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input value={notes[item.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Note to the owner (sent if rejected)" className="h-8 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => review(item, 'reject')} className="h-8 gap-1">{busy === `${item.id}:reject` ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Reject</Button>
                <Button size="sm" disabled={!!busy} onClick={() => review(item, 'approve')} className="h-8 gap-1">{busy === `${item.id}:approve` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
