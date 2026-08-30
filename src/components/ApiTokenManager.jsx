import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Copy, Key, Terminal } from 'lucide-react';
import { format } from 'date-fns';

export default function ApiTokenManager({ user }) {const { t } = useTranslation();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [deviceStep, setDeviceStep] = useState(null); // null | { device_code, user_code, verification_uri }
  const [polling, setPolling] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [tokenName, setTokenName] = useState('My API Token');

  const load = async () => {
    setLoading(true);
    try {
      const all = await rootminster.entities.ApiToken.filter({ user_id: user.id, revoked: false });
      setTokens(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {if (user) load();}, [user]);

  const startDeviceFlow = async () => {
    setCreating(true);
    try {
      const res = await rootminster.functions.invoke('deviceAuth', { action: 'request_code', token_name: tokenName });
      const { device_code, user_code, verification_uri } = res.data;
      setDeviceStep({ device_code, user_code, verification_uri });
      setShowFlow(true);
      // Auto-approve for self-service: since the user is already logged in, approve immediately
      await rootminster.functions.invoke('deviceAuth', { action: 'approve', user_code });
      // Now poll for the key
      setPolling(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const poll = await rootminster.functions.invoke('deviceAuth', { action: 'poll', device_code });
        if (poll.data.status === 'approved' && poll.data.api_key) {
          clearInterval(interval);
          setPolling(false);
          setNewKey(poll.data.api_key);
          setDeviceStep(null);
          load();
        }
        if (attempts > 10 || poll.data.status === 'denied' || poll.data.status === 'expired') {
          clearInterval(interval);
          setPolling(false);
          toast.error(t("operational.api_token_manager.token_generation_failed_please_try_again_53fb16"));
          setShowFlow(false);
        }
      }, 800);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to start device flow');
      setShowFlow(false);
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (token) => {
    try {
      await rootminster.entities.ApiToken.update(token.id, { revoked: true, revoked_by: user.email });
      toast.success(t("operational.api_token_manager.token_revoked_602c0d"));
      load();
    } catch {
      toast.error(t("operational.api_token_manager.failed_to_revoke_token_1df2c4"));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t("operational.api_token_manager.copied_to_clipboard_0e7383"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2"><Key size={14} /> {t("operational.api_token_manager.api_tokens_ee50ac")}</h2>
      </div>

      {/* New token form */}
      {!showFlow && !newKey &&
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <p className="text-slate-400 text-xs">{t("operational.api_token_manager.generate_an_api_key_to_access_the_open_dom_da5076")}</p>
          <div className="flex gap-2">
            <Input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder={t("operational.api_token_manager.token_name_b031b8")}
            className="bg-slate-900 border-slate-700 text-white text-sm flex-1" />
          
            <Button onClick={startDeviceFlow} disabled={creating || !tokenName.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t("operational.api_token_manager.generate_fc45f9")} 

          </Button>
          </div>
        </div>
      }

      {/* Polling state */}
      {showFlow && polling &&
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
          <p className="text-slate-300 text-sm">{t("operational.api_token_manager.generating_your_api_key_bb7e79")}</p>
        </div>
      }

      {/* New key reveal — show once */}
      {newKey &&
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <p className="text-emerald-400 text-sm font-semibold">{t("operational.api_token_manager.api_key_generated_copy_it_now_it_won_t_be__1113f1")}</p>
          <div className="flex gap-2 items-center">
            <code className="bg-slate-900 text-emerald-300 font-mono text-xs px-3 py-2 rounded-lg flex-1 break-all">{newKey}</code>
            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(newKey)}
          className="text-slate-400 hover:text-white shrink-0">
              <Copy size={14} />
            </Button>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5">
            <p className="text-slate-400 text-xs flex items-center gap-1.5"><Terminal size={12} /> {t("operational.api_token_manager.example_usage_861245")}</p>
            <code className="text-slate-300 font-mono text-xs block"> {t("operational.api_token_manager.curl_h_authorization_bearer_d2295b")} 
            {newKey.slice(0, 20)}..." \<br />
              &nbsp;&nbsp;https://&lt;your-app&gt;/functions/publicApi?action=records&domain=example.com
            </code>
          </div>
          <Button size="sm" variant="outline" onClick={() => {setNewKey(null);setShowFlow(false);setTokenName('My API Token');}}
        className="border-slate-700 text-slate-300 bg-transparent"> {t("operational.api_token_manager.done_e9b450")} 

        </Button>
        </div>
      }

      {/* Token list */}
      {loading ?
      <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-500" /></div> :
      tokens.length === 0 ?
      <p className="text-slate-600 text-sm text-center py-4">{t("operational.api_token_manager.no_active_api_tokens_b713e1")}</p> :

      <div className="space-y-2">
          {tokens.map((t) =>
        <div key={t.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3">
              <div>
                <p className="text-white text-sm font-medium">{t.name}</p>
                <p className="text-slate-500 font-mono text-xs">{t.token_prefix}••••••••</p>
                {t.last_used && <p className="text-slate-600 text-xs mt-0.5">{t("operational.api_token_manager.last_used_f1109d")} {format(new Date(t.last_used), 'MMM d, yyyy')}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => revokeToken(t)}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 size={13} />
              </Button>
            </div>
        )}
        </div>
      }

      <p className="text-slate-600 text-xs"> {t("operational.api_token_manager.api_docs_3264db")} 
        <a href="/api-docs" className="text-indigo-400 hover:underline">{t("operational.api_token_manager.view_documentation_e240d7")}</a>
      </p>
    </div>);

}
