import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommandPalette({ open, onClose, items }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      i.label.toLowerCase().includes(s) || (i.group || '').toLowerCase().includes(s)
    );
  }, [q, items]);

  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const it = filtered[active];
        if (it) onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-popover border border-border rounded-2xl shadow-raised overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0); }}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto review-modal-scroll py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">No results</p>
          ) : filtered.map((it, i) => (
            <Link
              key={it.to}
              to={it.to}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 mx-1.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                i === active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              )}
            >
              {it.icon ? <it.icon size={15} className="shrink-0" /> : <span className="w-[15px] shrink-0" />}
              <span className="flex-1 truncate">{it.label}</span>
              {it.group && <span className="text-[10px] text-muted-foreground shrink-0">{it.group}</span>}
              {i === active && <CornerDownLeft size={13} className="text-muted-foreground shrink-0" />}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}