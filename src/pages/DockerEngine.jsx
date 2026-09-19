import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Container, Loader2, Play, RefreshCw, RotateCcw, ScrollText, ShieldCheck, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const actionDetails = {
  start: { label: 'Start', icon: Play, confirmation: null },
  stop: { label: 'Stop', icon: Square, confirmation: 'Stop every container in this project?' },
  restart: { label: 'Restart', icon: RotateCcw, confirmation: 'Restart every container in this project?' },
  update: { label: 'Update', icon: RefreshCw, confirmation: 'Pull the latest images and recreate this project?' },
};

function stateTone(state) {
  if (state === 'running') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (state === 'mixed' || state === 'restarting') return 'bg-amber-500/10 text-amber-800 dark:text-amber-300';
  return 'bg-muted text-muted-foreground';
}

function bytes(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(amount) / Math.log(1024)), units.length - 1);
  return `${(amount / (1024 ** unit)).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function Containers({ projectName }) {
  const [state, setState] = useState({ loading: true, error: '', containers: [] });
  useEffect(() => {
    let active = true;
    rootminster.docker.containers(projectName)
      .then((result) => active && setState({ loading: false, error: '', containers: result.containers || [] }))
      .catch((error) => active && setState({ loading: false, error: error.message, containers: [] }));
    return () => { active = false; };
  }, [projectName]);
  if (state.loading) return <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" />Loading live container details…</div>;
  if (state.error) return <p role="alert" className="py-4 text-xs text-destructive">{state.error}</p>;
  if (!state.containers.length) return <p className="py-4 text-xs text-muted-foreground">No containers were returned for this project.</p>;
  return <div className="mt-4 overflow-x-auto rounded-lg border border-border">
    <table className="w-full min-w-[680px] text-left text-xs">
      <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Container</th><th className="px-3 py-2 font-medium">Image</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">CPU</th><th className="px-3 py-2 font-medium">Memory</th></tr></thead>
      <tbody>{state.containers.map((container) => <tr key={container.id || container.name} className="border-t border-border"><td className="px-3 py-2 font-medium">{container.name}</td><td className="max-w-[260px] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground" title={container.image}>{container.image}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 ${stateTone(container.state)}`}>{container.health || container.state || 'unknown'}</span></td><td className="px-3 py-2 tabular-nums">{container.stats ? `${Number(container.stats.cpu_percentage || 0).toFixed(1)}%` : '—'}</td><td className="px-3 py-2 tabular-nums">{container.stats ? `${bytes(container.stats.memory_used)} (${Number(container.stats.memory_percentage || 0).toFixed(1)}%)` : '—'}</td></tr>)}</tbody>
    </table>
  </div>;
}

export default function DockerEngine() {
  const [data, setData] = useState({ projects: [], protected_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState('');
  const [busy, setBusy] = useState('');
  const [logs, setLogs] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await rootminster.docker.projects()); }
    catch (loadError) { setError(loadError.message || 'Could not load Docker projects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const run = async (project, action) => {
    const detail = actionDetails[action];
    if (detail.confirmation && !window.confirm(`${detail.confirmation}\n\nProject: ${project.name}`)) return;
    const key = `${project.name}:${action}`; setBusy(key);
    try {
      const result = await rootminster.docker.action(project.name, action);
      toast.success(`${detail.label} request sent to ${project.name}${result.action?.state ? ` (${result.action.state})` : ''}`);
      await load();
    } catch (actionError) { toast.error(actionError.message || `Could not ${action} ${project.name}`); }
    finally { setBusy(''); }
  };

  const showLogs = async (project) => {
    setBusy(`${project.name}:logs`);
    try { const result = await rootminster.docker.logs(project.name); setLogs({ project: project.name, groups: result.logs || [] }); }
    catch (logsError) { toast.error(logsError.message || 'Could not load logs'); }
    finally { setBusy(''); }
  };

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 md:p-8">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Infrastructure</p><h1 className="text-3xl font-semibold tracking-tight">Docker Engine</h1><p className="mt-2 text-sm text-muted-foreground">Live Hostinger VPS Docker Compose projects and controls.</p></div><Button variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</Button></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-4"><Container className="text-primary" size={18} /><p className="mt-3 text-2xl font-semibold tabular-nums">{data.projects.length}</p><p className="text-xs text-muted-foreground">Manageable projects</p></div><div className="rounded-xl border border-border bg-card p-4"><ShieldCheck className="text-emerald-600" size={18} /><p className="mt-3 text-2xl font-semibold tabular-nums">{data.protected_count}</p><p className="text-xs text-muted-foreground">Platform projects protected</p></div><div className="rounded-xl border border-border bg-card p-4"><Activity className="text-primary" size={18} /><p className="mt-3 text-2xl font-semibold tabular-nums">{data.projects.filter((project) => project.state === 'running').length}</p><p className="text-xs text-muted-foreground">Running projects</p></div></div>
    <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" size={19} /><div><p className="text-sm font-semibold">OpenDomains protection is enforced server-side</p><p className="mt-1 text-xs leading-5 text-muted-foreground">OpenDomains and Rootminster projects are excluded from this page and every action is checked again before Hostinger is called.</p></div></div>
    {loading ? <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" />Loading projects from Hostinger…</div> : error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-semibold">Could not load Docker projects</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={load} className="mt-4">Try again</Button></div> : !data.projects.length ? <div className="rounded-xl border border-dashed border-border p-12 text-center"><Container className="mx-auto text-muted-foreground" /><h2 className="mt-3 font-semibold">No manageable projects</h2><p className="mt-1 text-sm text-muted-foreground">Hostinger returned no projects after platform protection was applied.</p></div> : <div className="space-y-4">{data.projects.map((project) => {
      const open = expanded === project.name;
      return <section key={project.name} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{project.name}</h2><Badge variant="secondary" className={stateTone(project.state)}>{project.state || 'unknown'}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground" title={project.path}>{project.status || project.path || 'Docker Compose project'}</p></div><div className="flex flex-wrap gap-2">{Object.entries(actionDetails).map(([action, detail]) => { const Icon = detail.icon; const active = busy === `${project.name}:${action}`; return <Button key={action} size="sm" variant={action === 'stop' ? 'destructive' : 'outline'} disabled={Boolean(busy)} onClick={() => run(project, action)} className="gap-1.5">{active ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}{detail.label}</Button>; })}<Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => showLogs(project)} className="gap-1.5">{busy === `${project.name}:logs` ? <Loader2 size={14} className="animate-spin" /> : <ScrollText size={14} />}Logs</Button><Button size="sm" variant="ghost" onClick={() => setExpanded(open ? '' : project.name)} className="gap-1.5">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}Containers</Button></div></div>{open && <Containers projectName={project.name} />}</section>;
    })}</div>}
    <Dialog open={Boolean(logs)} onOpenChange={(open) => { if (!open) setLogs(null); }}><DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden"><DialogHeader><DialogTitle className="flex items-center justify-between gap-3">Logs: {logs?.project}<Button variant="ghost" size="icon" onClick={() => setLogs(null)} aria-label="Close logs"><X size={16} /></Button></DialogTitle></DialogHeader><pre className="max-h-[65vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{logs?.groups?.length ? logs.groups.flatMap((group) => [`# ${group.service}`, ...(group.entries || []).map((entry) => `${entry.timestamp || ''} ${entry.line || ''}`), '']).join('\n') : '(no log output)'}</pre></DialogContent></Dialog>
  </div>;
}
