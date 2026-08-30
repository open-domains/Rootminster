import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Loader2, KeyRound } from 'lucide-react';

export default function Activate() {
  const [userCode, setUserCode] = useState('');
  const [step, setStep] = useState('enter'); // enter | confirm | done | denied | error
  const [loading, setLoading] = useState(false);
  const [codeInfo, setCodeInfo] = useState(null);
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    // Pre-fill code from URL ?code=XXXX-YYYY or ?acode=XXXX-YYYY
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('acode');
    if (code) setUserCode(code.toUpperCase());

    rootminster.auth.isAuthenticated().then(ok => {
      setAuthed(ok);
      if (!ok) rootminster.auth.redirectToLogin(window.location.href);
    });
  }, []);

  const handleLookup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // We don't have a lookup endpoint, so just proceed to confirm step
      setCodeInfo({ user_code: userCode.toUpperCase() });
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await rootminster.functions.invoke('deviceAuth', { action: 'approve', user_code: userCode.toUpperCase() });
      setStep('done');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed';
      setStep('error');
      setCodeInfo(c => ({ ...c, error: msg }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    try {
      await rootminster.functions.invoke('deviceAuth', { action: 'deny', user_code: userCode.toUpperCase() });
      setStep('denied');
    } catch (_) {
      setStep('denied');
    } finally {
      setLoading(false);
    }
  };

  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Activate API Access</h1>
            <p className="text-slate-400 text-sm">Open Domains Device Auth</p>
          </div>
        </div>

        {step === 'enter' && (
          <form onSubmit={handleLookup} className="space-y-4">
            <p className="text-slate-300 text-sm">Enter the code shown in your terminal or application to grant it API access to your account.</p>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Activation Code</Label>
              <Input
                value={userCode}
                onChange={e => setUserCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="bg-slate-900 border-slate-700 text-white font-mono text-center text-lg tracking-widest placeholder:text-slate-600"
                required
              />
            </div>
            <Button type="submit" disabled={loading || userCode.length < 9} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        )}

        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-2">
              <p className="text-slate-400 text-xs">Activation Code</p>
              <p className="text-white font-mono text-xl font-bold tracking-widest">{userCode}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-300 text-sm font-medium">⚠ Only approve if you initiated this request</p>
              <p className="text-amber-300/70 text-xs mt-1">Approving will generate an API key with access to your account. Never approve codes you didn't request.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleDeny} disabled={loading} variant="outline"
                className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent">
                <XCircle size={15} className="mr-1.5" /> Deny
              </Button>
              <Button onClick={handleApprove} disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle size={15} className="mr-1.5" />}
                Approve
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Access Granted</h2>
              <p className="text-slate-400 text-sm mt-1">The application has been granted API access. You can close this tab.</p>
            </div>
            <p className="text-slate-500 text-xs">Manage your API tokens in <a href="/settings" className="text-indigo-400 hover:underline">Settings</a>.</p>
          </div>
        )}

        {step === 'denied' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Access Denied</h2>
              <p className="text-slate-400 text-sm mt-1">The request has been denied. The application will not receive an API key.</p>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center space-y-4">
            <p className="text-red-400 text-sm">{codeInfo?.error || 'Something went wrong.'}</p>
            <Button onClick={() => setStep('enter')} variant="outline" className="border-slate-700 text-slate-300 bg-transparent">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}