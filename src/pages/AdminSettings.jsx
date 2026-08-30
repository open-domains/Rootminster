import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Bell, MessageCircle, WrenchIcon, Megaphone, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import BlocklistManager from '@/components/BlocklistManager';

const TABS = [
{ id: 'general', label: 'General' },
{ id: 'blocklist', label: 'Blocklist' }];


export default function AdminSettings() {const { t } = useTranslation();
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

  const load = async () => {
    const [me, all] = await Promise.all([
    rootminster.auth.me(),
    rootminster.entities.PlatformSettings.list()]
    );
    setCurrentUser(me);
    const map = {};
    all.forEach((s) => {map[s.key] = { id: s.id, value: s.value };});
    setSettings(map);
    setDiscordWebhook(map['discord_webhook_url']?.value || '');
    setDiscordPublicWebhook(map['discord_public_webhook_url']?.value || '');
    setMaintenanceMode(map['maintenance_mode']?.value === 'true');
    setMaintenanceMessage(map['maintenance_message']?.value || 'We are currently performing scheduled maintenance. Please check back soon.');
    setBannerEnabled(map['notification_banner_enabled']?.value === 'true');
    setBannerText(map['notification_banner_text']?.value || '');
    setExternalLinkWarning(map['external_link_warning_enabled']?.value !== 'false');
    setLoading(false);
  };

  useEffect(() => {load();}, []);

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
        { name: 'Status', value: 'Connected' }]

      });
      if (res.data?.success) toast.success(t("operational.admin_settings.test_notification_sent_to_discord_3f9eaf"));else
      toast.error(res.data?.message || 'Failed to send test notification');
    } catch {
      toast.error(t("operational.admin_settings.failed_to_send_test_notification_0471e1"));
    }
  };

  const SectionCard = ({ icon: Icon, title, description, iconTint = 'primary', children }) =>
  <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
      iconTint === 'accent' ? 'bg-accent/10 text-accent' :
      iconTint === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
      'bg-primary/10 text-primary'}`
      }>
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-foreground font-semibold text-sm">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      {children}
    </div>;


  return (
    <div className="space-y-6">
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
          activeTab === tab.id ?
          'border-primary text-primary' :
          'border-transparent text-muted-foreground hover:text-foreground'}`
          }>
          
            {tab.label}
          </button>
        )}
      </div>

      {loading ?
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div> :
      activeTab === 'blocklist' ?
      <div className="max-w-2xl">
          <BlocklistManager currentUser={currentUser} />
        </div> :

      <div className="grid gap-5 xl:grid-cols-2">
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
            {settings['discord_webhook_url']?.value &&
          <div className="mt-4 pt-4 border-t border-border">
                <Button variant="outline" onClick={testDiscord} className="text-xs gap-2">
                  <MessageCircle size={13} /> {t("operational.admin_settings.send_test_notification_89098e")} 
            </Button>
              </div>
          }
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
                <Switch
                checked={bannerEnabled}
                onCheckedChange={async (val) => {
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
              <Switch
              checked={externalLinkWarning}
              onCheckedChange={async (val) => {
                setExternalLinkWarning(val);
                await saveSetting('external_link_warning_enabled', val ? 'true' : 'false');
                await rootminster.entities.AuditLog.create({
                  actor_email: currentUser?.email,
                  actor_role: currentUser?.role,
                  action: 'toggle_external_link_warning',
                  entity_type: 'PlatformSettings',
                  description: `External link warning ${val ? 'enabled' : 'disabled'} by ${currentUser?.email}`,
                  new_value: val ? 'true' : 'false'
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
                <Switch
                checked={maintenanceMode}
                onCheckedChange={async (val) => {
                  setMaintenanceMode(val);
                  await saveSetting('maintenance_mode', val ? 'true' : 'false');
                  await rootminster.entities.AuditLog.create({
                    actor_email: currentUser?.email,
                    actor_role: currentUser?.role,
                    action: 'toggle_maintenance_mode',
                    entity_type: 'PlatformSettings',
                    description: `Maintenance mode ${val ? 'enabled' : 'disabled'} by ${currentUser?.email}`,
                    new_value: val ? 'true' : 'false'
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
    </div>);

}
