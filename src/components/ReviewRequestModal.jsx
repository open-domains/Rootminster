import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, StickyNote, HelpCircle, Copy, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import ConversationThread from './ConversationThread';
import QuickChips from './QuickChips';
import SafetyBadge from './SafetyBadge';

const normalizeUrl = (url) => {
  if (!url) return url;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export default function ReviewRequestModal({ open, onClose, request, onSuccess }) {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState(null);
  const [requesterName, setRequesterName] = useState(null);
  const [action, setAction] = useState(null);
  const [externalWarning, setExternalWarning] = useState(true);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [overrideVerdict, setOverrideVerdict] = useState('review');
  const [overrideReason, setOverrideReason] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);

  useEffect(() => {
    rootminster.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => {
    rootminster.entities.PlatformSettings.filter({ key: 'external_link_warning_enabled' })
      .then(rows => setExternalWarning(rows[0]?.value !== 'false'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!request?.requester_email) return;
    rootminster.entities.User.list().then(users => {
      const match = users.find(u => u.email === request.requester_email);
      setRequesterName(match?.display_name || match?.full_name || null);
    }).catch(() => {});
  }, [request?.requester_email]);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    }
    setAction(null);
    setAdminNotes('');
    setRejectionReason('');
    setOverrideVerdict('review');
    setOverrideReason('');
  }, [open, request]);

  if (!request) return null;

  const records = request._records || [request];
  const pendingRecords = records.filter(r => ['pending', 'needs_info', 'user_responded'].includes(r.status));

  const previewUrl = normalizeUrl(request.preview_link);
  const safetyAssessments = records.map((record) => record._safety).filter(Boolean).sort((a, b) => Number(b.score) - Number(a.score));
  const safety = safetyAssessments[0] || null;

  const openExternal = (url) => {
    if (externalWarning) {
      setPendingUrl(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const confirmOpenExternal = () => {
    if (pendingUrl) window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    setPendingUrl(null);
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await Promise.all(pendingRecords.map(r =>
        rootminster.functions.invoke('approveRequest', { request_id: r.id, admin_notes: adminNotes })
      ));
      toast.success(t('reviewRequest.approvedToast', { count: pendingRecords.length }));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || t('reviewRequest.approveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await Promise.all(pendingRecords.map(r =>
        rootminster.functions.invoke('rejectRequest', { request_id: r.id, rejection_reason: rejectionReason, admin_notes: adminNotes })
      ));
      toast.success(t('reviewRequest.rejectedToast'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || t('reviewRequest.rejectFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyAction = async (kind) => {
    if (kind === 'override' && overrideReason.trim().length < 5) {
      toast.error('Please give a short reason for the override.');
      return;
    }
    setSafetyLoading(true);
    try {
      await Promise.all(records.map((record) => rootminster.functions.invoke('manageSafetyAssessment', {
        action: kind,
        request_id: record.id,
        ...(kind === 'override' ? { verdict: overrideVerdict, reason: overrideReason.trim() } : {}),
      })));
      toast.success(kind === 'rerun' ? 'Safety screening completed.' : 'Safety verdict overridden.');
      await onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Could not update the safety assessment.');
    } finally {
      setSafetyLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-lg p-0"
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle className="text-base">{t('reviewRequest.title')}</DialogTitle>
          </DialogHeader>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5 review-modal-scroll" style={{ scrollbarGutter: 'stable' }}>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Info size={15} className="text-muted-foreground" />
                <span className="text-foreground text-sm font-medium">{t('reviewRequest.info')}</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{t('reviewRequest.status')}</span>
                  <StatusBadge status={request.status} />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t('reviewRequest.requestedBy')}</span>
                  <div className="bg-muted/60 rounded-lg px-3 py-2">
                    <span className="text-foreground text-sm break-all">{requesterName || request.requester_email}</span>
                    {requesterName && <p className="text-muted-foreground text-xs mt-0.5 break-all">{request.requester_email}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">{t('reviewRequest.subdomain')}</span>
                  <div className="bg-muted/60 rounded-lg px-3 py-2">
                    <span className="text-primary font-mono text-sm font-medium break-all">{request.subdomain}.{request.root_domain}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-muted-foreground text-xs">{t('reviewRequest.dnsRecords', { count: records.length })}</p>
                  {records.map((r, i) => (
                    <div key={i} className="bg-muted/60 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{r.record_type}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="font-mono text-xs text-foreground break-all">{r.record_value}</p>
                      <p className="text-muted-foreground text-xs">{r.proxied ? t('reviewRequest.ttlProxied', { ttl: r.ttl }) : t('reviewRequest.ttlNotProxied', { ttl: r.ttl })}</p>
                    </div>
                  ))}
                </div>

                {request.reason && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-muted-foreground text-xs">{t('reviewRequest.projectDescription')}</p>
                    <div className="bg-muted/60 rounded-lg px-3 py-2">
                      <p className="text-foreground text-sm break-words">{request.reason}</p>
                    </div>
                  </div>
                )}
                {request.preview_link && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-muted-foreground text-xs mb-1">{t('reviewRequest.previewLink')}</p>
                    <a href={previewUrl} onClick={(e) => { e.preventDefault(); openExternal(previewUrl); }}
                      className="text-primary hover:opacity-80 text-sm break-all underline cursor-pointer">
                      {request.preview_link}
                    </a>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(request.preview_link);
                        toast.success(t('reviewRequest.linkCopied'));
                      }}
                      className="mt-2 w-full"
                    >
                      <Copy size={16} className="mr-2" /> {t('reviewRequest.copyLink')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Automated safety screening</span>
                </div>
                <SafetyBadge verdict={safety?.verdict || request.safety_verdict} score={safety?.score ?? request.safety_score} overridden={safety?.overridden || request.safety_overridden} />
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Score</p><p className="mt-1 font-semibold text-foreground">{safety?.score ?? request.safety_score ?? 0}/100</p></div>
                  <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Ruleset</p><p className="mt-1 font-mono text-foreground">{safety?.ruleset_version || request.safety_ruleset_version || '—'}</p></div>
                  <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Provider</p><p className="mt-1 text-foreground">{safety?.provider_status || request.safety_provider_status || 'not configured'}</p></div>
                </div>
                {safety?.signals?.length ? (
                  <div className="space-y-2">
                    {safety.signals.map((item, index) => (
                      <div key={`${item.code}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                        <div><p className="font-medium text-foreground">{item.label}</p>{item.evidence && <p className="mt-0.5 break-all text-muted-foreground">{item.evidence}</p>}</div>
                        <span className="shrink-0 font-mono text-amber-300">+{item.score}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No detailed risk signals were recorded.</p>}
                {safety?.overridden && <div className="rounded-md border border-primary/25 bg-primary/5 p-3 text-xs"><p className="font-medium text-primary">Overridden by {safety.overridden_by}</p><p className="mt-1 text-muted-foreground">{safety.override_reason}</p></div>}
                <div className="space-y-3 border-t border-border pt-4">
                  <Button type="button" size="sm" variant="outline" disabled={safetyLoading} onClick={() => handleSafetyAction('rerun')} className="gap-2">
                    {safetyLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-run screening
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                    <select value={overrideVerdict} onChange={(event) => setOverrideVerdict(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                      <option value="clear">Mark clear</option>
                      <option value="review">Keep for review</option>
                      <option value="high_risk">Mark high risk</option>
                    </select>
                    <Textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required reason for staff override" className="min-h-9 resize-none text-xs" />
                    <Button type="button" size="sm" disabled={safetyLoading || overrideReason.trim().length < 5} onClick={() => handleSafetyAction('override')}>Apply override</Button>
                  </div>
                </div>
              </div>
            </div>

            {action === 'reject' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t('reviewRequest.rejectionReason')}</Label>
                <QuickChips
                  titleKey="reviewRequest.quickRejectTitle"
                  tone="destructive"
                  options={[
                    { labelKey: 'reviewRequest.quickReject.reserved', text: t('reviewRequest.quickReject.reserved') },
                    { labelKey: 'reviewRequest.quickReject.privateIp', text: t('reviewRequest.quickReject.privateIp') },
                    { labelKey: 'reviewRequest.quickReject.insufficientReason', text: t('reviewRequest.quickReject.insufficientReason') },
                    { labelKey: 'reviewRequest.quickReject.invalidPreview', text: t('reviewRequest.quickReject.invalidPreview') },
                    { labelKey: 'reviewRequest.quickReject.blockedValue', text: t('reviewRequest.quickReject.blockedValue') },
                    { labelKey: 'reviewRequest.quickReject.nonCommercial', text: t('reviewRequest.quickReject.nonCommercial') },
                  ]}
                  onSelect={(text) => setRejectionReason(prev => (prev ? `${prev}\n\n${text}` : text))}
                />
                <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  placeholder={t('reviewRequest.rejectionPlaceholder')}
                  className="resize-none h-20" />
              </div>
            )}

            <div className="overflow-visible rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <StickyNote size={15} className="text-muted-foreground" />
                <span className="text-foreground text-sm font-medium">{t('reviewRequest.adminNotes')}</span>
                <div className="relative group">
                  <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                  <div className="absolute top-full mt-2 left-0 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 w-52 z-50 shadow-soft border border-border">
                    {t('reviewRequest.adminNotesHelp')}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder={t('reviewRequest.adminNotesPlaceholder')}
                  className="resize-none h-16 text-sm" />
              </div>
            </div>

            <ConversationThread
              requestId={records[0].id}
              requestType="subdomain"
              currentUser={currentUser}
            />

            {pendingRecords.length === 0 ? null : !action ? (
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setAction('reject')} variant="outline"
                  className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10">
                  <XCircle size={16} className="mr-2" /> {t('reviewRequest.reject')}
                </Button>
                <Button onClick={() => setAction('approve')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
                  <CheckCircle size={16} className="mr-2" /> {pendingRecords.length > 1 ? t('reviewRequest.approveAll', { count: pendingRecords.length }) : t('reviewRequest.approve')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setAction(null)} disabled={loading} className="flex-1">
                  {t('reviewRequest.back')}
                </Button>
                <Button
                  onClick={action === 'approve' ? handleApprove : handleReject}
                  disabled={loading || (action === 'reject' && !rejectionReason)}
                  variant={action === 'approve' ? 'default' : 'destructive'}
                  className={action === 'approve' ? 'flex-1 bg-emerald-600 hover:bg-emerald-500 text-white' : 'flex-1'}
                >
                  {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
                  {action === 'approve' ? t('reviewRequest.confirmApproval') : t('reviewRequest.confirmRejection')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingUrl} onOpenChange={(o) => { if (!o) setPendingUrl(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reviewRequest.leaveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reviewRequest.leaveDesc')}
              <span className="block mt-3 text-foreground font-mono text-xs break-all">{pendingUrl}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOpenExternal}>{t('reviewRequest.openNewTab')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
