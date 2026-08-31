import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { usePublicConfig } from '@/lib/public-config';

export default function AdminDonations() {const { t } = useTranslation();
  const { config, loading: configLoading } = usePublicConfig();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config.features.donations) {
      rootminster.entities.Donation.list('-created_date', 500).then(setDonations).finally(() => setLoading(false));
    }
  }, [config.features.donations]);

  if (configLoading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!config.features.donations) return <Navigate to="/admin-dashboard" replace />;

  const succeeded = donations.filter((d) => d.status === 'succeeded');
  const totalGbp = (succeeded.reduce((sum, d) => sum + (d.amount_pence || 0), 0) / 100).toFixed(2);
  const nsUnlocks = donations.filter((d) => d.ns_unlock_granted).length;

  const columns = [
  { key: 'created_date', label: t("operational.admin_donations.date_eb9a4b"), render: (v) => <span className="text-slate-500 text-xs">{v ? format(new Date(v), 'MMM d, yyyy HH:mm') : '—'}</span> },
  { key: 'user_email', label: t("operational.admin_donations.user_9f8a23"), render: (v) => <span className="text-slate-300 text-sm">{v}</span> },
  { key: 'amount_pence', label: t("operational.admin_donations.amount_43dc85"), render: (v) => <span className="text-emerald-400 font-medium">£{((v || 0) / 100).toFixed(2)}</span> },
  { key: 'status', label: t("operational.admin_donations.status_bae7d5"), render: (v) => <StatusBadge status={v} /> },
  { key: 'ns_unlock_granted', label: t("operational.admin_donations.ns_unlocked_ca7b09"), render: (v) => v ?
    <span className="text-indigo-400 text-xs font-medium">{t("operational.admin_donations.yes_df551d")}</span> :
    <span className="text-slate-600 text-xs">—</span>
  },
  { key: 'stripe_payment_intent_id', label: t("operational.admin_donations.payment_intent_983a66"), render: (v) => v ?
    <span className="font-mono text-xs text-slate-500 truncate max-w-[140px] block">{v}</span> :
    <span className="text-slate-600 text-xs">—</span>
  }];


  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.admin_donations.funding_6ff171")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.admin_donations.donations_a2e2ff")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.admin_donations.track_supporter_payments_unlocks_and_strip_0c801d")}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
        {[
        { label: t("operational.admin_donations.total_revenue_f3a837"), value: `£${totalGbp}`, color: 'text-emerald-400' },
        { label: t("operational.admin_donations.successful_d7932a"), value: succeeded.length, color: 'text-emerald-400' },
        { label: t("operational.admin_donations.pending_96f608"), value: donations.filter((d) => d.status === 'pending').length, color: 'text-amber-400' },
        { label: t("operational.admin_donations.ns_unlocks_granted_878fb1"), value: nsUnlocks, color: 'text-indigo-400' }].
        map((s) =>
        <div key={s.label} className="border-l border-border px-4 py-3.5 first:border-l-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        )}
      </div>

      {loading ?
      <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div> :

      <DataTable columns={columns} data={donations} searchKeys={['user_email', 'stripe_payment_intent_id']} emptyMessage="No donations yet." />
      }
    </div>);

}
