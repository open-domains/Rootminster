import { useTranslation } from "react-i18next";import { useState, useEffect, useMemo } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function AdminAuditLogs() {const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    Promise.all([
    rootminster.entities.AuditLog.list('-created_date', 500),
    rootminster.entities.User.list()]
    ).then(([l, users]) => {
      setLogs(l);
      const map = {};
      users.forEach((u) => {if (u.email) map[u.email] = u.display_name || u.full_name || u.email;});
      setUserNames(map);
    }).finally(() => setLoading(false));
  }, []);

  const actionColors = {
    request_approved: 'text-emerald-400',
    request_rejected: 'text-red-400',
    request_submitted: 'text-blue-400',
    sync_completed: 'text-indigo-400',
    edit_request_approved: 'text-emerald-400',
    ownership_transferred: 'text-purple-400'
  };

  const columns = [
  { key: 'created_date', label: t("operational.admin_audit_logs.time_6c82e6"), render: (v) => <span className="text-slate-500 text-xs font-mono">{v ? format(new Date(v), 'MMM d, HH:mm:ss') : '—'}</span> },
  { key: 'actor_email', label: t("operational.admin_audit_logs.actor_cbd19b"), render: (v) => <span className="text-slate-300 text-sm" title={v}>{v && (userNames[v] || v) || '—'}</span> },
  { key: 'actor_role', label: t("operational.admin_audit_logs.role_c3f104"), render: (v) => <span className="text-slate-500 text-xs capitalize">{v || '—'}</span> },
  { key: 'action', label: t("operational.admin_audit_logs.action_97c89a"), render: (v) => <span className={`text-xs font-mono font-medium ${actionColors[v] || 'text-slate-400'}`}>{v}</span> },
  { key: 'entity_type', label: t("operational.admin_audit_logs.entity_c7fb31"), render: (v) => <span className="text-slate-400 text-xs">{v || '—'}</span> },
  { key: 'description', label: t("operational.admin_audit_logs.description_55f8eb"), render: (v) => <span className="text-slate-300 text-sm">{v}</span> }];


  const actions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))].sort(), [logs]);
  const entities = useMemo(() => [...new Set(logs.map((l) => l.entity_type).filter(Boolean))].sort(), [logs]);
  const roles = useMemo(() => [...new Set(logs.map((l) => l.actor_role).filter(Boolean))].sort(), [logs]);

  const filtered = useMemo(() => logs.filter((l) =>
  (filterAction === 'all' || l.action === filterAction) && (
  filterEntity === 'all' || l.entity_type === filterEntity) && (
  filterRole === 'all' || l.actor_role === filterRole)
  ), [logs, filterAction, filterEntity, filterRole]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.admin_audit_logs.security_compliance_081f97")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.admin_audit_logs.audit_logs_676e58")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.admin_audit_logs.trace_administrative_actions_system_events_9de7b0")}</p>
      </div>
      {loading ?
      <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div> :

      <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row">
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-52"><SelectValue placeholder={t("operational.admin_audit_logs.all_actions_902f19")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("operational.admin_audit_logs.all_actions_902f19")}</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-52"><SelectValue placeholder={t("operational.admin_audit_logs.all_entities_235465")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("operational.admin_audit_logs.all_entities_235465")}</SelectItem>
                {entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-40"><SelectValue placeholder={t("operational.admin_audit_logs.all_roles_c9c81e")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("operational.admin_audit_logs.all_roles_c9c81e")}</SelectItem>
                {roles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DataTable columns={columns} data={filtered} searchKeys={['actor_email', 'action', 'description']} emptyMessage="No audit logs match your filters." />
        </div>
      }
    </div>);

}
