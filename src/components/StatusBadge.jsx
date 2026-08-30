import { cn } from '@/lib/utils';

const configs = {
  pending:           { label: 'Pending',       color: 'amber' },
  approved:          { label: 'Approved',      color: 'emerald' },
  rejected:          { label: 'Rejected',      color: 'red' },
  needs_info:        { label: 'Needs Info',    color: 'blue' },
  user_responded:    { label: 'User Responded',color: 'violet' },
  active:            { label: 'Active',        color: 'emerald' },
  inactive:          { label: 'Inactive',      color: 'slate' },
  suspended:         { label: 'Suspended',     color: 'red' },
  synced:            { label: 'Synced',        color: 'emerald' },
  failed:            { label: 'Failed',        color: 'red' },
  running:           { label: 'Running',      color: 'blue' },
  completed:         { label: 'Completed',     color: 'emerald' },
  sent:              { label: 'Sent',          color: 'emerald' },
  error:             { label: 'Error',         color: 'slate' },
};

const palette = {
  amber:   'bg-amber-500/10 text-amber-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  red:     'bg-red-500/10 text-red-400',
  blue:    'bg-primary/10 text-primary',
  violet:  'bg-violet-500/10 text-violet-400',
  slate:   'bg-muted text-muted-foreground',
};

const dot = {
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  red: 'bg-red-400',
  blue: 'bg-primary',
  violet: 'bg-violet-400',
  slate: 'bg-muted-foreground',
};

export default function StatusBadge({ status, className }) {
  const cfg = configs[status] || { label: status, color: 'slate' };
  const c = cfg.color;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', palette[c], className)}>
      <span aria-hidden className={cn('w-1.5 h-1.5 rounded-full', dot[c])} />
      {cfg.label}
    </span>
  );
}