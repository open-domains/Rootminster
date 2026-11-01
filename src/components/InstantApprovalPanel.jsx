import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Undo2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const DECISIONS = {
  approved: { label: 'Instantly approved', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  manual: { label: 'Sent to staff review', tone: 'border-border bg-muted text-muted-foreground' },
  failed: { label: 'Instant approval failed', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300' },
  revoked: { label: 'Pulled back to review', tone: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
};

const when = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, 'd MMM yyyy, HH:mm') : null;
};

export default function InstantApprovalPanel({ request, onChanged }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const decision = DECISIONS[request?.safety_auto_decision];
  if (!decision) return null;

  const reasons = Array.isArray(request.safety_auto_reasons) ? request.safety_auto_reasons : [];
  const live = request.safety_auto_decision === 'approved' && request.status === 'approved';
  const monitorUntil = when(request.safety_auto_monitor_until);
  const lastCheck = when(request.safety_auto_last_check_at);

  const pullBack = async () => {
    setBusy(true);
    try {
      await rootminster.functions.invoke('manageInstantApproval', { action: 'revoke', request_id: request.id, reason });
      toast.success('Request pulled back to review and its DNS records removed.');
      setReason('');
      await onChanged?.();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Could not pull the request back to review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Instant approval</span>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${decision.tone}`}>{decision.label}</span>
      </div>
      <div className="space-y-3 p-4 text-xs">
        {when(request.safety_auto_decided_at) && <p className="text-muted-foreground">Decided {when(request.safety_auto_decided_at)}</p>}
        {reasons.length > 0 && (
          <ul className="list-disc space-y-1 pl-4 text-foreground">
            {reasons.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        {live && (
          <p className="text-muted-foreground">
            {monitorUntil ? `Observer re-scans the live site until ${monitorUntil}.` : 'Observer re-scans the live site during the monitoring period.'}
            {lastCheck ? ` Last check ${lastCheck}: ${request.safety_auto_last_check_result || 'clear'}.` : ' The first re-scan is pending.'}
          </p>
        )}
        {live && (
          <div className="space-y-2 border-t border-border pt-3">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why should this go back to review? The requester isn't shown this."
              className="min-h-[60px] text-xs"
              maxLength={500}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={pullBack} className="gap-2">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Pull back to review
            </Button>
            <p className="text-muted-foreground">Removes the DNS records and returns the request to the pending queue, keeping its records so it can be approved again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
