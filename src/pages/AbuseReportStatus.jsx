import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, Search, Shield } from 'lucide-react';
import { PublicNav } from '@/components/PublicPageLayout';
import { rootminster } from '@/api/rootminsterClient';

const STEPS = [
  { status: 'open', label: 'Received', Icon: Clock },
  { status: 'investigating', label: 'Under investigation', Icon: Search },
  { status: 'closed', label: 'Closed', Icon: CheckCircle2 },
];

function stepIndex(report) {
  if (report.closed) return 2;
  return report.status === 'investigating' ? 1 : 0;
}

export default function AbuseReportStatus() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    rootminster.functions.invoke('getAbuseReportStatus', { token })
      .then((response) => { if (!cancelled) setReport(response.data); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.error || 'Could not load the report status.'); });
    return () => { cancelled = true; };
  }, [token]);

  const current = report ? stepIndex(report) : 0;

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Shield size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Abuse report status</h1>
            <p className="text-slate-400 text-sm">This private page shows where your report is.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-sm text-slate-300">
            <p role="alert">{error}</p>
            <Link to="/report-abuse" className="mt-3 inline-block text-emerald-300 hover:underline">Submit a new report</Link>
          </div>
        )}
        {!error && !report && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
        {report && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 space-y-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Reported site</dt><dd className="mt-0.5 break-all font-mono text-white">{report.subdomain}</dd></div>
              <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-0.5 text-white">{report.abuse_type}</dd></div>
              {report.submitted_at && <div><dt className="text-xs text-slate-500">Submitted</dt><dd className="mt-0.5 text-white">{new Date(report.submitted_at).toLocaleString()}</dd></div>}
              {report.updated_at && <div><dt className="text-xs text-slate-500">Last update</dt><dd className="mt-0.5 text-white">{new Date(report.updated_at).toLocaleString()}</dd></div>}
            </dl>
            <ol className="space-y-3" aria-label="Report progress">
              {STEPS.map((step, index) => {
                const done = index <= current;
                const { Icon } = step;
                return (
                  <li key={step.status} className={`flex items-center gap-3 text-sm ${done ? 'text-white' : 'text-slate-500'}`} aria-current={index === current ? 'step' : undefined}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-slate-700'}`}><Icon size={14} /></span>
                    {index === 2 && report.closed ? report.status_label : step.label}
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-slate-500">For privacy, this page shows the status only. We cannot share details of any action taken against another user.</p>
          </div>
        )}
      </main>
    </div>
  );
}
