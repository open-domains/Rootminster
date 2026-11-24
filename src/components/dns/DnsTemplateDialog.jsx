import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle, Cloud, Server, BadgeCheck, Loader2, Sparkles, Mail, Clock, RefreshCw } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { DNS_TEMPLATES, summariseTemplateHealth, templateById, templateFieldValue } from '@/lib/dns-templates';
import Github from '@/components/GithubIcon';
import { checkConflict, validateAddName, validateContent } from './dnsConfig';

const camelize = (id) => id.replace(/-(.)/g, (_, c) => c.toUpperCase());
const ICONS = { github: Github, cloud: Cloud, server: Server, badge: BadgeCheck, mail: Mail };
const STATUS_ICONS = { pass: CheckCircle2, warning: AlertTriangle, unknown: Clock, pending: Clock };
const STATUS_TONE = { pass: 'text-emerald-400', warning: 'text-accent', unknown: 'text-muted-foreground', pending: 'text-muted-foreground' };

export default function DnsTemplateDialog({ open, onClose, baseName, existingRecords, onApply, applying }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('github-pages');
  const [values, setValues] = useState({});
  // After a template is applied the dialog switches to a "check it worked" step.
  const [applied, setApplied] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [health, setHealth] = useState(null);
  const checkTimer = useRef(null);
  const selected = templateById(selectedId);
  const tplKey = camelize(selected.id);
  const fieldValue = selected.field ? (values[selected.field.key] || '').trim() : '';
  const readyForBuild = !selected.field || !!fieldValue;

  const preview = useMemo(() => {
    if (!readyForBuild) return [];
    const built = selected.build(values, baseName);
    return built.map(record => {
      const nameValidation = validateAddName(record.name, baseName);
      const contentValidation = validateContent(record.type, record.value);
      const conflict = nameValidation.valid && contentValidation.valid
        ? checkConflict(nameValidation.full, record.type, record.value, existingRecords)
        : { conflict: false, message: null };
      return { ...record, nameValidation, contentValidation, conflict };
    });
  }, [selected, values, readyForBuild, baseName, existingRecords]);

  const invalid = preview.some(r => !r.nameValidation.valid || !r.contentValidation.valid || r.conflict.conflict);
  const canApply = preview.length > 0 && !invalid && !applying;

  const selectTemplate = (id) => {
    setSelectedId(id);
    setValues({});
  };

  useEffect(() => () => clearTimeout(checkTimer.current), []);
  useEffect(() => {
    if (open) return;
    clearTimeout(checkTimer.current);
    setApplied(null);
    setHealth(null);
    setCheckError('');
    setChecking(false);
  }, [open]);

  const runCheck = async () => {
    setChecking(true);
    setCheckError('');
    try {
      const response = await rootminster.functions.invoke('checkDomainHealth', { name: baseName });
      setHealth(response.data);
    } catch (err) {
      const status = err?.response?.status || err?.status;
      setCheckError(status === 429 ? t('dnsTemplates.verify.rateLimited') : (err?.response?.data?.error || err?.message || t('dnsTemplates.verify.failed')));
    } finally {
      setChecking(false);
    }
  };

  const apply = async () => {
    if (!canApply) return;
    const records = preview.map(r => ({ name: r.name, type: r.type, value: r.value }));
    const ok = await onApply(preview.map(r => ({
      name: r.name,
      record_type: r.type,
      record_value: r.value,
      proxied: false,
      ttl: 3600,
    })));
    if (ok === false) return;
    setApplied({ templateId: selected.id, records });
    setHealth(null);
    // Cloudflare is authoritative, so new records usually answer within a few seconds.
    setChecking(true);
    checkTimer.current = setTimeout(runCheck, 5000);
  };

  const summary = applied && health ? summariseTemplateHealth(health, applied.records, baseName) : null;
  const appliedKey = applied ? camelize(applied.templateId) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl overflow-hidden rounded-lg p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base"><Sparkles size={16} /> {t('dnsTemplates.title')}</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/15 p-3 md:border-b-0 md:border-r">
            <div className="space-y-1">
              {DNS_TEMPLATES.map(template => {
                const Icon = ICONS[template.icon] || Cloud;
                const active = selectedId === template.id;
                return (
                  <button key={template.id} onClick={() => selectTemplate(template.id)} disabled={!!applied} className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{t(`dnsTemplates.${camelize(template.id)}.name`)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="max-h-[72vh] overflow-y-auto p-6 review-modal-scroll">
            {applied ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t('dnsTemplates.verify.title')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('dnsTemplates.verify.description', { name: t(`dnsTemplates.${appliedKey}.name`) })}</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card" aria-live="polite">
                  {checking && !summary ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> {t('dnsTemplates.verify.checking')}</div>
                  ) : summary ? (
                    <div className="divide-y divide-border/70">
                      {summary.rows.map(row => {
                        const Icon = STATUS_ICONS[row.status] || Clock;
                        return (
                          <div key={`${row.name}-${row.type}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_70px_minmax(0,1.4fr)] sm:items-center">
                            <p className="font-mono text-xs text-foreground">{row.name}</p>
                            <span className="w-fit rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{row.type}</span>
                            <div className={`text-[11px] ${STATUS_TONE[row.status]}`}>
                              <span className="inline-flex items-center gap-1"><Icon size={11} /> {t(`dnsTemplates.verify.status.${row.status}`)}</span>
                              {row.status !== 'pass' && row.action && <p className="mt-0.5 text-muted-foreground">{row.action}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">{checkError || t('dnsTemplates.verify.notRun')}</div>
                  )}
                </div>
                {summary && checkError && <p role="alert" className="text-xs text-destructive">{checkError}</p>}
                {summary && (
                  <div className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${summary.overall === 'pass' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-border bg-muted/20 text-muted-foreground'}`}>
                    {t(`dnsTemplates.verify.overall.${summary.overall}`)}
                  </div>
                )}
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">{t('dnsTemplates.verify.nextStep')}</p>
                  <p className="mt-1">{t(`dnsTemplates.${appliedKey}.note`)}</p>
                </div>
                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={runCheck} disabled={checking} className="gap-2">
                    {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t('dnsTemplates.verify.checkAgain')}
                  </Button>
                  <Button onClick={onClose}>{t('dnsTemplates.verify.done')}</Button>
                </div>
              </div>
            ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t(`dnsTemplates.${tplKey}.name`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(`dnsTemplates.${tplKey}.description`)}</p>
              </div>

              {selected.field && (
                <div className="max-w-md space-y-1.5">
                  <Label className="text-xs">{t(`dnsTemplates.${tplKey}.fieldLabel`)}</Label>
                  <Input
                    value={values[selected.field.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [selected.field.key]: templateFieldValue(selected, e.target.value) }))}
                    placeholder={t(`dnsTemplates.${tplKey}.fieldPlaceholder`)}
                    className="h-9 font-mono text-sm"
                  />
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">{t('dnsTemplates.recordsToCreate')}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t('dnsTemplates.recordsHint')}</p>
                </div>
                {!readyForBuild ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t('dnsTemplates.enterValue')}</div>
                ) : (
                  <div className="divide-y divide-border/70">
                    {preview.map((record, index) => {
                      const hasError = !record.nameValidation.valid || !record.contentValidation.valid || record.conflict.conflict;
                      const message = record.nameValidation.error || record.contentValidation.error || record.conflict.message;
                      return (
                        <div key={`${record.name}-${record.type}-${index}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_70px_minmax(0,1.4fr)_auto] sm:items-center">
                          <div>
                            <p className="font-mono text-xs text-foreground">{record.nameValidation.full || record.name}</p>
                          </div>
                          <span className="w-fit rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{record.type}</span>
                          <p className="break-all font-mono text-xs text-muted-foreground">{record.value}</p>
                          {hasError
                            ? <span className="inline-flex items-center gap-1 text-[11px] text-accent"><AlertTriangle size={11} /> {message}</span>
                            : <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={11} /> {t('dnsTemplates.ready')}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t(`dnsTemplates.${tplKey}.note`)}
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={onClose} disabled={applying}>{t('dnsTemplates.cancel')}</Button>
                <Button onClick={apply} disabled={!canApply} className="gap-2">
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {applying ? t('dnsTemplates.applying') : (preview.length === 1 ? t('dnsTemplates.applyOne', { count: preview.length }) : t('dnsTemplates.applyOther', { count: preview.length }))}
                </Button>
              </div>
            </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}