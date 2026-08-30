import { useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

const TRUSTED_KEY = 'od_trusted_device';

export default function TwoFactorChallenge({ onVerified, onLogout }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustBrowser, setTrustBrowser] = useState(true);

  const verify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await rootminster.functions.invoke('twoFactorAuth', {
        action: 'verify',
        code,
        trust_browser: trustBrowser,
        user_agent: navigator.userAgent,
      });
      if (res.data?.device_token) {
        localStorage.setItem(TRUSTED_KEY, res.data.device_token);
      }
      sessionStorage.setItem('2fa_verified', '1');
      onVerified();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Invalid code — try again');
      setCode('');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Shield size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-white text-xl font-bold">Two-Factor Authentication</h1>
          <p className="text-slate-400 text-sm">Enter the 6-digit code from your authenticator app to continue.</p>
        </div>

        <div className="space-y-3">
          <Input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && verify()}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="bg-slate-900 border-slate-700 text-white text-center tracking-widest text-2xl font-mono h-14"
          />
          <Button
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <Checkbox
            checked={trustBrowser}
            onCheckedChange={(v) => setTrustBrowser(v === true)}
            className="mt-0.5 border-slate-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
          <span className="text-slate-300 text-sm leading-snug">
            Trust this browser for 30 days
            <span className="block text-slate-500 text-xs mt-0.5">You won't be asked for a code on this device until it expires or you sign out elsewhere.</span>
          </span>
        </label>

        <button
          onClick={onLogout}
          className="w-full text-slate-500 hover:text-slate-300 text-sm text-center"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}