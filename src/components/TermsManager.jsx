import { useEffect, useMemo, useState } from 'react';
import { FileClock, FilePlus2, Loader2, Rocket, Save, Trash2 } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import TermsContent from '@/components/TermsContent';

const emptyDraft = { version: '', title: 'Terms of Service', summary: '', content: '' };

function displayDate(value) {
  if (!value) return 'Not published';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function TermsManager() {
  const [versions, setVersions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => versions.find((item) => item.id === selectedId) || null, [versions, selectedId]);
  const editable = !selected || selected.status === 'draft';

  const load = async (preferredId) => {
    try {
      const rows = await rootminster.terms.listAdmin();
      setVersions(rows);
      const nextId = preferredId || selectedId || rows.find((item) => item.is_current)?.id || rows[0]?.id || null;
      const next = rows.find((item) => item.id === nextId) || null;
      setSelectedId(next?.id || null);
      setDraft(next ? { version: next.version, title: next.title, summary: next.summary || '', content: next.content } : emptyDraft);
    } catch (error) {
      toast.error(error.message || 'Could not load Terms versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const choose = (item) => {
    setSelectedId(item.id);
    setDraft({ version: item.version, title: item.title, summary: item.summary || '', content: item.content });
    setConfirmation('');
  };

  const startDraft = () => {
    setSelectedId(null);
    setDraft(emptyDraft);
    setConfirmation('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = selected ? await rootminster.terms.update(selected.id, draft) : await rootminster.terms.create(draft);
      toast.success(selected ? 'Terms draft saved' : 'Terms draft created');
      await load(result.id);
    } catch (error) {
      toast.error(error.message || 'Could not save Terms draft');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const result = await rootminster.terms.publish(selected.id, confirmation);
      toast.success(`Terms ${result.version} published`);
      setConfirmation('');
      await load(result.id);
    } catch (error) {
      toast.error(error.message || 'Could not publish Terms');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Delete draft ${selected.version}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await rootminster.terms.deleteDraft(selected.id);
      toast.success('Terms draft deleted');
      setSelectedId(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not delete Terms draft');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Version history</h2>
            <p className="text-xs text-muted-foreground">Published versions cannot be edited.</p>
          </div>
          <Button size="sm" onClick={startDraft} className="gap-1.5"><FilePlus2 size={13} /> New</Button>
        </div>
        <div className="space-y-2">
          {versions.map((item) => (
            <button key={item.id} type="button" onClick={() => choose(item)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === item.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">{item.version}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.is_current ? 'bg-emerald-500/10 text-emerald-400' : item.status === 'draft' ? 'bg-amber-500/10 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                  {item.is_current ? 'Current' : item.status === 'draft' ? 'Draft' : 'Previous'}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.title}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{displayDate(item.published_at)}</span>
                <span>{item.acceptance_count || 0} accepted</span>
              </div>
            </button>
          ))}
          {!versions.length && <p className="py-8 text-center text-sm text-muted-foreground">No Terms versions yet.</p>}
        </div>
      </aside>

      <section className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileClock size={16} /></div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{selected ? `${selected.status === 'draft' ? 'Edit' : 'View'} version ${selected.version}` : 'Create a Terms draft'}</h2>
                <p className="text-xs text-muted-foreground">Use Markdown for headings, lists and links.</p>
              </div>
            </div>
            {selected?.status === 'draft' && <Button variant="destructive" size="sm" onClick={remove} disabled={saving} className="gap-1.5"><Trash2 size={13} /> Delete draft</Button>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="terms-version">Version</Label><Input id="terms-version" value={draft.version} onChange={(event) => setDraft((state) => ({ ...state, version: event.target.value }))} placeholder="2026-09" disabled={!editable} /></div>
            <div className="space-y-1.5"><Label htmlFor="terms-title">Title</Label><Input id="terms-title" value={draft.title} onChange={(event) => setDraft((state) => ({ ...state, title: event.target.value }))} disabled={!editable} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="terms-summary">Acceptance summary</Label><Textarea id="terms-summary" value={draft.summary} onChange={(event) => setDraft((state) => ({ ...state, summary: event.target.value }))} placeholder="Briefly explain the important rules or what changed." disabled={!editable} className="min-h-20" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="terms-content">Terms content</Label><Textarea id="terms-content" value={draft.content} onChange={(event) => setDraft((state) => ({ ...state, content: event.target.value }))} placeholder={'## 1. Acceptance\n\nBy using the service...'} disabled={!editable} className="min-h-[420px] font-mono text-xs" /></div>
          </div>

          {editable && <div className="mt-4 flex justify-end"><Button onClick={save} disabled={saving} className="gap-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft</Button></div>}
        </div>

        {selected?.status === 'draft' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
            <h3 className="text-sm font-semibold text-foreground">Publish this version</h3>
            <p className="mt-1 text-xs text-muted-foreground">Publishing makes this the current Terms, locks its content, and asks every user who accepted an older version to accept again.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={`Type ${selected.version} to confirm`} />
              <Button onClick={publish} disabled={saving || confirmation !== selected.version} className="shrink-0 gap-2"><Rocket size={14} /> Publish</Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Preview</h3>
          <TermsContent>{draft.content || '*Your Terms preview will appear here.*'}</TermsContent>
        </div>
      </section>
    </div>
  );
}
