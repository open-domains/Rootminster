import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { rootminster } from '@/api/rootminsterClient';
import { ShieldCheck } from 'lucide-react';
import TermsContent from '@/components/TermsContent';

export default function TosModal({ open, isUpdate = false, terms, onAccepted }) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setError('');
    setAccepting(true);
    try {
      const updatedUser = await rootminster.terms.accept();
      onAccepted(updatedUser);
    } catch (err) {
      setError(err?.message || 'Could not save your acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-slate-900 border-slate-700 text-white max-w-lg"
        onInteractOutside={e => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" />
            {isUpdate ? 'Updated Terms of Service' : 'Terms of Service'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-slate-400 text-sm">
          {isUpdate
            ? 'We have updated our Terms of Service, including our non-commercial-use policy. Please review and accept the updated terms to continue using Open Domains.'
            : 'Before continuing, please read and agree to our terms. You must accept them to use Open Domains.'}
        </p>

        {terms?.version && <p className="text-xs text-slate-500">Version {terms.version}</p>}

        <ScrollArea className="h-56 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300 leading-relaxed">
          {terms?.summary && <p className="mb-4 rounded-md bg-slate-900/70 p-3 text-slate-200">{terms.summary}</p>}
          <TermsContent className="[--foreground:210_40%_98%] [--muted-foreground:215_20%_75%] [--primary:239_84%_67%]">{terms?.content || 'The current Terms of Service could not be loaded. Please try again.'}</TermsContent>
          <p className="mt-4">Read the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Privacy Policy</a> and <a href={`/terms-of-service${terms?.version ? `?version=${encodeURIComponent(terms.version)}` : ''}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">full Terms of Service</a>.</p>
        </ScrollArea>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            onClick={() => rootminster.auth.logout('/')}
            variant="ghost"
            className="text-slate-400 hover:text-white"
          >
            Decline &amp; Sign Out
          </Button>
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {accepting ? 'Saving…' : isUpdate ? 'Accept Updated Terms' : 'I Agree'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
