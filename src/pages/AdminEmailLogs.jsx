import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { AdminHeader, AdminLoading, AdminPage, AdminStatsGrid } from '@/components/AdminPageShell';
import { Mail, Send, TriangleAlert } from 'lucide-react';

export default function AdminEmailLogs() {const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rootminster.entities.EmailLog.list('-created_date', 200).then(setLogs).finally(() => setLoading(false));
  }, []);

  const columns = [
  { key: 'created_date', label: t("operational.admin_email_logs.sent_35f49d"), render: (v) => <span className="text-slate-500 text-xs">{v ? format(new Date(v), 'MMM d, HH:mm') : '—'}</span> },
  { key: 'to', label: t("operational.admin_email_logs.to_ae79ea"), render: (v) => <span className="text-slate-300 text-sm">{v}</span> },
  { key: 'subject', label: t("operational.admin_email_logs.subject_8d183d"), render: (v) => <span className="text-slate-300 text-sm truncate max-w-[200px] block">{v}</span> },
  { key: 'template_type', label: t("operational.admin_email_logs.template_3ec1ae"), render: (v) => <span className="font-mono text-xs text-indigo-400">{v}</span> },
  { key: 'status', label: t("operational.admin_email_logs.status_bae7d5"), render: (v) => <StatusBadge status={v} /> },
  { key: 'related_entity_type', label: t("operational.admin_email_logs.related_917df9"), render: (v) => <span className="text-slate-500 text-xs">{v || '—'}</span> },
  { key: 'error_message', label: t("operational.admin_email_logs.error_7f2f6a"), render: (v) => v ? <span className="text-red-400 text-xs truncate max-w-[120px] block">{v}</span> : <span className="text-slate-600">—</span> }];


  const sent = logs.filter((l) => l.status === 'sent').length;
  const failed = logs.filter((l) => l.status === 'failed').length;

  return (
    <AdminPage>
      <AdminHeader
        eyebrow={t("operational.admin_email_logs.messaging_caef62")}
        title={t("operational.admin_email_logs.email_logs_a8c386")}
        description={t("operational.admin_email_logs.inspect_transactional_email_delivery_and_f_bc5c59")}
        meta="Transactional mail"
      />

      <AdminStatsGrid columns={3} stats={[
        { label: t("operational.admin_email_logs.total_b25928"), value: logs.length, icon: Mail },
        { label: t("operational.admin_email_logs.sent_35f49d"), value: sent, icon: Send, className: 'text-emerald-500' },
        { label: t("operational.admin_email_logs.failed_09fef5"), value: failed, icon: TriangleAlert, className: failed ? 'text-destructive' : undefined },
      ]} />
      {loading ?
      <AdminLoading label="Loading email logs…" /> :

      <DataTable columns={columns} data={logs} searchKeys={['to', 'subject', 'template_type']} emptyMessage="No email logs yet." searchPlaceholder="Search recipient, subject or template…" />
      }
    </AdminPage>);

}
