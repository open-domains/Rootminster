import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';

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
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.admin_email_logs.messaging_caef62")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.admin_email_logs.email_logs_a8c386")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.admin_email_logs.inspect_transactional_email_delivery_and_f_bc5c59")}</p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
        <div className="px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.admin_email_logs.total_b25928")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{logs.length}</p></div>
        <div className="border-l border-border px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.admin_email_logs.sent_35f49d")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{sent}</p></div>
        <div className="border-l border-border px-4 py-3.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("operational.admin_email_logs.failed_09fef5")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{failed}</p></div>
      </div>
      {loading ?
      <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div> :

      <DataTable columns={columns} data={logs} searchKeys={['to', 'subject', 'template_type']} emptyMessage="No email logs yet." />
      }
    </div>);

}
