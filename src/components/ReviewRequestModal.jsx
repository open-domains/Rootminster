import { groupSubdomainRequests, recordSetError } from '../../shared/subdomain-requests.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, StickyNote, HelpCircle, Copy, RefreshCw, ShieldAlert, ExternalLink, FileText, Network, UserRound, CalendarClock, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import ConversationThread from './ConversationThread';
import QuickChips from './QuickChips';
import SafetyBadge from './SafetyBadge';
import InstantApprovalPanel from './InstantApprovalPanel';
import { readableEvidence } from '@/lib/observer-evidence';

const normalizeUrl = (url) => {
  if (!url) return url;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, 'MMM d, yyyy · HH:mm') : null;
};

function ColumnHeading({ children }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function ReviewSection({ icon: Icon, title, aside, className, children }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} className="shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default function ReviewRequestModal({ open, onClose, request, onSuccess }) {
  const { t } = useTranslation();
  const [conversationStatus, setConversationStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [requesterName, setRequesterName] = useState(null);
  const [action, setAction] = useState(null);
  const [externalWarning, setExternalWarning] = useState(true);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [reviewGateMet, setReviewGateMet] = useState(false);

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
      setRequesterName(match?.full_name || null);
    }).catch(() => {});
  }, [request?.requester_email]);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const reviewGateFrameRef = useRef(null);
  const scrolledToEndRef = useRef(false);

  useEffect(() => {
    if (open && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    }
    setConversationStatus(null);
    setAction(null);
    setAdminNotes('');
    setRejectionReason('');
    setReviewGateMet(false);
    scrolledToEndRef.current = false;
  }, [open, request]);

  const evaluateReviewGate = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return false;
    const hasNoScroll = node.scrollHeight <= node.clientHeight + 8;
    const reachedEnd = node.scrollTop + node.clientHeight >= node.scrollHeight - 64;
    // Once staff have scrolled through everything, content that grows afterwards
    // (a rejection reason box, a new message) must not lock the decision again.
    if (!hasNoScroll && reachedEnd) scrolledToEndRef.current = true;
    const gateMet = scrolledToEndRef.current || hasNoScroll;
    setReviewGateMet(gateMet);
    return gateMet;
  }, []);

  const scheduleReviewGateEvaluation = useCallback(() => {
    if (reviewGateFrameRef.current) cancelAnimationFrame(reviewGateFrameRef.current);
    reviewGateFrameRef.current = requestAnimationFrame(() => {
      reviewGateFrameRef.current = null;
      evaluateReviewGate();
    });
  }, [evaluateReviewGate]);

  useEffect(() => {
    if (!open || !request) return undefined;
    const node = scrollRef.current;
    if (!node) return undefined;

    const observeChildren = (observer) => {
      observer.observe(node);
      Array.from(node.children).forEach((child) => observer.observe(child));
    };

    const resizeObserver = new ResizeObserver(scheduleReviewGateEvaluation);
    observeChildren(resizeObserver);
    const mutationObserver = new MutationObserver(() => {
      resizeObserver.disconnect();
      observeChildren(resizeObserver);
      scheduleReviewGateEvaluation();
    });
    mutationObserver.observe(node, { childList: true, subtree: true });
    scheduleReviewGateEvaluation();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (reviewGateFrameRef.current) {
        cancelAnimationFrame(reviewGateFrameRef.current);
        reviewGateFrameRef.current = null;
      }
    };
  }, [open, request, scheduleReviewGateEvaluation]);

  if (!request) return null;

  const records = request._records || groupSubdomainRequests([request])[0]._records;
  const requestRows = request._requests || [request];
  const compatibilityError = recordSetError(records);
  const pendingRecords = records.filter(r => ['pending', 'needs_info', 'user_responded'].includes(r.status));

  const previewUrl = normalizeUrl(request.preview_link);
  const observerFindings = (request._observerFindings || []).filter((finding) => !['dismissed', 'resolved'].includes(String(finding.status || 'open').toLowerCase()));
  const observerStatus = request.observer_status || (request.observer_scanned_at ? 'clear' : 'undetermined');
  const observerSeverity = request.observer_severity || observerStatus;
  const observerScore = request.observer_score ?? 0;
  const observerFindingCount = Number(request.observer_finding_count) || 0;
  const observerVerdict = observerStatus === 'flagged'
    ? (['critical', 'high'].includes(String(observerSeverity).toLowerCase()) ? 'high_risk' : 'review')
    : observerStatus === 'clear' ? 'clear' : 'incomplete';
  const hostname = `${request.subdomain}.${request.root_domain}`;
  const submittedAt = formatDateTime(request.created_date);
  const threatMatches = requestRows.flatMap((row) => row.threat_intel_matches || []);

  const copyText = (text, message) => {
    if (!navigator.clipboard?.writeText) {
      toast.error('Copying isn\'t available in this browser.');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(() => toast.error('Could not copy to the clipboard.'));
  };

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
    if (!evaluateReviewGate()) {
      toast.error('Read the full review context before approving this request.');
      return;
    }
    setLoading(true);
    try {
      await rootminster.functions.invoke('approveRequest', { request_id: request.id, admin_notes: adminNotes });
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
    if (!evaluateReviewGate()) {
      toast.error('Read the full review context before rejecting this request.');
      return;
    }
    setLoading(true);
    try {
      await rootminster.functions.invoke('rejectRequest', { request_id: request.id, rejection_reason: rejectionReason, admin_notes: adminNotes });
      toast.success(t('reviewRequest.rejectedToast'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || t('reviewRequest.rejectFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleObserverRerun = async () => {
    setSafetyLoading(true);
    try {
      await Promise.all(requestRows.map((record) => rootminster.observer.scanRequest(record.id)));
      toast.success('Observer scan completed.');
      await onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Could not run the Observer scan.');
    } finally {
      setSafetyLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1600px] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:h-[90vh] sm:w-[calc(100vw-3rem)] lg:w-[80vw]"
        >
          <DialogHeader className="shrink-0 space-y-2 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
            <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reviewRequest.title')}</DialogTitle>
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 break-all font-mono text-lg font-semibold text-primary sm:text-xl">{hostname}</p>
              <Button type="button" variant="ghost" size="icon" aria-label="Copy hostname" onClick={() => copyText(hostname, 'Hostname copied.')} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
                <Copy size={14} />
              </Button>
            </div>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={conversationStatus || request.status} />
                <SafetyBadge verdict={observerVerdict} score={observerScore} />
                <span className="inline-flex items-center gap-1"><Network size={12} /> {t('reviewRequest.dnsRecords', { count: records.length })}</span>
                {submittedAt && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Submitted {submittedAt}</span>}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div ref={scrollRef} onScroll={evaluateReviewGate} className="min-h-0 flex-1 overflow-y-auto review-modal-scroll" style={{ scrollbarGutter: 'stable' }}>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0 space-y-4">
                <ColumnHeading>Request Details</ColumnHeading>

                <ReviewSection icon={UserRound} title={t('reviewRequest.info')}>
                  <dl className="grid gap-3 p-4 sm:grid-cols-2">
                    <Field label={t('reviewRequest.requestedBy')}>
                      <p className="break-all text-sm font-medium text-foreground">{requesterName || request.requester_email}</p>
                      {requesterName && <p className="mt-0.5 break-all text-xs text-muted-foreground">{request.requester_email}</p>}
                    </Field>
                    <Field label="Submitted">
                      <p className="text-sm text-foreground">{submittedAt || '—'}</p>
                    </Field>
                  </dl>
                </ReviewSection>

                <ReviewSection icon={Network} title={t('reviewRequest.dnsRecords', { count: records.length })}>
                  <ul className="divide-y divide-border">
                    {records.map((r, i) => (
                      <li key={r.id || i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
                        <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-center font-mono text-xs font-medium text-foreground">{r.record_type}</span>
                        <div className="min-w-0">
                          <p className="break-all font-mono text-sm text-foreground">{r.record_value}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{r.proxied ? t('reviewRequest.ttlProxied', { ttl: r.ttl }) : t('reviewRequest.ttlNotProxied', { ttl: r.ttl })}</p>
                        </div>
                        <div className="col-start-2 sm:col-start-auto sm:justify-self-end"><StatusBadge status={r.status} /></div>
                      </li>
                    ))}
                  </ul>
                </ReviewSection>

                {(request.reason || request.preview_link) && (
                  <ReviewSection icon={FileText} title={t('reviewRequest.projectDescription')}>
                    <div className="space-y-4 p-4">
                      {request.reason ? (
                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">{request.reason}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No project description was provided.</p>
                      )}
                      {request.preview_link && (
                        <div className="rounded-md border border-border bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">{t('reviewRequest.previewLink')}</p>
                          <a href={previewUrl} onClick={(e) => { e.preventDefault(); openExternal(previewUrl); }}
                            className="mt-1 block cursor-pointer break-all text-sm text-primary underline hover:opacity-80">
                            {request.preview_link}
                          </a>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openExternal(previewUrl)} className="gap-1.5">
                              <ExternalLink size={13} /> Open Preview
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => copyText(request.preview_link, t('reviewRequest.linkCopied'))} className="gap-1.5">
                              <Copy size={13} /> {t('reviewRequest.copyLink')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </ReviewSection>
                )}

                {threatMatches.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground"><ShieldAlert size={15} className="text-destructive" /> Threat Intelligence Match</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {threatMatches.map((match, index) => <li key={`${match.source}-${match.indicator}-${index}`} className="break-words">{match.detail}</li>)}
                    </ul>
                    <p className="mt-2 text-muted-foreground">This request was kept out of instant approval. Feeds can be wrong, so check the target yourself before deciding.</p>
                  </div>
                )}

                <ReviewSection icon={ShieldAlert} title="Observer Automated Screening" aside={<SafetyBadge verdict={observerVerdict} score={observerScore} />}>
                  <div className="space-y-4 p-4">
                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Observer Status</p><p className="mt-1 font-semibold capitalize text-foreground">{observerStatus}</p></div>
                      <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Severity</p><p className="mt-1 font-mono capitalize text-foreground">{observerSeverity || '—'}</p></div>
                      <div className="rounded-md bg-muted/60 p-2.5"><p className="text-muted-foreground">Findings</p><p className="mt-1 text-foreground">{observerFindingCount} · {observerScore}/100</p></div>
                    </div>
                    <p className="text-xs text-muted-foreground">Observer is triggered automatically for every new request. Flagged requests list the matched policy/category below, with screenshot evidence when Observer provides it.</p>
                    {observerFindings.length > 0 ? (
                      <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-xs font-medium text-foreground">Flagged Against</p>
                        {observerFindings.map((finding) => (
                          <div key={finding.id || `${finding.finding_type}-${finding.observed_at}`} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-foreground">{finding.policy_section || finding.finding_type || 'Observer Policy Finding'}</p>
                              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-amber-700 dark:text-amber-300">{finding.severity || 'unknown'} · {Number(finding.score) || 0}</span>
                            </div>
                            {finding.evidence && <p className="mt-2 whitespace-pre-line break-words leading-relaxed text-muted-foreground">{readableEvidence(finding.evidence)}</p>}
                            {finding.screenshot_url && (
                              <button type="button" onClick={() => openExternal(finding.screenshot_url)} className="mt-2 text-primary underline hover:opacity-80">
                                Open Observer Screenshot
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">No active Observer findings are attached to this request.</p>
                    )}
                    <div className="border-t border-border pt-4">
                      <Button type="button" size="sm" variant="outline" disabled={safetyLoading} onClick={handleObserverRerun} className="gap-2">
                        {safetyLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-Run Observer Scan
                      </Button>
                    </div>
                  </div>
                </ReviewSection>
              </div>

              <div className="min-w-0 space-y-4">
                <ColumnHeading>Discussion and Decision</ColumnHeading>

                <InstantApprovalPanel request={request} onChanged={async () => { await onSuccess?.(); onClose(); }} />

                <ConversationThread
                  requestId={request.id}
                  requestType="subdomain"
                  currentUser={currentUser}
                  onStatusChange={setConversationStatus}
                />

                <ReviewSection
                  icon={StickyNote}
                  title={t('reviewRequest.adminNotes')}
                  aside={(
                    <div className="relative group">
                      <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                      <div className="absolute right-0 top-full z-50 mt-2 hidden w-52 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-soft group-hover:block">
                        {t('reviewRequest.adminNotesHelp')}
                      </div>
                    </div>
                  )}
                  className="overflow-visible"
                >
                  <div className="p-4">
                    <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                      placeholder={t('reviewRequest.adminNotesPlaceholder')}
                      className="h-20 resize-none text-sm" />
                  </div>
                </ReviewSection>

                {action === 'reject' && (
                  <ReviewSection icon={XCircle} title={t('reviewRequest.rejectionReason')} className="border-destructive/40">
                    <div className="space-y-2 p-4">
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
                      <Textarea autoFocus value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                        aria-label="Rejection reason"
                        placeholder={t('reviewRequest.rejectionPlaceholder')}
                        className="h-28 resize-none" />
                    </div>
                  </ReviewSection>
                )}

                {compatibilityError && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{compatibilityError} Ask the requester to submit a corrected request after this one is rejected.</p>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {pendingRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground">This request has no pending records to decide on.</p>
            ) : (
              <p className={`flex items-center gap-1.5 text-xs ${reviewGateMet ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {reviewGateMet ? <CheckCircle size={13} /> : <Lock size={13} />}
                {reviewGateMet
                  ? 'Review context read. Decisions are unlocked.'
                  : 'Scroll through the request details, Observer screening and conversation to unlock decisions.'}
              </p>
            )}
            {pendingRecords.length === 0 ? null : !action ? (
              <div className="flex gap-2 sm:shrink-0">
                <Button disabled={!reviewGateMet} onClick={() => setAction('reject')} variant="outline"
                  className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 sm:flex-none">
                  <XCircle size={16} className="mr-2" /> {t('reviewRequest.reject')}
                </Button>
                <Button disabled={!reviewGateMet || !!compatibilityError} onClick={() => setAction('approve')}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 sm:flex-none">
                  <CheckCircle size={16} className="mr-2" /> {pendingRecords.length > 1 ? t('reviewRequest.approveAll', { count: pendingRecords.length }) : t('reviewRequest.approve')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 sm:shrink-0">
                <Button variant="outline" onClick={() => setAction(null)} disabled={loading} className="flex-1 sm:flex-none">
                  {t('reviewRequest.back')}
                </Button>
                <Button
                  onClick={action === 'approve' ? handleApprove : handleReject}
                  disabled={loading || !reviewGateMet || (action === 'approve' && !!compatibilityError) || (action === 'reject' && !rejectionReason)}
                  variant={action === 'approve' ? 'default' : 'destructive'}
                  className={action === 'approve' ? 'flex-1 bg-emerald-600 text-white hover:bg-emerald-500 sm:flex-none' : 'flex-1 sm:flex-none'}
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
