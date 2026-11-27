import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Geometry: the panel uses the 12px container radius (rounded-xl) and the list
// is inset by 6px (p-1.5), so rows take the 6px control radius (rounded-md) and
// stay concentric with the panel. The header uses the same 14px horizontal
// inset as the rows (6px list padding + 8px row padding) so icons line up.

function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-[10px] font-medium leading-none text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default function CommandPalette({ open, onClose, items }) {
  const navigate = useNavigate();
  const listId = useId();
  const listRef = useRef(null);
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
        if (it) { onClose(); navigate(it.to); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose, navigate]);

  // Keep the keyboard selection visible while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  if (!open) return null;

  const activeId = filtered[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search pages and actions"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-raised"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3.5">
          <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0); }}
            placeholder="Search pages and actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="review-modal-scroll max-h-[min(20rem,55vh)] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No Results</p>
              <p className="text-xs text-muted-foreground">Try a different search term.</p>
            </div>
          ) : filtered.map((it, i) => {
            const isActive = i === active;
            return (
              <Link
                key={it.to}
                id={`${listId}-${i}`}
                to={it.to}
                role="option"
                aria-selected={isActive}
                data-index={i}
                tabIndex={-1}
                onClick={onClose}
                onMouseMove={() => { if (!isActive) setActive(i); }}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-foreground'
                )}
              >
                {it.icon
                  ? <it.icon size={16} className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  : <span className="w-4 shrink-0" aria-hidden="true" />}
                <span className="flex-1 truncate font-medium">{it.label}</span>
                {it.group && <span className="shrink-0 text-xs text-muted-foreground">{it.group}</span>}
                <CornerDownLeft
                  size={14}
                  aria-hidden="true"
                  className={cn('shrink-0 text-muted-foreground transition-opacity', isActive ? 'opacity-100' : 'opacity-0')}
                />
              </Link>
            );
          })}
        </div>

        <div className="hidden h-10 shrink-0 items-center gap-4 border-t border-border px-3.5 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd><ArrowUp size={11} aria-hidden="true" /></Kbd>
            <Kbd><ArrowDown size={11} aria-hidden="true" /></Kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd><CornerDownLeft size={11} aria-hidden="true" /></Kbd>
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
