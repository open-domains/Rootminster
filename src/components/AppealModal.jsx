import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AppealModal({ request, open, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await rootminster.functions.invoke('appealRequest', {
        request_id: request.id,
        appeal_message: message.trim(),
      });
      toast.success(t('appeal.success'));
      setMessage('');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || t('appeal.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('appeal.title')}</DialogTitle>
          <DialogDescription>
            {t('appeal.description')}
          </DialogDescription>
        </DialogHeader>

        {request?.rejection_reason && (
          <div className="flex gap-2 bg-destructive/10 border border-destructive/25 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={15} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-destructive font-medium text-xs mb-0.5">{t('appeal.rejectionReason')}</p>
              <p className="text-destructive/90">{request.rejection_reason}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-foreground font-medium">{t('appeal.yourAppeal')}</label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('appeal.placeholder')}
            className="resize-none h-32"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || loading}
          >
            {loading ? <><Loader2 size={14} className="animate-spin mr-2" /> {t('appeal.submitting')}</> : t('appeal.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}