import { useTranslation } from "react-i18next";import { useState, useEffect, useCallback } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Monitor, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function timeUntil(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function TrustedBrowsers({ user }) {const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rootminster.functions.invoke('twoFactorAuth', { action: 'list_trusted' });
      setDevices(res.data?.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {if (user?.totp_enabled) load();}, [user, load]);

  const revoke = async (id) => {
    setRevoking(id);
    try {
      await rootminster.functions.invoke('twoFactorAuth', { action: 'revoke_trusted', device_id: id });
      setDevices((d) => d.filter((x) => x.id !== id));
      toast.success(t("operational.trusted_browsers.trusted_browser_revoked_264eed"));
    } catch {
      toast.error(t("operational.trusted_browsers.failed_to_revoke_fc130d"));
    } finally {
      setRevoking(null);
    }
  };

  if (!user?.totp_enabled) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-slate-700/50 border border-slate-600/30 flex items-center justify-center">
          <Monitor size={16} className="text-slate-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{t("operational.trusted_browsers.trusted_browsers_b46e58")}</p>
          <p className="text-slate-400 text-xs">{t("operational.trusted_browsers.browsers_that_can_skip_the_2fa_prompt_for__4a4716")}</p>
        </div>
      </div>

      {loading ?
      <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div> :
      devices.length === 0 ?
      <p className="text-slate-500 text-sm py-3 text-center">{t("operational.trusted_browsers.no_trusted_browsers_yet_check_trust_this_b_141b1f")}</p> :

      <div className="space-y-2">
          {devices.map((d) => {
          const current = localStorage.getItem('od_trusted_device')?.startsWith(d.token_prefix || '__none__');
          return (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3 bg-slate-900/50 border border-slate-700/40 rounded-lg">
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate flex items-center gap-2">
                    {d.user_agent ? parseBrowser(d.user_agent) : 'Unknown browser'}
                    {current &&
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">{t("operational.trusted_browsers.this_device_fa5a6d")}</span>
                  }
                  </p>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> {t("operational.trusted_browsers.last_used_f1109d")} {timeAgo(d.last_used)} {t("operational.trusted_browsers.expires_in_faa4be")} {timeUntil(d.expires_at)}
                  </p>
                </div>
                <button
                onClick={() => revoke(d.id)}
                disabled={revoking === d.id}
                className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors shrink-0 disabled:opacity-50"
                title={t("operational.trusted_browsers.revoke_trust_faa75c")}>
                
                  <Trash2 size={15} />
                </button>
              </div>);

        })}
        </div>
      }
    </div>);

}

function parseBrowser(ua) {
  if (!ua) return 'Unknown browser';
  if (/edg/i.test(ua)) return 'Microsoft Edge';
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/opr|opera/i.test(ua)) return 'Opera';
  return 'Web Browser';
}
