import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { rootminster } from '@/api/rootminsterClient';
import { AdminHeader, AdminLoading, AdminPage, AdminStatsGrid } from '@/components/AdminPageShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { usePublicConfig } from '@/lib/public-config';
import { Heart, KeyRound, PoundSterling, Timer } from 'lucide-react';

export default function AdminDonations() {const { t } = useTranslation();
  const { config, loading: configLoading } = usePublicConfig();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config.features.donations) {
      rootminster.entities.Donation.list('-created_date', 500).then(setDonations).finally(() => setLoading(false));
    }
  }, [config.features.donations]);

  if (configLoading) return <AdminLoading label="Loading donation settings…" />;
  if (!config.features.donations) return <Navigate to="/admin-dashboard" replace />;

  const succeeded = donations.filter((d) => d.status === 'succeeded');
  const totalGbp = (succeeded.reduce((sum, d) => sum + (d.amount_pence || 0), 0) / 100).toFixed(2);
  const nsUnlocks = donations.filter((d) => d.ns_unlock_granted).length;

  const columns = [
  { key: 'created_date', label: t("operational.admin_donations.date_eb9a4b"), render: (v) => <span className="text-muted-foreground text-xs">{v ? format(new Date(v), 'MMM d, yyyy HH:mm') : '—'}</span> },
  { key: 'user_email', label: t("operational.admin_donations.user_9f8a23"), render: (v) => <span className="text-foreground text-sm">{v}</span> },
  { key: 'amount_pence', label: t("operational.admin_donations.amount_43dc85"), render: (v) => <span className="text-emerald-500 font-medium">£{((v || 0) / 100).toFixed(2)}</span> },
  { key: 'status', label: t("operational.admin_donations.status_bae7d5"), render: (v) => <StatusBadge status={v} /> },
  { key: 'ns_unlock_granted', label: t("operational.admin_donations.ns_unlocked_ca7b09"), render: (v) => v ?
    <span className="text-primary text-xs font-medium">{t("operational.admin_donations.yes_df551d")}</span> :
    <span className="text-muted-foreground text-xs">—</span>
  },
  { key: 'stripe_payment_intent_id', label: t("operational.admin_donations.payment_intent_983a66"), render: (v) => v ?
    <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px] block">{v}</span> :
    <span className="text-muted-foreground text-xs">—</span>
  }];

  const stats = [
    { label: t("operational.admin_donations.total_revenue_f3a837"), value: `£${totalGbp}`, icon: PoundSterling, className: 'text-emerald-500' },
    { label: t("operational.admin_donations.successful_d7932a"), value: succeeded.length, icon: Heart, className: 'text-emerald-500' },
    { label: t("operational.admin_donations.pending_96f608"), value: donations.filter((d) => d.status === 'pending').length, icon: Timer, className: 'text-amber-500' },
    { label: t("operational.admin_donations.ns_unlocks_granted_878fb1"), value: nsUnlocks, icon: KeyRound, className: 'text-primary' },
  ];

  return (
    <AdminPage>
      <AdminHeader
        eyebrow={t("operational.admin_donations.funding_6ff171")}
        title={t("operational.admin_donations.donations_a2e2ff")}
        description={t("operational.admin_donations.track_supporter_payments_unlocks_and_strip_0c801d")}
        meta="Stripe + supporter benefits"
      />

      <AdminStatsGrid stats={stats} />

      {loading ?
      <AdminLoading label="Loading donation history…" /> :
      <DataTable columns={columns} data={donations} searchKeys={['user_email', 'stripe_payment_intent_id']} emptyMessage="No donations yet." searchPlaceholder="Search supporter or payment intent…" />
      }
    </AdminPage>);

}
