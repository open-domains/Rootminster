import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2, Info, Globe2, Server, Link2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import AvailabilityBadge from './AvailabilityBadge';
import {
  RECORD_TYPES_BASE, RECORD_TYPES_NS_UNLOCKED, PROXIABLE_TYPES, MULTI_VALUE_TYPES,
  validateSubdomainLabel, validateRecordValue, getRecordValuePlaceholder, getRecordTypeHint
} from './dnsValidation';
import { usePublicConfig } from '@/lib/public-config';

const DEFAULT_ROW = () => ({ record_type: 'A', record_value: '', ttl: 3600, proxied: false });

export default function RequestModal({ open, onClose, onSuccess }) {
  const { t } = useTranslation();
  const { config } = usePublicConfig();
  const nsRequiresDonation = config.features.nsRequiresDonation;
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nsUnlocked, setNsUnlocked] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [rootDomain, setRootDomain] = useState('');
  const [rows, setRows] = useState([DEFAULT_ROW()]);
  const [reason, setReason] = useState('');
  const [previewLink, setPreviewLink] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      rootminster.entities.Domain.filter({ allow_new_requests: true }).then(setDomains).catch(() => {});
      rootminster.auth.me().then(u => setNsUnlocked(!nsRequiresDonation || !!u?.ns_unlocked)).catch(() => {});
      if (!siteKey) {
        rootminster.functions.invoke('getRecaptchaSiteKey', {}).then(res => setSiteKey(res.data?.site_key || '')).catch(() => {});
      }
    } else {
      reset();
    }
  }, [open, nsRequiresDonation]);

  useEffect(() => {
    if (!open || !siteKey) return;
    widgetIdRef.current = null;
    const tryRender = () => {
      if (window.turnstile && turnstileRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: token => setRecaptchaToken(token),
          'expired-callback': () => setRecaptchaToken(''),
          theme: 'dark',
        });
      }
    };
    const interval = setInterval(() => {
      if (window.turnstile) { tryRender(); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [open, siteKey]);

  const reset = () => {
    setSubdomain('');
    setRootDomain('');
    setRows([DEFAULT_ROW()]);
    setReason('');
    setPreviewLink('');
    setAvailability(null);
    setRecaptchaToken('');
    if (widgetIdRef.current !== null && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    widgetIdRef.current = null;
  };

  const RECORD_TYPES = nsUnlocked ? RECORD_TYPES_NS_UNLOCKED : RECORD_TYPES_BASE;

  const checkAvailability = useCallback((sub, domain) => {
    if (!sub || !domain) { setAvailability(null); return; }
    const formatError = validateSubdomainLabel(sub);
    if (formatError) {
      setAvailability({ status: 'invalid', message: formatError });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCheckingAvail(true);
    setAvailability({ status: 'checking', message: t('requestModal.checkingAvailability') });
    debounceRef.current = setTimeout(async () => {
      try {
        const [res, existing] = await Promise.all([
          rootminster.functions.invoke('checkAvailability', { subdomain: sub, root_domain: domain }),
          rootminster.entities.SubdomainRequest.filter({ subdomain: sub, root_domain: domain })
        ]);
        const activeDupe = existing.find(r => ['pending', 'needs_info'].includes(r.status));
        if (activeDupe) {
          setAvailability({ status: 'pending', message: t('requestModal.alreadyPending', { status: activeDupe.status }) });
        } else {
          setAvailability({ status: res.data.status, message: res.data.message });
        }
      } catch {
        setAvailability(null);
      } finally {
        setCheckingAvail(false);
      }
    }, 500);
  }, [t]);

  const handleSubdomainChange = val => {
    const clean = val.toLowerCase().replace(/[^a-z0-9\-_\.~]/g, '');
    setSubdomain(clean);
    checkAvailability(clean, rootDomain);
  };

  const handleDomainChange = val => {
    setRootDomain(val);
    checkAvailability(subdomain, val);
  };

  const setRow = (i, k, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows(rs => [...rs, DEFAULT_ROW()]);
  const removeRow = i => setRows(rs => rs.filter((_, idx) => idx !== i));
  const getRowError = row => validateRecordValue(row.record_type, row.record_value);

  const hasCname = rows.some(r => r.record_type === 'CNAME');
  const hasOtherWithCname = hasCname && rows.length > 1;
  const canSubmit = !hasOtherWithCname && availability?.status === 'available' && subdomain && rootDomain &&
    rows.every(r => !getRowError(r)) && reason.trim().length > 0 && previewLink.trim().length > 0 && !!recaptchaToken;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const existing = await rootminster.entities.SubdomainRequest.filter({ subdomain, root_domain: rootDomain });
      const duplicate = existing.find(r => ['pending', 'needs_info'].includes(r.status));
      if (duplicate) {
        toast.error(t('requestModal.duplicateError', { subdomain, rootDomain, status: duplicate.status }));
        setLoading(false);
        return;
      }

      await rootminster.functions.invoke('submitRequest', {
        subdomain,
        root_domain: rootDomain,
        reason,
        preview_link: previewLink.trim(),
        recaptcha_token: recaptchaToken,
        records: rows.map(row => ({
          record_type: row.record_type,
          record_value: row.record_value,
          ttl: row.ttl,
          proxied: row.proxied,
        })),
      });

      toast.success(rows.length > 1 ? t('requestModal.submitSuccessMulti', { count: rows.length }) : t('requestModal.submitSuccess'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const activeType = rows[0]?.record_type;
  const fqdn = subdomain && rootDomain ? `${subdomain}.${rootDomain}` : 'your-name.example';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] overflow-hidden p-0" style={{ width: 'min(96vw, 64rem)' }}>
        <div className="flex max-h-[92vh] flex-col">
          <div className="border-b border-border px-6 py-5">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4 pr-8">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">New domain request</p>
                  <DialogTitle className="text-xl">Claim an Open Domains address</DialogTitle>
                  <p className="mt-1.5 text-sm text-muted-foreground">Choose your name, configure the first DNS record, and tell us what you’re building.</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="overflow-y-auto review-modal-scroll px-6 py-5">
              <div className="space-y-7">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"><Globe2 size={14} /></span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">1. Choose your domain</h3>
                      <p className="text-xs text-muted-foreground">Pick the hostname you want to register.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subdomain</Label>
                      <Input value={subdomain} onChange={e => handleSubdomainChange(e.target.value)} placeholder="myproject" required className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Root domain</Label>
                      <Select value={rootDomain} onValueChange={handleDomainChange}>
                        <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                        <SelectContent>
                          {domains.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Requested address</p>
                    <p className="mt-1 font-mono text-sm font-medium text-foreground">{fqdn}</p>
                  </div>

                  {availability && <div className="mt-3"><AvailabilityBadge status={availability.status} message={availability.message} /></div>}
                </section>

                <section className="border-t border-border pt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"><Server size={14} /></span>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">2. Configure DNS</h3>
                        <p className="text-xs text-muted-foreground">Set where the domain should point when approved.</p>
                      </div>
                    </div>
                    {MULTI_VALUE_TYPES.includes(activeType) && !hasCname && (
                      <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80">
                        <Plus size={12} /> Add value
                      </button>
                    )}
                  </div>

                  {hasOtherWithCname && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t('requestModal.cnameWarning')}
                    </div>
                  )}

                  {!nsUnlocked && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                      <Info size={13} className="mt-0.5 shrink-0" />
                      <span>{t('requestModal.nsLocked')} <a href="/settings" className="underline">{t('requestModal.nsLockedLink')}</a></span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {rows.map((row, i) => {
                      const rowError = row.record_value ? getRowError(row) : null;
                      const hint = getRecordTypeHint(row.record_type, nsRequiresDonation);
                      return (
                        <div key={i} className="rounded-lg border border-border bg-card p-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_minmax(0,1fr)_110px]">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <Select value={row.record_type} onValueChange={v => { setRow(i, 'record_type', v); setRow(i, 'proxied', false); }}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{RECORD_TYPES.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Target / value</Label>
                              <Input value={row.record_value} onChange={e => setRow(i, 'record_value', e.target.value)} placeholder={getRecordValuePlaceholder(row.record_type)} className={`h-9 font-mono text-xs ${rowError ? 'border-destructive/50' : ''}`} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">TTL</Label>
                              <Input type="number" value={row.ttl} onChange={e => setRow(i, 'ttl', parseInt(e.target.value) || 3600)} className="h-9 text-xs" />
                            </div>
                          </div>

                          {(rowError || hint) && <p className={`mt-2 text-xs ${rowError ? 'text-destructive' : 'text-muted-foreground'}`}>{rowError || hint}</p>}

                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                            {PROXIABLE_TYPES.includes(row.record_type) ? (
                              <div className="flex items-center gap-2">
                                <Switch checked={row.proxied} onCheckedChange={v => setRow(i, 'proxied', v)} />
                                <div>
                                  <p className="text-xs font-medium text-foreground">Cloudflare proxy</p>
                                  <p className="text-[11px] text-muted-foreground">Route supported traffic through Cloudflare.</p>
                                </div>
                              </div>
                            ) : <span />}
                            {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="inline-flex items-center gap-1 text-xs text-destructive hover:opacity-80"><Trash2 size={12} /> Remove</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="border-t border-border pt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"><Link2 size={14} /></span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">3. Tell us about the project</h3>
                      <p className="text-xs text-muted-foreground">This helps reviewers understand how the domain will be used.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Project description</Label>
                      <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('requestModal.projectDescriptionPlaceholder')} className="min-h-[96px] resize-none" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Preview link</Label>
                      <Input value={previewLink} onChange={e => setPreviewLink(e.target.value)} placeholder={t('requestModal.previewLinkPlaceholder')} required />
                    </div>
                  </div>
                </section>

                <section className="border-t border-border pt-6">
                  <div className="flex justify-center"><div ref={turnstileRef} /></div>
                </section>
              </div>
            </div>

            <aside className="border-t border-border bg-muted/15 px-5 py-5 lg:border-l lg:border-t-0">
              <div className="sticky top-0 space-y-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Request summary</p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold text-foreground">{fqdn}</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Availability</span>
                    <span className={`font-medium ${availability?.status === 'available' ? 'text-emerald-400' : 'text-muted-foreground'}`}>{checkingAvail ? 'Checking…' : availability?.status === 'available' ? 'Available' : availability?.status || 'Not checked'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">DNS records</span>
                    <span className="font-medium text-foreground">{rows.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Project details</span>
                    <span className={reason.trim() && previewLink.trim() ? 'text-emerald-400' : 'text-muted-foreground'}>{reason.trim() && previewLink.trim() ? 'Complete' : 'Incomplete'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Verification</span>
                    <span className={recaptchaToken ? 'text-emerald-400' : 'text-muted-foreground'}>{recaptchaToken ? 'Complete' : 'Required'}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card px-3 py-3 text-xs text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 text-foreground"><ShieldCheck size={13} /> <span className="font-medium">Reviewed before activation</span></div>
                  Requests are checked before DNS is created. You can follow the review status from My Requests.
                </div>

                <div className="border-t border-border pt-4">
                  {canSubmit ? (
                    <div className="mb-3 flex items-center gap-2 text-xs text-emerald-400"><CheckCircle2 size={13} /> Ready to submit</div>
                  ) : (
                    <div className="mb-3 text-xs text-muted-foreground">Complete the required fields to submit.</div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={loading || !canSubmit}>
                      {loading ? <><Loader2 size={14} className="mr-2 animate-spin" />Submitting</> : 'Submit request'}
                    </Button>
                  </div>
                </div>
              </div>
            </aside>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
