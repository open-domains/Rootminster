import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, CircleHelp, Info, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';

const icons = { pass: CheckCircle2, warning: AlertTriangle, unknown: CircleHelp, info: Info };
const labels = { pass: 'Passed', warning: 'Needs attention', unknown: 'Incomplete', info: 'Review details' };
export default function DomainHealthPanel({ name, revision }) {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setReport(null);
    setError('');
    setLoading(false);
    return () => { generation.current += 1; };
  }, [name, revision]);
  const run = async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const response = await rootminster.functions.invoke('checkDomainHealth', { name });
      if (current === generation.current) setReport(response.data);
    } catch (err) {
      if (current === generation.current) setError(err.message || t('health.failed'));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  return (
    <section aria-labelledby="domain-health-title" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="domain-health-title" className="flex items-center gap-2 text-base font-semibold"><Activity size={18} aria-hidden="true" />{t('health.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('health.description')}</p>
        </div>
        <Button variant="outline" onClick={run} disabled={loading} className="min-h-11 shrink-0 gap-2">
          {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {t(loading ? 'health.checking' : report ? 'health.runAgain' : 'health.run')}
        </Button>
      </div>
      <p className="sr-only" role="status">{loading ? t('health.checking') : report ? t('health.completed', { status: t(`health.status.${report.status}`) }) : ''}</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error} {t('health.retry')}</p>}
      {report && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-sm">
            <strong>{t(`health.status.${report.status}`)}</strong>
            <span className="text-xs text-muted-foreground">{t('health.checkedAt', { time: new Date(report.checked_at).toLocaleTimeString() })}</span>
          </div>
          <ul className="divide-y divide-border">
            {report.checks.map(check => {
              const Icon = icons[check.status] || Info;
              return <li key={check.id} className="flex items-start gap-3 py-4">
                <Icon size={18} className="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{t(`health.status.${check.status}`, { defaultValue: labels[check.status] })}{check.name && <> · <span className="break-all font-mono">{check.name} {check.record_type}</span></>}</p>
                  <h3 className="mt-1 text-sm font-semibold">{check.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>
                  {check.action && <p className="mt-2 text-sm"><span className="font-medium">{t('health.nextStep')} </span>{check.action}</p>}
                </div>
              </li>;
            })}
          </ul>
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{t('health.scope', { count: report.checked_records, total: report.total_records })}</p>
        </div>
      )}
    </section>
  );
}
