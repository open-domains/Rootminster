import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import ProxyToggle from './ProxyToggle';
import { PROXYABLE_TYPES, TTL_OPTIONS, ttlLabel, validateContent, checkConflict } from './dnsConfig';
import { cn } from '@/lib/utils';
import { Check, X, MoreHorizontal, Pencil, Copy, Trash2, Loader2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function DnsRecordRow({
  record, subdomainName, cols, existingRecords,
  selected, onToggleSelect,
  editing, onEnterEdit, onExitEdit, saving, onSaveChange,
  onToggleProxy, onCopy, onDuplicate, onDelete,
}) {
  const [draft, setDraft] = useState(null);
  const contentRef = useRef(null);
  const isNested = record.name !== subdomainName;
  const canProxy = PROXYABLE_TYPES.includes(record.record_type);

  useEffect(() => {
    if (editing) {
      setDraft({ content: record.content || '', proxied: !!record.proxied, ttl: record.ttl || 3600 });
      setTimeout(() => contentRef.current?.focus(), 30);
    } else {
      setDraft(null);
    }
  }, [editing]);  

  const validation = draft ? validateContent(record.record_type, draft.content) : null;
  const conflict = (editing && draft && validation?.valid && draft.content !== record.content)
    ? checkConflict(record.name, record.record_type, draft.content, existingRecords, record.id)
    : { conflict: false, message: null };
  const canSave = validation?.valid && !conflict.conflict;

  const handleSave = () => {
    if (!canSave) return;
    const changes = {};
    if (draft.content !== record.content) changes.content = draft.content;
    if (canProxy && draft.proxied !== record.proxied) changes.proxied = draft.proxied;
    if (draft.ttl !== record.ttl) changes.ttl = draft.ttl;
    if (Object.keys(changes).length === 0) { onExitEdit(); return; }
    onSaveChange(record, changes);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { e.preventDefault(); onExitEdit(); }
  };

  return (
    <tr
      className={cn(
        'border-b border-border/40 last:border-0 transition-colors group',
        editing ? 'bg-primary/5' : selected ? 'bg-primary/5' : 'hover:bg-muted/40'
      )}
    >
      {/* Checkbox (sticky) */}
      <td className="sticky left-0 z-10 bg-card w-11 px-2 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded border-input accent-primary cursor-pointer"
        />
      </td>

      {/* Name (sticky) */}
      <td className="sticky left-11 z-10 min-w-[130px] max-w-[170px] bg-card pr-3 pl-1 sm:min-w-[160px] sm:max-w-[220px]">
        {isNested ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground/50 text-xs">↳</span>
            <span className="font-mono text-xs text-foreground truncate">{record.name}</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-foreground truncate block">{record.name}</span>
        )}
      </td>

      {/* Type */}
      {cols.type && (
        <td className="px-3">
          <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{record.record_type}</span>
        </td>
      )}

      {/* Content */}
      {cols.content && (
        <td className="px-3 min-w-[200px]">
          {editing && draft ? (
            <div className="min-w-[180px]">
              <Input
                ref={contentRef}
                value={draft.content}
                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                onKeyDown={onKeyDown}
                className={cn('h-8 text-xs font-mono', validation && !validation.valid && 'border-destructive focus-visible:ring-destructive')}
              />
              {validation && !validation.valid && <p className="text-[10px] text-destructive mt-0.5">{validation.error}</p>}
              {conflict.conflict && <p className="text-[10px] text-accent mt-0.5">{conflict.message}</p>}
            </div>
          ) : (
            <span className="font-mono text-xs text-foreground truncate block max-w-[280px]">{record.content}</span>
          )}
        </td>
      )}

      {/* Proxy */}
      {cols.proxy && (
        <td className="px-3">
          {editing && draft
            ? (canProxy
                ? <ProxyToggle proxied={draft.proxied} onChange={() => setDraft(d => ({ ...d, proxied: !d.proxied }))} />
                : <span className="text-muted-foreground/50 text-xs">—</span>)
            : (canProxy
                ? <ProxyToggle proxied={record.proxied} onChange={() => onToggleProxy(record)} saving={saving} />
                : <span className="text-muted-foreground/50 text-xs">—</span>)}
        </td>
      )}

      {/* TTL */}
      {cols.ttl && (
        <td className="px-3">
          {editing && draft ? (
            <Select value={String(draft.ttl)} onValueChange={v => setDraft(d => ({ ...d, ttl: Number(v) }))}>
              <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map(o => <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground text-xs tabular-nums">{ttlLabel(record.ttl)}</span>
          )}
        </td>
      )}

      {/* Status */}
      {cols.status && (
        <td className="px-3"><StatusBadge status={record.status} /></td>
      )}

      {/* Actions */}
      <td className="px-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="inline-flex items-center gap-1">
            <Button size="icon" className="h-7 w-7" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onExitEdit}>
              <X size={13} />
            </Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEnterEdit(record.id)} title="Edit">
              <Pencil size={13} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="More">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onCopy(record)} className="text-xs cursor-pointer gap-2"><Copy size={13} /> Copy content</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(record)} className="text-xs cursor-pointer gap-2"><Pencil size={13} /> Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(record)} className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"><Trash2 size={13} /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </td>
    </tr>
  );
}