import { Cloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProxyToggle({ proxied, onChange, disabled, size = 16, saving = false }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled && !saving) onChange(); }}
      disabled={disabled}
      title={proxied ? 'Proxied — click for DNS only' : 'DNS only — click to proxy'}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        proxied ? 'text-accent hover:bg-accent/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {saving ? <Loader2 size={size} className="animate-spin" /> : <Cloud size={size} className={cn(proxied && 'fill-accent')} />}
    </button>
  );
}