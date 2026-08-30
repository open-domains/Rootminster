import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';
import { Play, Square, RotateCcw, RefreshCw, ScrollText, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DockerEngine() {const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [logs, setLogs] = useState(null);
  const [logsProject, setLogsProject] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', virtual_machine_id: '', description: '' });
  const [user, setUser] = useState(null);

  useEffect(() => {
    rootminster.auth.me().then(setUser);
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await rootminster.entities.DockerProject.list();
    setProjects(data);
    setLoading(false);
  };

  const runAction = async (project, action) => {
    const key = `${project.id}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await rootminster.functions.invoke('dockerEngine', {
        action,
        virtualMachineId: project.virtual_machine_id,
        projectName: project.name
      });
      if (action === 'logs') {
        setLogsProject(project.name);
        setLogs(typeof res.data.data === 'string' ? res.data.data : JSON.stringify(res.data.data, null, 2));
      } else {
        toast.success(`${action} sent to ${project.name}`);
      }
    } catch (e) {
      toast.error(`Failed: ${e.message}`);
    }
    setActionLoading((prev) => ({ ...prev, [key]: false }));
  };

  const addProject = async () => {
    if (!newProject.name || !newProject.virtual_machine_id) {
      toast.error(t("operational.docker_engine.name_and_vm_id_are_required_d64794"));
      return;
    }
    await rootminster.entities.DockerProject.create(newProject);
    setNewProject({ name: '', virtual_machine_id: '', description: '' });
    setShowAddForm(false);
    toast.success(t("operational.docker_engine.project_added_f170d5"));
    loadProjects();
  };

  const deleteProject = async (id) => {
    await rootminster.entities.DockerProject.delete(id);
    toast.success(t("operational.docker_engine.project_removed_c8b9f6"));
    loadProjects();
  };

  const isLoading = (project, action) => actionLoading[`${project.id}-${action}`];
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.docker_engine.infrastructure_951d9a")}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.docker_engine.docker_engine_2ddecb")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.docker_engine.operate_configured_docker_projects_and_ins_90ee0f")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadProjects} className="h-9 gap-2"><RefreshCw size={13} /> {t("operational.docker_engine.refresh_56e3ba")}</Button>
          {isAdmin &&
          <Button size="sm" onClick={() => setShowAddForm(true)} className="h-9 gap-2 px-4">
              <Plus size={14} /> {t("operational.docker_engine.add_project_2470e8")} 
          </Button>
          }
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
        <div className="px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.docker_engine.projects_53e890")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{projects.length}</p></div>
        <div className="border-l border-border px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.docker_engine.access_2f81a2")}</p><p className="mt-1 text-sm font-medium text-foreground">{isAdmin ? 'Administrator' : 'Staff'}</p></div>
        <div className="border-l border-border px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.docker_engine.provider_7ceee3")}</p><p className="mt-1 text-sm font-medium text-foreground">{t("operational.docker_engine.hostinger_vps_f17ede")}</p></div>
      </div>

      {showAddForm &&
      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <p className="text-foreground font-semibold text-sm">{t("operational.docker_engine.new_docker_project_30fd37")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder={t("operational.docker_engine.project_name_e_g_my_app_d51388")} value={newProject.name} onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder={t("operational.docker_engine.virtual_machine_id_b11e61")} value={newProject.virtual_machine_id} onChange={(e) => setNewProject((p) => ({ ...p, virtual_machine_id: e.target.value }))} />
            <Input placeholder={t("operational.docker_engine.description_optional_388de6")} value={newProject.description} onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addProject}>{t("operational.docker_engine.save_efc007")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>{t("operational.docker_engine.cancel_77dfd2")}</Button>
          </div>
        </div>
      }

      {loading ?
      <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div> :
      projects.length === 0 ?
      <div className="text-center py-16 text-muted-foreground">
          <p>{t("operational.docker_engine.no_docker_projects_configured_yet_a3af01")}</p>
          {isAdmin && <p className="text-sm mt-1">{t("operational.docker_engine.click_add_project_to_get_started_c554fa")}</p>}
        </div> :

      <div className="grid gap-4">
          {projects.map((project) =>
        <div key={project.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-foreground font-semibold">{project.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{t("operational.docker_engine.vm_143ebd")} {project.virtual_machine_id}</p>
                  {project.description && <p className="text-muted-foreground text-xs mt-1">{project.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && <>
                  <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10"
              disabled={isLoading(project, 'start')} onClick={() => runAction(project, 'start')}>
                    <Play size={14} /> {isLoading(project, 'start') ? '…' : 'Start'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
              disabled={isLoading(project, 'stop')} onClick={() => runAction(project, 'stop')}>
                    <Square size={14} /> {isLoading(project, 'stop') ? '…' : 'Stop'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-accent hover:bg-accent/10"
              disabled={isLoading(project, 'restart')} onClick={() => runAction(project, 'restart')}>
                    <RotateCcw size={14} /> {isLoading(project, 'restart') ? '…' : 'Restart'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10"
              disabled={isLoading(project, 'update')} onClick={() => runAction(project, 'update')}>
                    <RefreshCw size={14} /> {isLoading(project, 'update') ? '…' : 'Update'}
                  </Button>
                  </>}
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted"
              disabled={isLoading(project, 'logs')} onClick={() => runAction(project, 'logs')}>
                    <ScrollText size={14} /> {isLoading(project, 'logs') ? '…' : 'Logs'}
                  </Button>
                  {isAdmin &&
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
              onClick={() => deleteProject(project.id)} aria-label={t("operational.docker_engine.remove_project_333b0c")}>
                      <Trash2 size={14} />
                    </Button>
              }
                </div>
              </div>
            </div>
        )}
        </div>
      }

      {logs !== null &&
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-raised">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-foreground font-semibold text-sm">{t("operational.docker_engine.logs_11053e")} {logsProject}</p>
              <button onClick={() => setLogs(null)} aria-label={t("operational.docker_engine.close_logs_26ede5")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-xs text-foreground font-mono whitespace-pre-wrap review-modal-scroll">
              {logs || '(no output)'}
            </pre>
          </div>
        </div>
      }
    </div>);

}
