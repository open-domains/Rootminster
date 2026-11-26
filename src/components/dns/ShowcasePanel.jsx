import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const HIDDEN_REASONS = {
  suspended: 'Hidden while this subdomain is suspended.',
  abuse_report: 'Hidden while an abuse report about this site is open.',
  health_check: 'Hidden because the last daily DNS health check found a problem. Fix the records and it will reappear after the next check.',
  owner_disabled: 'Hidden.',
};

// Lets an owner list this subdomain in the public showcase. Listings are reviewed first.
export default function ShowcasePanel({ hostname }) {
  const [listing, setListing] = useState(undefined);
  const [form, setForm] = useState({ title: '', description: '', tags: '', show_owner: false });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = (value) => {
    setListing(value);
    if (value) setForm({ title: value.title, description: value.description, tags: (value.tags || []).join(', '), show_owner: value.show_owner });
  };

  useEffect(() => {
    rootminster.functions.invoke('manageShowcase', { action: 'get', hostname })
      .then((response) => apply(response.data?.listing || null))
      // Only the owner of this exact subdomain can list it; hide the panel for anyone else.
      .catch(() => setListing('unavailable'));
  }, [hostname]);

  const call = async (action) => {
    setSaving(true);
    try {
      const response = await rootminster.functions.invoke('manageShowcase', { action, hostname, ...form });
      apply(response.data?.listing || null);
      if (action === 'remove') setForm({ title: '', description: '', tags: '', show_owner: false });
      toast.success(action === 'remove' ? 'Removed from the showcase.' : response.data?.listing?.status === 'pending' ? 'Sent for review. We will email you when it is decided.' : 'Saved.');
      setOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not save the listing');
    } finally {
      setSaving(false);
    }
  };

  if (listing === undefined || listing === 'unavailable') return null;
  const status = !listing ? null
    : listing.status === 'pending' ? 'Waiting for review.'
      : listing.status === 'rejected' ? `Not approved${listing.review_note ? `: ${listing.review_note}` : '.'} Edit and resubmit if you like.`
        : listing.visible ? 'Listed in the showcase.' : HIDDEN_REASONS[listing.hidden_reason] || 'Approved but hidden right now.';

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={18} aria-hidden="true" /> Public Showcase</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {status || <>Optionally list this project on the <Link to="/showcase" className="text-primary underline">showcase page</Link>. Our team reviews each listing first.</>}
          </p>
        </div>
        {!open && <Button variant="outline" onClick={() => setOpen(true)} className="min-h-11 shrink-0">{listing ? 'Edit Listing' : 'Add to Showcase'}</Button>}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <Input value={form.title} maxLength={60} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Project name" aria-label="Project name" />
          <Input value={form.description} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="One line about what it is" aria-label="One-line description" />
          <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags, comma separated (up to 5)" aria-label="Tags" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><Checkbox checked={form.show_owner} onCheckedChange={(value) => setForm((current) => ({ ...current, show_owner: value === true }))} /> Show My Name on the Listing</label>
          <p className="text-xs text-muted-foreground">Text only, no links: the listing links to {hostname}. Changing the text sends it back for review.</p>
          <div className="flex flex-wrap justify-end gap-2">
            {listing && <Button variant="ghost" disabled={saving} onClick={() => call('remove')} className="text-destructive">Remove Listing</Button>}
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving || !form.title.trim() || !form.description.trim()} onClick={() => call('save')} className="gap-2">{saving && <Loader2 size={14} className="animate-spin" />} {listing ? 'Save' : 'Submit for Review'}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
