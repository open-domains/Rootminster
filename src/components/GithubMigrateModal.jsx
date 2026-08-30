import { useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Github, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function GithubMigrateModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('confirm'); // 'confirm' | 'done'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleMigrate = async () => {
    setLoading(true);
    setError('');
    const res = await rootminster.functions.invoke('githubMigrate', {});
    const data = res.data;
    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
      setStep('done');
      if (data.imported > 0) onSuccess?.();
    }
    setLoading(false);
  };

  const handleClose = () => {
    setStep('confirm');
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github size={18} className="text-slate-400" />
            Migrate from GitHub
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              We'll search the{' '}
              <a href="https://github.com/open-domains/register" target="_blank" rel="noopener noreferrer"
                className="text-indigo-400 hover:underline">open-domains/register</a>{' '}
              repository for domains registered under your account email and claim them automatically.
            </p>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-300 space-y-1.5">
              <p>✦ Domains matching your email will be claimed to your account</p>
              <p>✦ If any NS records are found, Legacy Donor status will be granted</p>
              <p>✦ Already-managed records will be skipped</p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white">Cancel</Button>
              <Button onClick={handleMigrate} disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Migrating…</>
                  : <><Github size={14} /> Start Migration</>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Results */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-center min-[420px]:grid-cols-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{result.found}</div>
                <div className="text-xs text-slate-400 mt-0.5">Found</div>
              </div>
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-emerald-400">{result.imported}</div>
                <div className="text-xs text-slate-400 mt-0.5">Claimed</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-slate-400">{result.skipped}</div>
                <div className="text-xs text-slate-400 mt-0.5">Skipped</div>
              </div>
            </div>

            {result.found === 0 && (
              <p className="text-slate-400 text-sm text-center">{result.message || 'No domains found for your email in the old system.'}</p>
            )}

            {result.details?.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg max-h-52 overflow-y-auto review-modal-scroll divide-y divide-slate-700/30">
                {result.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {d.status === 'imported'
                        ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                        : <AlertCircle size={12} className="text-slate-500 shrink-0" />}
                      <span className="font-mono text-slate-300">{d.full_name}</span>
                      {d.type && <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">{d.type}</span>}
                    </div>
                    {d.reason && <span className="text-slate-500 ml-2 text-right max-w-[140px]">{d.reason}</span>}
                    {d.status === 'imported' && <span className="text-emerald-400">Claimed</span>}
                  </div>
                ))}
              </div>
            )}

            {result.imported > 0 && (
              <p className="text-slate-400 text-sm">
                ✅ {result.imported} record{result.imported !== 1 ? 's' : ''} successfully claimed under your account.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}