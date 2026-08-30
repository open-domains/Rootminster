import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import UserDetailModal from '@/components/UserDetailModal';
import { Button } from '@/components/ui/button';
import { Shield, Ban, Unlock, Heart, GitBranch, KeyRound, AlertTriangle, Users, UserCheck, Crown, Key } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AdminMigrateModal from '@/components/AdminMigrateModal';

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [donations, setDonations] = useState([]);
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { label, description, action }

  const load = async () => {
    const [usRes, recs, dons] = await Promise.all([
      rootminster.functions.invoke('adminListUsers', {}),
      rootminster.entities.DnsRecord.list(),
      rootminster.entities.Donation.filter({ status: 'succeeded' })
    ]);
    const us = usRes.data?.users || [];
    setUsers(us);
    setDnsRecords(recs);
    setDonations(dons);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateUser = (user_id, data) =>
    rootminster.functions.invoke('adminListUsers', { action: 'update_user', user_id, data });

  const confirm = (label, description, action) => setPendingAction({ label, description, action });

  const promoteAdmin = async (user) => {
    confirm(t('adminUsers.makeAdmin'), t('adminUsers.makeAdminDesc', { email: user.email }), async () => {
      await updateUser(user.id, { role: 'admin' });
      toast.success(t('adminUsers.promotedAdmin'));
      await load();
    });
  };

  const promoteStaff = async (user) => {
    confirm(t('adminUsers.makeStaff'), t('adminUsers.makeStaffDesc', { email: user.email }), async () => {
      await updateUser(user.id, { role: 'staff' });
      toast.success(t('adminUsers.promotedStaff'));
      await load();
    });
  };

  const toggleLegacyDonor = async (user) => {
    const newVal = !user.legacy_donor;
    confirm(
      newVal ? t('adminUsers.grantLegacy') : t('adminUsers.removeLegacy'),
      newVal ? t('adminUsers.legacyDescGrant', { email: user.email }) : t('adminUsers.legacyDescRevoke', { email: user.email }),
      async () => {
        await updateUser(user.id, { legacy_donor: newVal, ns_unlocked: newVal });

        if (newVal) {
          await rootminster.integrations.Core.SendEmail({
        to: user.email,
        subject: '🎉 You\'ve been granted Legacy Donor status on Open Domains',
        body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">💜</div>
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Legacy Donor Status Granted</h1>
          <p style="color:#c4b5fd;margin:8px 0 0;font-size:15px;">Thank you for your past support of Open Domains</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#1e293b;padding:36px 40px;">
          <p style="color:#e2e8f0;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${user.full_name || user.email},</p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 24px;">
            We're pleased to let you know that your account has been recognised as a <strong style="color:#a78bfa;">Legacy Donor</strong> on Open Domains. As a token of our appreciation, you've been granted full <strong style="color:#818cf8;">NS record privileges</strong> on your account.
          </p>
          <!-- Perks box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:24px;">
              <p style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">What's unlocked</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;">
                  <span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span>
                  <span style="color:#e2e8f0;font-size:14px;">NS (Nameserver) record type when requesting subdomains</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span>
                  <span style="color:#e2e8f0;font-size:14px;">Legacy Donor badge on your account</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span>
                  <span style="color:#e2e8f0;font-size:14px;">Our heartfelt thanks for your continued support 💜</span>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 28px;">
            You can start using NS records immediately when submitting new subdomain requests via your dashboard.
          </p>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="https://open.domains/user-dashboard" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">Go to my Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
          <p style="color:#475569;font-size:13px;margin:0;">Open Domains · <a href="https://open.domains" style="color:#6366f1;text-decoration:none;">open.domains</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
          });
        }

        toast.success(newVal ? t('adminUsers.legacyGrantedToast') : t('adminUsers.legacyRemovedToast'));
        load();
      }
    );
  };

  const demoteUser = async (user) => {
    confirm(t('adminUsers.demoteUser'), t('adminUsers.demoteDesc', { email: user.email }), async () => {
      await updateUser(user.id, { role: 'user' });
      toast.success(t('adminUsers.demotedToast'));
      await load();
    });
  };

  const revokeAllTokens = async (user) => {
    confirm(t('adminUsers.revokeKeys'), t('adminUsers.revokeKeysDesc', { email: user.email }), async () => {
      const tokens = await rootminster.entities.ApiToken.filter({ user_id: user.id, revoked: false });
      await Promise.all(tokens.map(tk => rootminster.entities.ApiToken.update(tk.id, { revoked: true, revoked_by: 'admin' })));
      toast.success(t('adminUsers.revokedToast', { count: tokens.length, email: user.email }));
    });
  };

  const getOwnedCount = (email) => dnsRecords.filter(r => r.owner_email === email && r.managed).length;
  const getTotalDonations = (email) => donations.filter(d => d.user_email === email).reduce((s, d) => s + (d.amount_pence || 0), 0);

  const getUserSubdomains = (email) => dnsRecords.filter(r => r.owner_email === email && r.managed);

  const columns = [
    { key: 'display_name', label: t('adminUsers.colName'), render: (v, row) => {
      const name = v || row.full_name;
      return (
        <button onClick={() => setSelectedUser(row)} className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left">
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
            {(name || row.email)?.[0]?.toUpperCase()}
          </div>
          <span className="text-foreground text-sm underline-offset-2 hover:underline">{name || '—'}</span>
        </button>
      );
    }},
    { key: 'email', label: t('adminUsers.colEmail'), render: v => <span className="text-muted-foreground text-sm">{v}</span> },
    { key: 'role', label: t('adminUsers.colRole'), render: v => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
        v === 'admin' ? 'bg-accent/10 text-accent border-accent/25' :
        v === 'staff' ? 'bg-primary/10 text-primary border-primary/25' :
        'bg-muted text-muted-foreground border-border'
      }`}>
        {v === 'admin' ? t('adminUsers.roleAdmin') : v === 'staff' ? t('adminUsers.roleStaff') : t('adminUsers.roleUser')}
      </span>
    )},
    { key: 'email', label: t('adminUsers.colSubdomains'), render: v => <span className="text-primary text-sm font-medium">{getOwnedCount(v)}</span> },
    { key: 'email', label: t('adminUsers.colDonations'), render: (v, row) => {
      const total = getTotalDonations(v);
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 text-sm">£{(total / 100).toFixed(2)}</span>
          {row.ns_unlocked && <Unlock size={11} className="text-primary" aria-label="NS Unlocked" />}
          {row.legacy_donor && <Heart size={11} className="text-pink-400" aria-label="Legacy Donor" />}
        </div>
      );
    }},
    { key: 'created_date', label: t('adminUsers.colJoined'), render: v => <span className="text-muted-foreground text-xs">{v ? format(new Date(v), 'MMM d, yyyy') : '—'}</span> },
    { key: 'id', label: t('adminUsers.colActions'), render: (_, row) => (
      <div className="flex items-center gap-1.5 flex-wrap">
        {row.role === 'user' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => promoteStaff(row)}
              className="text-primary hover:bg-primary/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Shield size={12} /> {t('adminUsers.staff')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => promoteAdmin(row)}
              className="text-accent hover:bg-accent/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Shield size={12} /> {t('adminUsers.admin')}
            </Button>
          </>
        )}
        {row.role === 'staff' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => promoteAdmin(row)}
              className="text-accent hover:bg-accent/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Shield size={12} /> {t('adminUsers.admin')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => demoteUser(row)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Ban size={12} /> {t('adminUsers.demote')}
            </Button>
          </>
        )}
        {row.role === 'admin' && (
          <Button size="sm" variant="ghost" onClick={() => demoteUser(row)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
            <Ban size={12} /> {t('adminUsers.demote')}
          </Button>
        )}
        <span className="h-4 w-px bg-border shrink-0" />
        <Button size="sm" variant="ghost" onClick={() => toggleLegacyDonor(row)}
          className={`h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap ${row.legacy_donor ? 'text-pink-400 hover:bg-pink-500/10' : 'text-muted-foreground hover:bg-pink-500/10 hover:text-pink-300'}`}>
          <Heart size={12} /> {row.legacy_donor ? t('adminUsers.legacyCheck') : t('adminUsers.legacy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => revokeAllTokens(row)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
          <KeyRound size={12} /> {t('adminUsers.revokeKeysBtn')}
        </Button>
      </div>
    )},
  ];

  const admins = users.filter(u => u.role === 'admin').length;
  const staff = users.filter(u => u.role === 'staff').length;
  const unlocked = users.filter(u => u.ns_unlocked).length;

  return (
    <div className="space-y-6">
      <AlertDialog open={!!pendingAction} onOpenChange={open => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-accent" /> {pendingAction?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { pendingAction?.action(); setPendingAction(null); }}>{t('adminUsers.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('adminUsers.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('adminUsers.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('adminUsers.subtitle')}</p>
        </div>
        <Button onClick={() => setMigrateModalOpen(true)} className="h-9 gap-2 px-4">
          <GitBranch size={13} /> {t('adminUsers.migrateBtn')}
        </Button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-4">
        {[
          { label: t('adminUsers.labelUsers'), value: users.length, icon: Users },
          { label: t('adminUsers.labelStaff'), value: staff, icon: UserCheck },
          { label: t('adminUsers.labelAdmins'), value: admins, icon: Crown },
          { label: t('adminUsers.labelNsUnlocked'), value: unlocked, icon: Key },
        ].map((item, index) => (
          <div key={item.label} className={`${index > 0 ? 'border-l border-border' : ''} px-4 py-3.5`}>
            <div className="flex items-center gap-2 text-muted-foreground"><item.icon size={13} /><span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span></div>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={users} searchKeys={['email', 'display_name', 'full_name']} emptyMessage={t('adminUsers.empty')} />
      )}
      <AdminMigrateModal open={migrateModalOpen} onClose={() => setMigrateModalOpen(false)} onSuccess={load} />
      <UserDetailModal
        user={selectedUser}
        subdomains={selectedUser ? getUserSubdomains(selectedUser.email) : []}
        onClose={() => setSelectedUser(null)}
        onUpdated={load}
      />
    </div>
  );
}