import { cn } from '@/lib/utils';

export default function StatsCard({ title, value, icon: Icon, color = 'indigo', subtitle, trend }) {
  const colors = {
    indigo: 'text-primary bg-primary/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    purple: 'text-violet-400 bg-violet-500/10',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value ?? '—'}</p>
          {subtitle && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={cn('text-xs mt-1 font-medium', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} this week
            </p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colors[color])}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}