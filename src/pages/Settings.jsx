import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Shield, BellOff, KeyRound, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import CarbonAd from '@/components/CarbonAd';
import DonationWidget from '@/components/DonationWidget';
import ApiTokenManager from '@/components/ApiTokenManager';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import TrustedBrowsers from '@/components/TrustedBrowsers';

export default function Settings() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingEmail, setTogglingEmail] = useState(false);
  const [active, setActive] = useState('profile');

  const sections = [
    { id: 'profile', label: t('settings.navProfile'), icon: User },
    { id: 'security', label: t('settings.navSecurity'), icon: Shield },
    { id: 'api', label: t('settings.navApi'), icon: KeyRound },
    { id: 'support', label: t('settings.navSupport'), icon: HeartHandshake },
  ];

  const refreshUser = () => rootminster.auth.me().then(u => { setUser(u); setFullName(u?.display_name || u?.full_name || ''); });

  useEffect(() => { refreshUser(); }, []);

  const toggleEmailNotifications = async (disabled) => {
    setTogglingEmail(true);
    try {
      await rootminster.auth.updateMe({ disable_email_notifications: disabled });
      setUser(u => ({ ...u, disable_email_notifications: disabled }));
      toast.success(disabled ? t('settings.emailDisabled') : t('settings.emailEnabled'));
    } catch { toast.error(t('settings.prefFailed')); }
    finally { setTogglingEmail(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await rootminster.auth.updateMe({ display_name: fullName });
      const updated = await rootminster.auth.me();
      setUser(updated);
      setFullName(updated?.display_name || updated?.full_name || '');
      toast.success(t('settings.profileUpdated'));
    } catch { toast.error(t('settings.saveFailed')); }
    finally { setSaving(false); }
  };

  const initials = (user?.display_name || user?.full_name)?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const roleKey = user?.role ? `settings.role${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : null;
  const roleLabel = roleKey ? t(roleKey) : t('common.user');

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('settings.eyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('settings.title')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex gap-1 overflow-x-auto pb-1 xl:block xl:space-y-1 xl:overflow-visible xl:pb-0">
          {sections.map(item => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors xl:w-full ${selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </aside>

        <div className="min-w-0 space-y-6">
          {active === 'profile' && (
            <>
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-sm font-semibold text-foreground">{t('settings.profileTitle')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.profileSubtitle')}</p>
                </div>
                <div className="space-y-5 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{initials}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{user?.display_name || user?.full_name || t('common.user')}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"><Shield size={10} /> {roleLabel}</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.displayName')}</Label>
                      <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('settings.email')}</Label>
                      <Input value={user?.email || ''} disabled className="h-9 cursor-not-allowed opacity-60" />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border pt-4">
                    <Button onClick={save} disabled={saving} className="h-9">{saving ? t('common.saving') : t('settings.saveChanges')}</Button>
                  </div>
                </div>
              </section>

              {(user?.role === 'admin' || user?.role === 'staff') && (
                <section className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-5 py-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><BellOff size={14} /> {t('settings.notificationsTitle')}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.notificationsSubtitle')}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('settings.disableEmail')}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.disableEmailSub')}</p>
                    </div>
                    <Switch checked={!!user?.disable_email_notifications} onCheckedChange={toggleEmailNotifications} disabled={togglingEmail} />
                  </div>
                </section>
              )}
            </>
          )}

          {active === 'security' && user && (
            <>
              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('settings.sec2fa')}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className={`h-2 w-2 rounded-full ${user?.totp_enabled ? 'bg-emerald-400' : 'bg-accent'}`} />
                    {user?.totp_enabled ? t('settings.sec2faEnabled') : t('settings.sec2faNotEnabled')}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('settings.secRole')}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{roleLabel}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('settings.secState')}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground"><CheckCircle2 size={14} className="text-emerald-400" /> {t('settings.secStateActive')}</p>
                </div>
              </section>

              <TwoFactorSetup user={user} onUpdated={refreshUser} />
              <TrustedBrowsers user={user} />
            </>
          )}

          {active === 'api' && user && (
            <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
              <ApiTokenManager user={user} />
            </section>
          )}

          {active === 'support' && user && (
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">{t('settings.supportTitle')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('settings.supportSubtitle')}</p>
              </div>
              <div className="p-5">
                <DonationWidget user={user} />
              </div>
            </section>
          )}

          <CarbonAd />
        </div>
      </div>
    </div>
  );
}