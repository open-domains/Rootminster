import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle, Github, Cloud, Server, BadgeCheck, Loader2, Sparkles } from 'lucide-react';
import { checkConflict, validateAddName, validateContent } from './dnsConfig';

const camelize = (id) => id.replace(/-(.)/g, (_, c) => c.toUpperCase());

const TEMPLATES = [
  {
    id: 'github-pages',
    icon: Github,
    field: { key: 'username' },
    build: ({ username }) => [
      { name: '@', type: 'A', value: '185.199.108.153' },
      { name: '@', type: 'A', value: '185.199.109.153' },
      { name: '@', type: 'A', value: '185.199.110.153' },
      { name: '@', type: 'A', value: '185.199.111.153' },
      { name: 'www', type: 'CNAME', value: `${username}.github.io` },
    ],
  },
  {
    id: 'vercel',
    icon: Cloud,
    build: () => [
      { name: '@', type: 'A', value: '76.76.21.21' },
      { name: 'www', type: 'CNAME', value: 'cname.vercel-dns-0.com' },
    ],
  },
  {
    id: 'netlify',
    icon: Cloud,
    field: { key: 'site' },
    build: ({ site }) => [
      { name: '@', type: 'A', value: '75.2.60.5' },
      { name: 'www', type: 'CNAME', value: `${site}.netlify.app` },
    ],
  },
  {
    id: 'cloudflare-pages',
    icon: Cloud,
    field: { key: 'project' },
    build: ({ project }) => [
      { name: 'www', type: 'CNAME', value: `${project}.pages.dev` },
    ],
  },
  {
    id: 'minecraft',
    icon: Server,
    field: { key: 'ip' },
    build: ({ ip }) => [
      { name: 'mc', type: 'A', value: ip },
    ],
  },
  {
    id: 'verification',
    icon: BadgeCheck,
    field: { key: 'token' },
    build: ({ token }) => [
      { name: '@', type: 'TXT', value: token },
    ],
  },
];

export default function DnsTemplateDialog({ open, onClose, baseName, existingRecords, onApply, applying }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('github-pages');
  const [values, setValues] = useState({});
  const selected = TEMPLATES.find(tpl => tpl.id === selectedId) || TEMPLATES[0];
  const tplKey = camelize(selected.id);
  const fieldValue = selected.field ? (values[selected.field.key] || '').trim() : '';
  const readyForBuild = !selected.field || !!fieldValue;

  const preview = useMemo(() => {
    if (!readyForBuild) return [];
    const built = selected.build(values);
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

  const apply = () => {
    if (!canApply) return;
    onApply(preview.map(r => ({
      name: r.name,
      record_type: r.type,
      record_value: r.value,
      proxied: false,
      ttl: 3600,
    })));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl overflow-hidden rounded-lg p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base"><Sparkles size={16} /> {t('dnsTemplates.title')}</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/15 p-3 md:border-b-0 md:border-r">
            <div className="space-y-1">
              {TEMPLATES.map(template => {
                const Icon = template.icon;
                const active = selectedId === template.id;
                return (
                  <button key={template.id} onClick={() => selectTemplate(template.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{t(`dnsTemplates.${camelize(template.id)}.name`)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="max-h-[72vh] overflow-y-auto p-6 review-modal-scroll">
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
                    onChange={e => setValues(v => ({ ...v, [selected.field.key]: selected.id === 'verification' ? e.target.value : e.target.value.trim().toLowerCase() }))}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}