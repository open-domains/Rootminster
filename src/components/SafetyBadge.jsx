import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

const META = {
  clear: { label: 'Clear', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  review: { label: 'Review', className: 'border-amber-500/25 bg-amber-500/10 text-amber-300', icon: AlertTriangle },
  high_risk: { label: 'High risk', className: 'border-red-500/25 bg-red-500/10 text-red-400', icon: ShieldAlert },
  incomplete: { label: 'Incomplete', className: 'border-slate-500/25 bg-slate-500/10 text-slate-400', icon: HelpCircle },
  disabled: { label: 'Disabled', className: 'border-slate-500/25 bg-slate-500/10 text-slate-400', icon: ShieldCheck },
};

export default function SafetyBadge({ verdict, score, overridden = false, compact = false }) {
  const meta = META[verdict] || META.incomplete;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      <Icon size={11} />
      {meta.label}{!compact && Number.isFinite(Number(score)) ? ` · ${Number(score)}` : ''}{overridden ? ' · override' : ''}
    </span>
  );
}
