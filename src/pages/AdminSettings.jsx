import { useTranslation } from "react-i18next";
import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Loader2, Save, Bell, MessageCircle, WrenchIcon, Megaphone, ExternalLink,
  Globe2, RefreshCw, Plus, LockKeyhole, ShieldCheck, Lock,
  Trash2, AlertTriangle, UserCheck, Database, CheckCircle2, XCircle,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BlocklistManager from '@/components/BlocklistManager';
import TermsManager from '@/components/TermsManager';
import StatusBadge from '@/components/StatusBadge';
import { isPublicSuffix } from '@/lib/psl-check';
import { format } from 'date-fns';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'zones', label: 'Zones & Requests' },
  { id: 'blocklist', label: 'Blocklist' },
  { id: 'terms', label: 'Terms' },
];

const SectionCard = ({ icon: Icon, title, description, iconTint = 'primary', children }) =>
  <div className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
        iconTint === 'accent' ? 'bg-accent/10 text-accent' :
        iconTint === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
        'bg-primary/10 text-primary'}`}>
        <Icon size={16} />
      </div>
      <div>
        <h2 className="text-foreground font-semibold text-sm">{title}</h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
    {children}
  </div>;

function PslBadge({ domain }) {
  const onPsl = isPublicSuffix(domain);
  const title = onPsl
    ? 'Listed in the Mozilla Public Suffix List. Third-party platforms (Vercel, Netlify, GitHub Pages) recognise subdomains as independent registrable names.'
    : 'Not yet listed in the Mozilla Public Suffix List.';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ml-1 cursor-default select-none ${
        onPsl
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
      }`}
    >
      {onPsl ? <><ShieldCheck size={9} /> PSL</> : <><Lock size={9} /> Private</>}
    </span>
  );
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [currentUser, setCurrentUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [discordPublicWebhook, setDiscordPublicWebhook] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are currently performing scheduled maintenance. Please check back soon.');
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [externalLinkWarning, setExternalLinkWarning] = useState(true);
  const [domains, setDomains] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [cloudflareZones, setCloudflareZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [reservedDrafts, setReservedDrafts] = useState({});
  const [requestsLocked, setRequestsLocked] = useState(false);
  const [requestsLockedMessage, setRequestsLockedMessage] = useState('New subdomain requests are temporarily closed.');
  const [discordBotStatus, setDiscordBotStatus] = useState(null);
  // Zone management
  const [syncingId, setSyncingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [assignProviderDomain, setAssignProviderDomain] = useState(null);
  const [providerUsers, setProviderUsers] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [assigningProvider, setAssigningProvider] = useState(false);

  const load = async () => {
    const [me, all, domainRows, botStatus, logRows] = await Promise.all([
      rootminster.auth.me(),
      rootminster.entities.PlatformSettings.list(),
      rootminster.entities.Domain.list(),
      rootminster.discord.status(),
      rootminster.entities.SyncLog.list('-created_date', 20),
    ]);
    setCurrentUser(me);
    const map = {};
    all.forEach((s) => { map[s.key] = { id: s.id, value: s.value }; });
    setSettings(map);
    setDiscordWebhook(map['discord_webhook_url']?.value || '');
    setDiscordPublicWebhook(map['discord_public_webhook_url']?.value || '');
    setMaintenanceMode(map['maintenance_mode']?.value === 'true');
    setMaintenanceMessage(map['maintenance_message']?.value || 'We are currently performing scheduled maintenance. Please check back soon.');
    setBannerEnabled(map['notification_banner_enabled']?.value === 'true');
    setBannerText(map['notification_banner_text']?.value || '');
    setExternalLinkWarning(map['external_link_warning_enabled']?.value !== 'false');
    setRequestsLocked(map['requests_locked']?.value === 'true');
    setRequestsLockedMessage(map['requests_locked_message']?.value || 'New subdomain requests are temporarily closed.');
    setDomains(domainRows);
    setReservedDrafts(Object.fromEntries(domainRows.map((domain) => [domain.id, (domain.reserved_names || []).join('\n')])));
    setDiscordBotStatus(botStatus);
    setSyncLogs(logRows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fetchCloudflareZones = async () => {
    setLoadingZones(true);
    try {
      const result = await rootminster.functions.invoke('getCloudflareZones', {});
      setCloudflareZones(result.data?.zones || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load Cloudflare zones');
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'zones' && cloudflareZones.length === 0) fetchCloudflareZones();
  }, [activeTab]);

  const importZone = async (zone) => {
    setSaving((state) => ({ ...state, [`zone-${zone.id}`]: true }));
    try {
      await rootminster.entities.Domain.create({ zone_id: zone.id, name: zone.name, status: zone.status, nameservers: zone.nameservers || [], allow_new_requests: true, reserved_names: [] });
      toast.success(`${zone.name} added for requests`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to add zone');
    } finally {
      setSaving((state) => ({ ...state, [`zone-${zone.id}`]: false }));
    }
  };

  const toggleDomainRequests = async (domain, enabled) => {
    setSaving((state) => ({ ...state, [`requests-${domain.id}`]: true }));
    try {
      await rootminster.entities.Domain.update(domain.id, { allow_new_requests: enabled });
      toast.success(`${domain.name} requests ${enabled ? 'unlocked' : 'locked'}`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to update zone');
    } finally {
      setSaving((state) => ({ ...state, [`requests-${domain.id}`]: false }));
    }
  };

  const saveReservedNames = async (domain) => {
    setSaving((state) => ({ ...state, [`reserved-${domain.id}`]: true }));
    try {
      const reservedNames = [...new Set(String(reservedDrafts[domain.id] || '').split(/[\n,]+/).map((name) => name.trim().toLowerCase()).filter(Boolean))];
      await rootminster.entities.Domain.update(domain.id, { reserved_names: reservedNames });
      toast.success(`Reserved records updated for ${domain.name}`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to save reserved records');
    } finally {
      setSaving((state) => ({ ...state, [`reserved-${domain.id}`]: false }));
    }
  };

  const syncDomain = async (domain) => {
    setSyncingId(domain.id);
    try {
      const res = await rootminster.functions.invoke('syncCloudflare', { zone_id: domain.zone_id, zone_name: domain.name });
      toast.success(`Synced ${res.data.records_synced} records for ${domain.name}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const deleteDomain = async () => {
    if (!confirmDelete) return;
    try {
      await rootminster.entities.Domain.delete(confirmDelete.id);
      toast.success(`${confirmDelete.name} removed`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    } finally {
      setConfirmDelete(null);
      load();
    }
  };

  const openAssignProvider = async (domain) => {
    setAssignProviderDomain(domain);
    setLoadingProviders(true);
    try {
      const res = await rootminster.functions.invoke('adminListUsers', {});
      setProviderUsers((res.data?.users || []).filter((u) => u.role === 'domain_provider'));
    } catch {
      toast.error('Failed to load provider users');
    } finally {
      setLoadingProviders(false);
    }
  };

  const assignProvider = async (userId) => {
    if (!assignProviderDomain) return;
    setAssigningProvider(true);
    try {
      await rootminster.functions.invoke('adminAssignDomainProvider', {
        domain_id: assignProviderDomain.id,
        user_id: userId,
      });
      toast.success(userId ? 'Provider assigned' : 'Provider removed');
      setAssignProviderDomain(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to assign provider');
    } finally {
      setAssigningProvider(false);
    }
  };

  const saveSetting = async (key, value) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const existing = settings[key];
      if (existing?.id) {
        await rootminster.entities.PlatformSettings.update(existing.id, { value });
      } else {
        await rootminster.entities.PlatformSettings.create({ key, value, description: key });
      }
      toast.success(t("operational.admin_settings.setting_saved_08f62c"));
      load();
    } catch {
      toast.error(t("operational.admin_settings.failed_to_save_setting_f537d5"));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const testDiscord = async () => {
    try {
      const res = await rootminster.functions.invoke('sendDiscordNotification', {
        event_type: 'new_request',
        title: t("operational.admin_settings.test_notification_ac5503"),
        description: t("operational.admin_settings.discord_notifications_are_working_correctl_6eb6d7"),
        fields: [
          { name: 'Platform', value: 'Open Domains' },
          { name: 'Status', value: 'Connected' },
        ],
      });
      if (res.data?.success) toast.success(t("operational.admin_settings.test_notification_sent_to_discord_3f9eaf"));
      else toast.error(res.data?.message || 'Failed to send test notification');
    } catch {
      toast.error(t("operational.admin_settings.failed_to_send_test_notification_0471e1"));
    }
  };

  const openForRequests = domains.filter((d) => d.allow_new_requests).length;
  const failedSyncs = syncLogs.filter((s) => s.status === 'failed').length;
  const totalRecords = domains.reduce((sum, d) => sum + (d.record_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Delete zone confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" /> Remove zone
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{confirmDelete?.name}</strong> from Rootminster? This does not delete the Cloudflare zone or its DNS records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign provider modal */}
      <Dialog open={!!assignProviderDomain} onOpenChange={(open) => !open && setAssignProviderDomain(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-400" />
              Assign domain provider — {assignProviderDomain?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {assignProviderDomain?.provider_user_email && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">Current provider</p>
                <p className="text-foreground font-medium">{assignProviderDomain.provider_user_email}</p>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => assignProvider(null)}
                  disabled={assigningProvider}
                  className="mt-2 h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  Remove provider
                </Button>
              </div>
            )}
            {loadingProviders ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : providerUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users have the Domain Provider role yet. Go to Admin → Users and grant the role first.
              </p>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Select a domain provider user</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {providerUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => assignProvider(u.id)}
                      disabled={assigningProvider}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                        assignProviderDomain?.provider_user_id === u.id
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : 'border-border hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <span className="font-medium">{u.full_name || u.email}</span>
                      {u.full_name && <span className="text-muted-foreground text-xs ml-2">{u.email}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" onClick={() => setAssignProviderDomain(null)} className="w-full">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.admin_settings.platform_control_777333")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.admin_settings.platform_settings_5c94a2")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.admin_settings.configure_notifications_safety_controls_ma_88376f")}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </button>
        )}
      </div>

      {loading
        ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
        : activeTab === 'zones'
          ? <div className="space-y-6">

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Globe2, label: 'Zones', value: domains.length, tint: 'text-foreground' },
                  { icon: Database, label: 'DNS Records', value: totalRecords, tint: 'text-foreground' },
                  { icon: CheckCircle2, label: 'Open for requests', value: openForRequests, tint: 'text-emerald-400' },
                  { icon: XCircle, label: 'Failed syncs', value: failedSyncs, tint: failedSyncs ? 'text-destructive' : 'text-foreground' },
                ].map(({ icon: Icon, label, value, tint }) => (
                  <div key={label} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                    <Icon size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className={`text-xl font-semibold tabular-nums ${tint}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Global request gate */}
              <SectionCard icon={LockKeyhole} iconTint={requestsLocked ? 'accent' : 'emerald'} title="Global request gate" description="Immediately lock or unlock new requests across every managed zone.">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Lock all new requests</p>
                      <p className="text-xs text-muted-foreground">Staff and admins can still test submissions while the public gate is locked.</p>
                    </div>
                    <Switch checked={requestsLocked} onCheckedChange={async (value) => {
                      setRequestsLocked(value);
                      await saveSetting('requests_locked', value ? 'true' : 'false');
                    }} />
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-4">
                    <Label className="text-xs">Message shown while requests are locked</Label>
                    <div className="flex gap-2">
                      <Input value={requestsLockedMessage} onChange={(event) => setRequestsLockedMessage(event.target.value)} placeholder="New requests are temporarily closed." />
                      <Button onClick={() => saveSetting('requests_locked_message', requestsLockedMessage)} disabled={saving.requests_locked_message}>
                        {saving.requests_locked_message ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      </Button>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Cloudflare zone catalogue */}
              <SectionCard icon={Globe2} title="Cloudflare zone catalogue" description="Import Cloudflare zones into Rootminster so they can receive subdomain requests.">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{cloudflareZones.length} zones returned by Cloudflare</p>
                  <Button size="sm" variant="outline" onClick={fetchCloudflareZones} disabled={loadingZones} className="gap-2">
                    <RefreshCw size={13} className={loadingZones ? 'animate-spin' : ''} /> Refresh
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {cloudflareZones.map((zone) => {
                    const existing = domains.find((domain) => domain.zone_id === zone.id);
                    return (
                      <div key={zone.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium text-foreground">{zone.name}</p>
                          <p className="text-[11px] text-muted-foreground">{zone.status}</p>
                        </div>
                        {existing
                          ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400">Added</span>
                          : <Button size="sm" onClick={() => importZone(zone)} disabled={saving[`zone-${zone.id}`]} className="h-7 gap-1 px-2 text-xs">
                              {saving[`zone-${zone.id}`] ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
                            </Button>
                        }
                      </div>
                    );
                  })}
                  {!loadingZones && cloudflareZones.length === 0 && (
                    <p className="text-sm text-muted-foreground">No zones returned. Check the Cloudflare API token.</p>
                  )}
                </div>
              </SectionCard>

              {/* Managed zones */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Managed zones</h2>
                    <p className="text-xs text-muted-foreground">Sync records, assign providers, toggle requests, and manage reserved names.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{domains.length} configured</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {domains.map((domain) => (
                    <div key={domain.id} className="rounded-lg border border-border bg-card p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <Globe2 size={14} className="text-primary shrink-0" />
                            <span className="font-mono text-sm font-semibold text-foreground">{domain.name}</span>
                            <PslBadge domain={domain.name} />
                            <StatusBadge status={domain.status} />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span className="font-mono truncate max-w-[160px]">{domain.zone_id}</span>
                            {domain.record_count != null && <span>{domain.record_count} records</span>}
                            {domain.last_synced && <span>Synced {format(new Date(domain.last_synced), 'MMM d, HH:mm')}</span>}
                            {domain.provider_user_email && <span className="text-emerald-400">Provider: {domain.provider_user_email}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => openAssignProvider(domain)}
                            className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10"
                            title="Assign domain provider"
                          >
                            <UserCheck size={13} />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => syncDomain(domain)}
                            disabled={syncingId === domain.id}
                            className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Sync from Cloudflare"
                          >
                            <RefreshCw size={13} className={syncingId === domain.id ? 'animate-spin' : ''} />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => setConfirmDelete(domain)}
                            className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            title="Remove zone"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>

                      {/* Request toggle */}
                      <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Accept new requests</p>
                          <p className="text-xs text-muted-foreground">Allow users to request subdomains under this zone.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${domain.allow_new_requests ? 'text-emerald-400' : 'text-destructive'}`}>
                            {domain.allow_new_requests ? 'Unlocked' : 'Locked'}
                          </span>
                          {saving[`requests-${domain.id}`]
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Switch checked={!!domain.allow_new_requests} onCheckedChange={(value) => toggleDomainRequests(domain, value)} />}
                        </div>
                      </div>

                      {/* Reserved names */}
                      <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={13} className="text-muted-foreground" />
                          <Label className="text-xs">Reserved subdomain records</Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">One name per line. Wildcards supported, e.g. <code>admin</code>, <code>mail-*</code>.</p>
                        <Textarea
                          value={reservedDrafts[domain.id] || ''}
                          onChange={(event) => setReservedDrafts((state) => ({ ...state, [domain.id]: event.target.value }))}
                          placeholder={'www\nmail\nadmin\nstatus-*'}
                          className="min-h-28 font-mono text-xs"
                        />
                        <Button
                          size="sm" variant="outline"
                          onClick={() => saveReservedNames(domain)}
                          disabled={saving[`reserved-${domain.id}`]}
                          className="gap-2"
                        >
                          {saving[`reserved-${domain.id}`] ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Save reservations
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync history */}
              {syncLogs.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Sync history</h2>
                    <span className="text-xs text-muted-foreground">Latest {syncLogs.length}</span>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['Zone', 'Status', 'Synced', 'Added', 'Updated', 'By', 'Time', 'Error'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {syncLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 font-mono text-foreground">{log.zone_name}</td>
                            <td className="px-3 py-2"><StatusBadge status={log.status} /></td>
                            <td className="px-3 py-2 tabular-nums text-foreground">{log.records_synced ?? 0}</td>
                            <td className="px-3 py-2 tabular-nums text-emerald-400">{log.records_added ?? 0}</td>
                            <td className="px-3 py-2 tabular-nums text-primary">{log.records_updated ?? 0}</td>
                            <td className="px-3 py-2 text-muted-foreground">{log.triggered_by || 'system'}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}</td>
                            <td className="px-3 py-2 max-w-[140px]">
                              {log.error_message
                                ? <span className="text-destructive truncate block" title={log.error_message}>{log.error_message}</span>
                                : <span className="text-muted-foreground/50">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          : activeTab === 'blocklist'
            ? <div className="max-w-2xl"><BlocklistManager currentUser={currentUser} /></div>

            : activeTab === 'terms'
              ? <TermsManager />

              : <div className="grid gap-5 xl:grid-cols-2">
                  <SectionCard icon={Bell} title={t("operational.admin_settings.discord_notifications_a5bf38")} description="Receive real-time alerts for requests, approvals, and system events.">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("operational.admin_settings.discord_webhook_url_9454d7")}</Label>
                      <p className="text-muted-foreground text-xs">{t("operational.admin_settings.paste_your_discord_channel_webhook_url_to__24bd5c")}</p>
                      <div className="flex gap-2">
                        <Input value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="flex-1" />
                        <Button onClick={() => saveSetting('discord_webhook_url', discordWebhook)} disabled={saving['discord_webhook_url']} className="shrink-0">
                          {saving['discord_webhook_url'] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </Button>
                      </div>
                    </div>
                    {settings['discord_webhook_url']?.value && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <Button variant="outline" onClick={testDiscord} className="text-xs gap-2">
                          <MessageCircle size={13} /> {t("operational.admin_settings.send_test_notification_89098e")}
                        </Button>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard icon={MessageCircle} iconTint={discordBotStatus?.enabled ? 'emerald' : 'accent'} title="Discord request bot" description="Let linked users submit requests and let staff review them with slash commands.">
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
                        <span>Environment status</span>
                        <span className={discordBotStatus?.enabled ? 'text-emerald-400' : 'text-amber-300'}>{discordBotStatus?.enabled ? 'Enabled' : 'Not configured'}</span>
                      </div>
                      <p>Commands: <code>/link</code>, <code>/request</code>, <code>/requests</code>, <code>/request-view</code>, and staff-only <code>/request-manage</code>.</p>
                      <p>Set the Discord application interaction endpoint to <code className="break-all">{window.location.origin}/api/discord/interactions</code>. Bot credentials remain server-side environment variables.</p>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Bell} title={t("operational.admin_settings.discord_weekly_public_stats_1c3f22")} description="Posts a weekly stats summary every Sunday at 11 PM GMT to a public channel.">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("operational.admin_settings.public_channel_webhook_url_7e8d92")}</Label>
                      <p className="text-muted-foreground text-xs">{t("operational.admin_settings.paste_the_webhook_url_for_your_public_disc_ebbea3")}</p>
                      <div className="flex gap-2">
                        <Input value={discordPublicWebhook} onChange={(e) => setDiscordPublicWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="flex-1" />
                        <Button onClick={() => saveSetting('discord_public_webhook_url', discordPublicWebhook)} disabled={saving['discord_public_webhook_url']} className="shrink-0">
                          {saving['discord_public_webhook_url'] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </Button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Megaphone} title={t("operational.admin_settings.notification_banner_299bd5")} description="Show a dismissible banner across the top of every page.">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-foreground text-sm font-medium">{t("operational.admin_settings.enable_banner_44d2a2")}</p>
                          <p className="text-muted-foreground text-xs">{t("operational.admin_settings.visible_to_all_logged_in_users_85feaf")}</p>
                        </div>
                        <Switch checked={bannerEnabled} onCheckedChange={async (val) => {
                          setBannerEnabled(val);
                          await saveSetting('notification_banner_enabled', val ? 'true' : 'false');
                        }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-foreground text-xs font-medium">{t("operational.admin_settings.banner_message_83937c")}</label>
                        <div className="flex gap-2">
                          <Input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder={t("operational.admin_settings.enter_your_announcement_1d01a2")} className="flex-1" />
                          <Button onClick={() => saveSetting('notification_banner_text', bannerText)} disabled={saving['notification_banner_text']} className="shrink-0">
                            {saving['notification_banner_text'] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={ExternalLink} iconTint="accent" title={t("operational.admin_settings.external_link_warning_61cf31")} description="Show a confirmation popup when staff click external preview links in the review modal.">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-foreground text-sm font-medium">{t("operational.admin_settings.warn_before_leaving_open_domains_bbde34")}</p>
                        <p className="text-muted-foreground text-xs">{t("operational.admin_settings.asks_for_confirmation_before_opening_exter_e1c785")}</p>
                      </div>
                      <Switch checked={externalLinkWarning} onCheckedChange={async (val) => {
                        setExternalLinkWarning(val);
                        await saveSetting('external_link_warning_enabled', val ? 'true' : 'false');
                        await rootminster.entities.AuditLog.create({
                          actor_email: currentUser?.email,
                          actor_role: currentUser?.role,
                          action: 'toggle_external_link_warning',
                          entity_type: 'PlatformSettings',
                          description: `External link warning ${val ? 'enabled' : 'disabled'} by ${currentUser?.email}`,
                          new_value: val ? 'true' : 'false',
                        });
                      }} />
                    </div>
                  </SectionCard>

                  <SectionCard icon={WrenchIcon} iconTint="accent" title={t("operational.admin_settings.maintenance_mode_a99b9e")} description="When enabled, non-admin users see a maintenance page instead of the app.">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-foreground text-sm font-medium">{t("operational.admin_settings.enable_maintenance_mode_1f9646")}</p>
                          <p className="text-muted-foreground text-xs">{t("operational.admin_settings.admins_can_still_access_the_app_normally_3226ab")}</p>
                        </div>
                        <Switch checked={maintenanceMode} onCheckedChange={async (val) => {
                          setMaintenanceMode(val);
                          await saveSetting('maintenance_mode', val ? 'true' : 'false');
                          await rootminster.entities.AuditLog.create({
                            actor_email: currentUser?.email,
                            actor_role: currentUser?.role,
                            action: 'toggle_maintenance_mode',
                            entity_type: 'PlatformSettings',
                            description: `Maintenance mode ${val ? 'enabled' : 'disabled'} by ${currentUser?.email}`,
                            new_value: val ? 'true' : 'false',
                          });
                        }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-foreground text-xs font-medium">{t("operational.admin_settings.maintenance_message_238257")}</label>
                        <div className="flex gap-2">
                          <Input value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} placeholder={t("operational.admin_settings.we_are_currently_performing_maintenance_f6382a")} className="flex-1" />
                          <Button onClick={() => saveSetting('maintenance_message', maintenanceMessage)} disabled={saving['maintenance_message']} className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
                            {saving['maintenance_message'] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
      }
    </div>
  );
}
