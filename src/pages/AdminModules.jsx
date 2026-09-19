import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Boxes, Bug, CheckCircle2, Cloud, Container, CreditCard, Database, Eye, EyeOff, Github, KeyRound, Loader2, Mail, MessageSquare, Palette, RefreshCw, Save, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import R2BackupPanel from '@/components/R2BackupPanel';
import { moduleCategory, moduleStatus } from '@/lib/module-presentation';

const icons = { DNS: Cloud, Email: Mail, Authentication: KeyRound, Storage: Database, Monitoring: BarChart3, Integrations: MessageSquare, Payments: CreditCard, Appearance: Palette, Security: ShieldCheck, Infrastructure: Container };
const statusStyles = {
  configured: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  attention: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  disabled: 'bg-muted text-muted-foreground',
};

function ModuleIcon({ module }) {
  const Icon = module.id === 'github_oauth' ? Github : module.id === 'glitchtip' ? Bug : icons[moduleCategory(module)] || Boxes;
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={24} aria-hidden="true" /></span>;
}

function StatusBadge({ module }) {
  const status = moduleStatus(module);
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status.key]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status.label}</span>;
}

function ModuleSettings({ module, encryptionConfigured, onSaved, onBack }) {
  const [enabled, setEnabled] = useState(module.enabled);
  const [settings, setSettings] = useState(Object.fromEntries(module.fields.map((field) => [field.key, field.value ?? ''])));
  const [showSecrets, setShowSecrets] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = enabled !== module.enabled || module.fields.some((field) => String(settings[field.key]) !== String(field.value ?? ''));
  const status = moduleStatus(module);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const reset = (updated) => {
    setEnabled(updated.enabled);
    setSettings(Object.fromEntries(updated.fields.map((field) => [field.key, field.value ?? ''])));
    setShowSecrets({});
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await rootminster.modules.update(module.id, { enabled, settings });
      reset(result.module);
      onSaved(result.module);
      toast.success(`${module.name} settings saved`);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not save module');
    } finally { setSaving(false); }
  };

  const testGlitchTip = async () => {
    setTesting(true);
    try {
      const result = await rootminster.modules.testGlitchTip();
      toast.success(`Test event sent${result.event_id ? ` (${result.event_id})` : ''}`);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not send test event');
    } finally { setTesting(false); }
  };

  return <div className="space-y-6">
    <Button variant="ghost" disabled={saving || testing} className="-ml-3 gap-2 text-primary" onClick={() => { if (!dirty || window.confirm('Discard your unsaved module changes?')) onBack(); }}><ArrowLeft size={16} />All modules</Button>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4"><ModuleIcon module={module} /><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{module.name}</h1><StatusBadge module={module} /></div><p className="mt-2 max-w-xl text-sm text-muted-foreground">{module.description}</p></div></div>
      <div className="flex shrink-0 items-center gap-3"><label htmlFor="module-enabled" className="text-sm text-muted-foreground">Module enabled</label><Switch id="module-enabled" checked={enabled} disabled={saving || testing || !encryptionConfigured} onCheckedChange={setEnabled} /></div>
    </header>
    <Tabs defaultValue="settings">
      <TabsList className="mb-6"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger>{module.id === 'r2_backup' && <TabsTrigger value="backups">Backups</TabsTrigger>}{module.id === 'docker_engine' && <TabsTrigger value="projects">Projects</TabsTrigger>}</TabsList>
      <TabsContent value="overview" className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Module configuration</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Category</dt><dd className="mt-1 text-sm">{moduleCategory(module)}</dd></div><div><dt className="text-xs text-muted-foreground">Settings source</dt><dd className="mt-1 text-sm">{module.source === 'database' ? 'Saved settings' : 'Environment settings'}</dd></div><div><dt className="text-xs text-muted-foreground">Saved status</dt><dd className="mt-1"><StatusBadge module={module} /></dd></div></dl>
        <p className="mt-6 text-xs text-muted-foreground">Status reflects saved configuration. It does not verify the provider connection.</p>
      </TabsContent>
      <TabsContent value="settings">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <form noValidate onSubmit={save} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-5"><h2 className="font-semibold">{moduleCategory(module) === 'Security' ? 'Protection settings' : 'Configuration settings'}</h2><p className="mt-1 text-xs text-muted-foreground">Update this module’s configuration and save your changes.</p></div>
            <fieldset disabled={saving || testing || !encryptionConfigured} className="space-y-5 p-6">
              {!module.fields.length && <p className="text-sm text-muted-foreground">This module only needs the enable switch.</p>}
        {module.fields.map((field) => {
          const secret = field.type === 'secret';
          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`${module.id}-${field.key}`} className="text-sm font-medium text-foreground">{field.label}{field.required ? ' *' : ''}</label>
                {secret && field.configured && !settings[field.key] && <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={11} /> Secret stored</span>}
              </div>
              {field.type === 'boolean' ? (
                <div className="flex h-10 items-center justify-between rounded-md border border-border px-3"><span className="text-xs text-muted-foreground">Enabled</span><Switch id={`${module.id}-${field.key}`} checked={settings[field.key] === true || settings[field.key] === 'true'} onCheckedChange={(value) => setSettings((current) => ({ ...current, [field.key]: value }))} /></div>
              ) : field.type === 'select' ? (
                <Select value={String(settings[field.key])} onValueChange={(value) => setSettings((current) => ({ ...current, [field.key]: value }))}><SelectTrigger id={`${module.id}-${field.key}`}><SelectValue /></SelectTrigger><SelectContent>{field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
              ) : (
                <div className="relative">
                  <Input id={`${module.id}-${field.key}`} autoComplete={secret ? 'new-password' : 'off'} type={secret && !showSecrets[field.key] ? 'password' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} min={field.min} max={field.max} step={field.step} value={settings[field.key]} onChange={(event) => setSettings((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={secret && field.configured ? 'Leave blank to keep the stored secret' : ''} className={secret ? 'pr-10 font-mono text-xs' : ''} />
                  {secret && <button type="button" onClick={() => setShowSecrets((current) => ({ ...current, [field.key]: !current[field.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`${showSecrets[field.key] ? 'Hide' : 'Show'} ${field.label}`} aria-pressed={Boolean(showSecrets[field.key])}>{showSecrets[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
                </div>
              )}
              {field.description && <p className="text-[11px] leading-4 text-muted-foreground">{field.description}</p>}
            </div>
          );
        })}
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4">
              <span role="status" className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!dirty || saving || testing} onClick={() => reset(module)}>Reset</Button><Button type="submit" disabled={!dirty || saving || testing || !encryptionConfigured} className="gap-2">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save changes</Button></div>
            </div>
          </form>
          <aside className="space-y-4 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Configuration status</h2><StatusBadge module={module} />
            {status.missing.length > 0 && <p className="text-xs leading-5 text-muted-foreground">Missing: {status.missing.map((field) => field.label).join(', ')}.</p>}
            <p className="text-xs leading-5 text-muted-foreground">{module.enabled ? 'This status is based on required settings, not a live connection check.' : 'This module is switched off in the saved configuration.'}</p>
            <div className="flex gap-2 border-t border-border pt-4"><KeyRound size={16} className="shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">Stored secrets are never returned to your browser. Leave a secret blank to keep its existing value.</p></div>
            {module.id === 'glitchtip' && <><Button variant="outline" onClick={testGlitchTip} disabled={!module.enabled || dirty || saving || testing} className="w-full gap-2">{testing ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}Send test event</Button><p className="text-xs text-muted-foreground">Uses saved settings. Save changes before testing.</p></>}
          </aside>
        </div>
      </TabsContent>
      {module.id === 'r2_backup' && <TabsContent value="backups" className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Backup operations</h2><p className="mt-1 text-xs text-muted-foreground">Operations use your saved module settings.</p><R2BackupPanel moduleEnabled={module.enabled} /></TabsContent>}
      {module.id === 'docker_engine' && <TabsContent value="projects" className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Docker projects</h2><p className="mt-1 text-sm text-muted-foreground">Open the live Hostinger project view after saving and enabling this module.</p><Button asChild disabled={!module.enabled || dirty} className="mt-4 gap-2"><Link to="/docker-engine"><Container size={15} />Open Docker Engine</Link></Button>{(!module.enabled || dirty) && <p className="mt-2 text-xs text-muted-foreground">Save an enabled configuration before opening project controls.</p>}</TabsContent>}
    </Tabs>
  </div>;
}

export default function AdminModules() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [params, setParams] = useSearchParams();
  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await rootminster.modules.list()); }
    catch (err) { setError(err.message || 'Could not load modules'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const importEnvironment = async () => {
    if (!window.confirm('Import environment settings? This replaces saved settings for every module with the current environment configuration.')) return;
    setImporting(true);
    try { await rootminster.modules.importEnvironment(); toast.success('Environment module settings imported'); await load(); }
    catch (err) { toast.error(err?.response?.data?.error || err.message || 'Import failed'); }
    finally { setImporting(false); }
  };
  const navigate = (id) => { const next = new URLSearchParams(params); if (id) next.set('module', id); else next.delete('module'); setParams(next); };
  const modules = data?.modules || [];
  const selected = modules.find((module) => module.id === params.get('module'));
  const attention = modules.filter((module) => moduleStatus(module).key === 'attention');
  const categories = ['All', ...new Set(modules.map(moduleCategory))];
  const filtered = modules.filter((module) => (category === 'All' || moduleCategory(module) === category) && `${module.name} ${module.description} ${moduleCategory(module)}`.toLowerCase().includes(search.trim().toLowerCase()));

  if (loading) return <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="animate-spin text-primary" />Loading modules…</div>;
  if (error) return <div role="alert" className="mx-auto my-12 max-w-lg space-y-4 rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Could not load modules</h1><p className="text-sm text-muted-foreground">{error}</p><Button onClick={load} className="gap-2"><RefreshCw size={15} />Try again</Button></div>;

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 text-foreground sm:p-6 md:p-8">
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Administration</span><span>/</span>{selected ? <><span>Modules</span><span>/</span><span className="text-foreground">{selected.name}</span></> : <span className="text-foreground">Modules</span>}</nav>
    {!data?.encryption_configured && <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300"><TriangleAlert className="mt-0.5 shrink-0" size={18} /><div><p className="text-sm font-semibold">Module encryption key required</p><p className="mt-1 text-xs leading-5">Configure MODULE_ENCRYPTION_KEY on the server before saving or importing module settings.</p></div></div>}
    {selected ? <ModuleSettings key={selected.id} module={selected} encryptionConfigured={data.encryption_configured} onBack={() => navigate(null)} onSaved={(updated) => setData((current) => ({ ...current, modules: current.modules.map((module) => module.id === updated.id ? updated : module) }))} /> : <>
      {params.has('module') && <p role="alert" className="text-sm text-muted-foreground">That module could not be found. Choose a module below.</p>}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Modules</h1><p className="mt-2 text-sm text-muted-foreground">Manage the services that power your platform.</p></div><span className="text-sm text-muted-foreground">{modules.length} modules</span></header>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">{[{ key: 'configured', label: 'Configured' }, { key: 'attention', label: 'Needs attention' }, { key: 'disabled', label: 'Disabled' }].map((status) => <div key={status.key} className="rounded-xl border border-border bg-card p-3 sm:p-5"><div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${status.key === 'configured' ? 'bg-emerald-500' : status.key === 'attention' ? 'bg-amber-500' : 'bg-slate-400'}`} /><span className="text-2xl font-semibold tabular-nums">{modules.filter((module) => moduleStatus(module).key === status.key).length}</span></div><p className="mt-1 text-xs text-muted-foreground">{status.label}</p></div>)}</div>
      {attention.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><TriangleAlert size={20} className="shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="text-sm font-medium">{attention.length === 1 ? `${attention[0].name} needs attention` : `${attention.length} modules need attention`}</p><p className="mt-1 text-xs text-muted-foreground">Complete required settings for enabled modules.</p></div></div><Button variant="outline" onClick={() => navigate(attention[0].id)}>Review settings</Button></div>}
      <div className="flex flex-col gap-4"><div className="relative max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search modules" placeholder="Search modules…" value={search} onChange={(event) => setSearch(event.target.value)} className="bg-card pl-10" /></div><div aria-label="Filter by category" className="flex flex-wrap gap-2">{categories.map((item) => <Button key={item} variant={category === item ? 'default' : 'outline'} size="sm" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div></div>
      <div className="grid gap-4 md:grid-cols-2">{filtered.map((module) => <section key={module.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"><div className="flex items-start gap-4"><ModuleIcon module={module} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{module.name}</h2><StatusBadge module={module} /></div><p className="mt-1 text-xs text-muted-foreground">{moduleCategory(module)}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{module.description}</p></div></div><div className="mt-5 flex justify-end"><Button variant="outline" className="gap-2 text-primary" onClick={() => navigate(module.id)} aria-label={`Configure ${module.name}`}>Configure<ArrowRight size={14} /></Button></div></section>)}</div>
      {!filtered.length && <div className="rounded-xl border border-dashed border-border p-12 text-center"><Boxes className="mx-auto mb-3 text-muted-foreground" /><h2 className="font-semibold">{modules.length ? 'No matching modules' : 'No modules available'}</h2><p className="mt-2 text-sm text-muted-foreground">{modules.length ? 'Try another search or category.' : 'Modules will appear here when available.'}</p>{modules.length > 0 && <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</Button>}</div>}
      {modules.some((module) => module.source === 'environment') && <details className="rounded-xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-medium">Advanced: import environment settings</summary><p className="my-3 text-xs leading-5 text-muted-foreground">Replace all saved module settings with server environment settings. This can overwrite existing configuration.</p><Button variant="outline" onClick={importEnvironment} disabled={importing || !data?.encryption_configured} className="gap-2">{importing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}Import environment settings</Button></details>}
    </>}
  </div>;
}
