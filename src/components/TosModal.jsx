import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { rootminster } from '@/api/rootminsterClient';
import { ShieldCheck } from 'lucide-react';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';

export default function TosModal({ open, isUpdate = false, onAccepted }) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await rootminster.auth.updateMe({
        tos_accepted_at: new Date().toISOString(),
        tos_accepted_version: CURRENT_TERMS_VERSION,
      });
      onAccepted();
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
            {isUpdate ? 'Updated Terms of Service & Privacy Policy' : 'Terms of Service & Privacy Policy'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-slate-400 text-sm">
          {isUpdate
            ? 'We have updated our Terms of Service, including our non-commercial-use policy. Please review and accept the updated terms to continue using Open Domains.'
            : 'Before continuing, please read and agree to our terms. You must accept them to use Open Domains.'}
        </p>

        <ScrollArea className="h-56 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-300 leading-relaxed">
          <p className="font-semibold text-white mb-2">Terms of Service</p>
          <p className="mb-3">
            By using Open Domains, you agree to use this service responsibly and in accordance with all applicable laws.
            You must not use subdomains to host malicious content, phishing pages, spam, or any content that violates the rights of others.
          </p>
          <p className="mb-3 font-medium text-red-400">
            The following are strictly prohibited:
          </p>
          <ul className="list-disc list-inside mb-3 space-y-1 text-slate-300">
            <li>Adult or sexually explicit content of any kind</li>
            <li>Gambling or betting services</li>
            <li>Phishing, malware, or other malicious content</li>
            <li>Spam or unsolicited communications</li>
            <li>Commercial, business, paid, revenue-generating, client, advertising, promotional, or online-shop projects</li>
            <li>Any content that violates applicable laws or third-party rights</li>
          </ul>
          <p className="mb-3">
            <span className="font-semibold text-white">Non-commercial use:</span> Open Domains is exclusively for personal, educational, community, open-source, hobby, and other non-commercial projects. Commercial and business use is not permitted.
          </p>
          <p className="mb-3">
            <span className="font-semibold text-white">Legal responsibility:</span> You accept full legal responsibility for all content hosted under your subdomain.
            Open Domains bears no liability whatsoever for any content, claims, damages, or legal proceedings arising from your use of the service.
          </p>
          <p className="mb-3">
            <span className="font-semibold text-white">Right to remove:</span> Open Domains reserves the right to delete, suspend, or revoke any domain or subdomain
            at any time, for any reason, and without prior notice or explanation. Subdomains are provided free of charge
            and are not guaranteed to remain available.
          </p>
          <p className="font-semibold text-white mb-2 mt-4">Privacy Policy</p>
          <p className="mb-3">
            We collect minimal data necessary to operate this service, including your email address and DNS configuration.
            We do not sell your data to third parties.
          </p>
          <p className="mb-3">
            By registering, you agree that your email may be used to notify you about your subdomain status and important platform updates.
          </p>
          <p className="mb-3">
            For the full Privacy Policy and Terms of Service, please visit the{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Privacy Policy</a>{' '}
            and{' '}
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Terms of Service</a>{' '}
            pages.
          </p>
        </ScrollArea>

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