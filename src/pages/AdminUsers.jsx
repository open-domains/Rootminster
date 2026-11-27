import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import UserDetailModal from '@/components/UserDetailModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Shield, Ban, Unlock, Heart, GitBranch, KeyRound, AlertTriangle, Users, UserCheck, Crown, Key, Trash2, Loader2, Globe2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import AdminMigrateModal from '@/components/AdminMigrateModal';
import { legacyDonorEmail } from '../../shared/email-templates.js';

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [subdomainOwnerships, setSubdomainOwnerships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserSubdomains, setSelectedUserSubdomains] = useState([]);
  const [subdomainsLoading, setSubdomainsLoading] = useState(false);
  const [donations, setDonations] = useState([]);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { label, description, action }

  const load = async () => {
    const [usRes, ownerships, publicConfig, currentUser] = await Promise.all([
      rootminster.functions.invoke('adminListUsers', {}),
      rootminster.entities.SubdomainOwnership.list(null, 10000),
      rootminster.config.getPublic(),
      rootminster.auth.me(),
    ]);
    const enabled = !!publicConfig.features?.donations;
    const dons = enabled
      ? await rootminster.entities.Donation.filter({ status: 'succeeded' })
      : [];
    const us = usRes.data?.users || [];
    setUsers(us);
    setSubdomainOwnerships(ownerships);
    setDonations(dons);
    setDonationsEnabled(enabled);
    setCurrentUserId(currentUser.id);
    setSelectedIds(previous => new Set([...previous].filter(id => us.some(user => user.id === id) && id !== currentUser.id)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserSubdomains([]);
      return;
    }
    setSubdomainsLoading(true);
    rootminster.entities.DnsRecord.filter({ owner_email: selectedUser.email, managed: true }, null, 10000)
      .then(recs => setSelectedUserSubdomains(recs || []))
      .catch(() => setSelectedUserSubdomains([]))
      .finally(() => setSubdomainsLoading(false));
  }, [selectedUser?.email]);

  const updateUser = (user_id, data) =>
    rootminster.functions.invoke('adminListUsers', { action: 'update_user', user_id, data });

  const confirm = (label, description, action, destructive = false) => {
    setConfirmationText('');
    setPendingAction({ label, description, action, destructive });
  };

  const toggleSelected = (userId) => {
    if (userId === currentUserId) return;
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const deleteSelectedUsers = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const selectedEmails = users.filter(user => selectedIds.has(user.id)).map(user => user.email);
    const accountList = selectedEmails.length <= 5
      ? selectedEmails.join('\n')
      : `${selectedEmails.slice(0, 5).join('\n')}\n+ ${selectedEmails.length - 5} more`;
    confirm(
      t('adminUsers.deleteAccountsTitle', { count: ids.length }),
      `${t('adminUsers.deleteAccountsDesc', { count: ids.length })}\n\n${accountList}`,
      async () => {
        setDeleting(true);
        try {
          const response = await rootminster.functions.invoke('adminListUsers', { action: 'delete_users', user_ids: ids });
          setSelectedIds(new Set());
          if (selectedUser && ids.includes(selectedUser.id)) setSelectedUser(null);
          toast.success(t('adminUsers.deletedAccountsToast', { count: response.data?.users || ids.length }));
          await load();
        } catch (error) {
          toast.error(error?.response?.data?.error || error?.message || t('adminUsers.deleteAccountsFailed'));
        } finally {
          setDeleting(false);
        }
      },
      true,
    );
  };

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

  const makeDomainProvider = async (user) => {
    confirm(
      t('adminUsers.makeDomainProvider', 'Make Domain Provider'),
      t('adminUsers.makeDomainProviderDesc', { email: user.email, defaultValue: `Grant {{email}} the Domain Provider role? An admin can then assign one or more donated domains to this user.` }),
      async () => {
        await updateUser(user.id, { role: 'domain_provider' });
        toast.success(t('adminUsers.domainProviderGranted', 'Domain Provider role granted'));
        await load();
      },
    );
  };

  const toggleLegacyDonor = async (user) => {
    const newVal = !user.legacy_donor;
    confirm(
      newVal ? t('adminUsers.grantLegacy') : t('adminUsers.removeLegacy'),
      newVal ? t('adminUsers.legacyDescGrant', { email: user.email }) : t('adminUsers.legacyDescRevoke', { email: user.email }),
      async () => {
        await updateUser(user.id, { legacy_donor: newVal, ns_unlocked: newVal });

        if (newVal) {
          const { subject, body } = legacyDonorEmail({ appUrl: window.location.origin });
          await rootminster.integrations.Core.SendEmail({ to: user.email, subject, body });
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

  const getOwnedCount = (email) => subdomainOwnerships.filter(o => o.owner_email === email && o.status === 'active').length;
  const getTotalDonations = (email) => donations.filter(d => d.user_email === email).reduce((s, d) => s + (d.amount_pence || 0), 0);

  const columns = [
    { key: '_selected', label: t('adminUsers.selectColumn'), render: (_, row) => (
      <Checkbox
        checked={selectedIds.has(row.id)}
        disabled={row.id === currentUserId}
        onCheckedChange={() => toggleSelected(row.id)}
        aria-label={row.id === currentUserId ? t('adminUsers.cannotSelectOwnAccount') : t('adminUsers.selectAccount', { email: row.email })}
      />
    ) },
    { key: 'full_name', label: t('adminUsers.colName'), render: (v, row) => {
      const name = v;
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
        v === 'domain_provider' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
        'bg-muted text-muted-foreground border-border'
      }`}>
        {v === 'admin' ? t('adminUsers.roleAdmin') :
         v === 'staff' ? t('adminUsers.roleStaff') :
         v === 'domain_provider' ? t('adminUsers.roleDomainProvider', 'Domain Provider') :
         t('adminUsers.roleUser')}
      </span>
    )},
    { key: 'email', label: t('adminUsers.colSubdomains'), render: v => <span className="text-primary text-sm font-medium">{getOwnedCount(v)}</span> },
    ...(donationsEnabled ? [{ key: 'email', label: t('adminUsers.colDonations'), render: (v, row) => {
      const total = getTotalDonations(v);
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 text-sm">£{(total / 100).toFixed(2)}</span>
          {row.ns_unlocked && <Unlock size={11} className="text-primary" aria-label="NS Unlocked" />}
          {row.legacy_donor && <Heart size={11} className="text-pink-400" aria-label="Legacy Donor" />}
        </div>
      );
    }}] : []),
    { key: 'created_date', label: t('adminUsers.colJoined'), render: v => <span className="text-muted-foreground text-xs">{v ? format(new Date(v), 'MMM d, yyyy') : '—'}</span> },
    { key: 'id', label: t('adminUsers.colActions'), render: (_, row) => (
      <div className="flex items-center gap-1.5 flex-wrap">
        {row.role === 'user' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => makeDomainProvider(row)}
              className="text-emerald-400 hover:bg-emerald-500/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Globe2 size={12} /> {t('adminUsers.domainProvider', 'Domain Provider')}
            </Button>
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
        {row.role === 'domain_provider' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => promoteStaff(row)}
              className="text-primary hover:bg-primary/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
              <Shield size={12} /> {t('adminUsers.staff')}
            </Button>
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
        {donationsEnabled && (
          <Button size="sm" variant="ghost" onClick={() => toggleLegacyDonor(row)}
            className={`h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap ${row.legacy_donor ? 'text-pink-400 hover:bg-pink-500/10' : 'text-muted-foreground hover:bg-pink-500/10 hover:text-pink-300'}`}>
            <Heart size={12} /> {row.legacy_donor ? t('adminUsers.legacyCheck') : t('adminUsers.legacy')}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => revokeAllTokens(row)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2.5 text-xs gap-1.5 whitespace-nowrap">
          <KeyRound size={12} /> {t('adminUsers.revokeKeysBtn')}
        </Button>
      </div>
    )},
  ];

  const admins = users.filter(u => u.role === 'admin').length;
  const staff = users.filter(u => u.role === 'staff').length;
  const providers = users.filter(u => u.role === 'domain_provider').length;
  const unlocked = users.filter(u => u.ns_unlocked).length;

  return (
    <div className="space-y-6">
      <AlertDialog open={!!pendingAction} onOpenChange={open => {
        if (!open) {
          setPendingAction(null);
          setConfirmationText('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-accent" /> {pendingAction?.label}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{pendingAction?.description}</AlertDialogDescription>
            {pendingAction?.destructive && (
              <div className="space-y-2 pt-2">
                <label htmlFor="delete-accounts-confirmation" className="text-sm font-medium text-foreground">
                  {t('adminUsers.typeDeleteToConfirm')}
                </label>
                <Input
                  id="delete-accounts-confirmation"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  autoComplete="off"
                  placeholder="DELETE"
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              disabled={pendingAction?.destructive && confirmationText !== 'DELETE'}
              onClick={() => { pendingAction?.action(); setPendingAction(null); setConfirmationText(''); }}
            >{pendingAction?.destructive ? t('adminUsers.deletePermanently') : t('adminUsers.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('adminUsers.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('adminUsers.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('adminUsers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={deleteSelectedUsers} disabled={deleting} className="h-9 gap-2 px-4">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {t('adminUsers.deleteSelected', { count: selectedIds.size })}
            </Button>
          )}
          <Button onClick={() => setMigrateModalOpen(true)} className="h-9 gap-2 px-4">
            <GitBranch size={13} /> {t('adminUsers.migrateBtn')}
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card ${donationsEnabled ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {[
          { label: t('adminUsers.labelUsers'), value: users.length, icon: Users },
          { label: t('adminUsers.labelStaff'), value: staff, icon: UserCheck },
          { label: t('adminUsers.labelAdmins'), value: admins, icon: Crown },
          { label: t('adminUsers.labelDomainProviders', 'Domain Providers'), value: providers, icon: Globe2 },
          ...(donationsEnabled ? [{ label: t('adminUsers.labelNsUnlocked'), value: unlocked, icon: Key }] : []),
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
        <DataTable columns={columns} data={users} searchKeys={['email', 'full_name']} emptyMessage={t('adminUsers.empty')} />
      )}
      <AdminMigrateModal open={migrateModalOpen} onClose={() => setMigrateModalOpen(false)} onSuccess={load} />
      <UserDetailModal
        user={selectedUser}
        subdomains={selectedUserSubdomains}
        subdomainsLoading={subdomainsLoading}
        onClose={() => setSelectedUser(null)}
        onUpdated={load}
      />
    </div>
  );
}
