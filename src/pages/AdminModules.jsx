import { useEffect, useState } from 'react';
import { Boxes, CheckCircle2, Database, Eye, EyeOff, KeyRound, Loader2, Save, ServerCog, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

function ModuleCard({ module, onSaved }) {
  const [enabled, setEnabled] = useState(module.enabled);
  const [settings, setSettings] = useState(Object.fromEntries(module.fields.map((field) => [field.key, field.value ?? ''])));
  const [showSecrets, setShowSecrets] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(module.enabled);
    setSettings(Object.fromEntries(module.fields.map((field) => [field.key, field.value ?? ''])));
    setShowSecrets({});
  }, [module]);

  const save = async () => {
    setSaving(true);
    try {
      await rootminster.modules.update(module.id, { enabled, settings });
      toast.success(`${module.name} settings saved`);
      await onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not save module');
    } finally { setSaving(false); }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{module.name}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${module.source === 'database' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
              {module.source === 'database' ? 'Database' : 'ENV fallback'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`Enable ${module.name}`} />
      </div>

      <div className="space-y-4 p-5">
        {!module.fields.length && <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">This module only needs the enable switch.</div>}
        {module.fields.map((field) => {
          const secret = field.type === 'secret';
          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-foreground">{field.label}{field.required ? ' *' : ''}</label>
                {secret && field.configured && !settings[field.key] && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 size={11} /> Secret stored</span>}
              </div>
              {field.type === 'boolean' ? (
                <div className="flex h-10 items-center justify-between rounded-md border border-border px-3"><span className="text-xs text-muted-foreground">Enabled</span><Switch checked={settings[field.key] === true || settings[field.key] === 'true'} onCheckedChange={(value) => setSettings((current) => ({ ...current, [field.key]: value }))} /></div>
              ) : (
                <div className="relative">
                  <Input type={secret && !showSecrets[field.key] ? 'password' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={settings[field.key]} onChange={(event) => setSettings((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={secret && field.configured ? 'Leave blank to keep the stored secret' : ''} className={secret ? 'pr-10 font-mono text-xs' : ''} />
                  {secret && <button type="button" onClick={() => setShowSecrets((current) => ({ ...current, [field.key]: !current[field.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Show or hide secret">{showSecrets[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
                </div>
              )}
            </div>
          );
        })}
        <Button onClick={save} disabled={saving} className="w-full gap-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save module</Button>
      </div>
    </section>
  );
}

export default function AdminModules() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const load = async () => { try { setData(await rootminster.modules.list()); } catch (error) { toast.error(error.message || 'Could not load modules'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const importEnvironment = async () => {
    setImporting(true);
    try { await rootminster.modules.importEnvironment(); toast.success('Environment module settings imported into the database'); await load(); }
    catch (error) { toast.error(error?.response?.data?.error || error.message || 'Import failed'); }
    finally { setImporting(false); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  const inherited = data?.modules?.filter((module) => module.source === 'environment').length || 0;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-primary"><Boxes size={18} /><span className="text-xs font-semibold uppercase tracking-[.14em]">Platform modules</span></div><h1 className="text-2xl font-semibold tracking-tight text-foreground">Module settings</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Enable optional components and keep their configuration encrypted in Rootminster’s database.</p></div>
        {inherited > 0 && <Button variant="outline" onClick={importEnvironment} disabled={importing || !data?.encryption_configured} className="gap-2">{importing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Import existing ENV settings</Button>}
      </header>
      {!data?.encryption_configured && <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200"><TriangleAlert className="mt-0.5 shrink-0" size={18} /><div><p className="font-semibold">Module encryption key required</p><p className="mt-1 text-xs leading-5 text-amber-200/80">Set <code>MODULE_ENCRYPTION_KEY</code> once. This is one of the small bootstrap secrets that cannot safely live inside the database it encrypts.</p></div></div>}
      <div className="grid gap-4 md:grid-cols-2">{data?.modules?.map((module) => <ModuleCard key={module.id} module={module} onSaved={load} />)}</div>
      <div className="grid gap-3 rounded-xl border border-border bg-muted/25 p-4 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-2"><KeyRound size={15} className="mt-0.5 shrink-0 text-primary" /><p>Secrets are encrypted with AES-256-GCM before being written to PostgreSQL and are never returned to the browser.</p></div>
        <div className="flex gap-2"><ServerCog size={15} className="mt-0.5 shrink-0 text-primary" /><p>Database URL, app URL, runtime port and the encryption key remain bootstrap environment settings.</p></div>
      </div>
    </div>
  );
}
