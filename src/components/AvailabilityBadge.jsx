import { CheckCircle, XCircle, Clock, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONFIG = {
  available:  { icon: CheckCircle,  color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/30' },
  taken:      { icon: XCircle,       color: 'text-destructive',  bg: 'bg-destructive/10 border-destructive/30' },
  pending:    { icon: Clock,         color: 'text-amber-400',    bg: 'bg-amber-500/10 border-amber-500/30' },
  reserved:   { icon: Lock,          color: 'text-violet-400',   bg: 'bg-violet-500/10 border-violet-500/30' },
  invalid:    { icon: AlertCircle,   color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  owned:      { icon: CheckCircle,   color: 'text-primary',      bg: 'bg-primary/10 border-primary/30' },
  checking:   { icon: Loader2,       color: 'text-muted-foreground', bg: 'bg-muted border-border' },
};

export default function AvailabilityBadge({ status, message, className }) {
  if (!status) return null;
  const cfg = CONFIG[status] || CONFIG.invalid;
  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs', cfg.bg, className)}>
      <Icon size={13} className={cn(cfg.color, status === 'checking' && 'animate-spin')} />
      <span className={cfg.color}>{message}</span>
    </div>
  );
}