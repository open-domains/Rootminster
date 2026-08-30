import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ProxyToggle from './ProxyToggle';
import {
  PROXYABLE_TYPES, TTL_OPTIONS, validateAddName, validateContent,
  checkConflict, sanitizeNameInput,
} from './dnsConfig';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DnsAddRow({ form, setForm, availableTypes, baseName, existingRecords, cols, onSave, onCancel, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nameVal = validateAddName(form.name, baseName);
  const contentVal = validateContent(form.record_type, form.record_value);
  const conflict = (nameVal.valid && contentVal.valid)
    ? checkConflict(nameVal.full, form.record_type, form.record_value, existingRecords)
    : { conflict: false, message: null };
  const canSave = nameVal.valid && contentVal.valid && !conflict.conflict;
  const suffix = nameVal.isRoot ? baseName : `.${baseName}`;

  const submit = () => {
    if (!canSave) return;
    onSave({
      isRoot: nameVal.isRoot,
      label: nameVal.label,
      full: nameVal.full,
      record_type: form.record_type,
      record_value: form.record_value.trim(),
      proxied: form.proxied,
      ttl: form.ttl,
    });
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <tr className="border-b border-primary/30 bg-primary/5">
      <td />
      {/* Name (sticky) with domain suffix hint */}
      <td className="sticky left-11 z-10 bg-card pl-1 pr-3 py-2.5 min-w-[180px]">
        <div className="flex items-center gap-0.5">
          <Input
            value={form.name}
            onChange={e => set('name', sanitizeNameInput(e.target.value))}
            onKeyDown={onKey}
            placeholder="@"
            autoFocus
            className="h-8 text-xs font-mono w-20"
          />
          <span className="text-muted-foreground/50 text-xs font-mono whitespace-nowrap truncate">{suffix}</span>
        </div>
        {!nameVal.valid && form.name && <p className="text-[10px] text-destructive mt-0.5 truncate">{nameVal.error}</p>}
      </td>

      {cols.type && (
        <td className="px-3 py-2.5">
          <Select value={form.record_type} onValueChange={v => set('record_type', v)}>
            <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableTypes.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
      )}

      {cols.content && (
        <td className="px-3 py-2.5">
          <Input
            value={form.record_value}
            onChange={e => set('record_value', e.target.value)}
            onKeyDown={onKey}
            placeholder="Value / target"
            className={cn('h-8 text-xs font-mono w-48', !contentVal.valid && form.record_value && 'border-destructive focus-visible:ring-destructive')}
          />
          {!contentVal.valid && form.record_value && <p className="text-[10px] text-destructive mt-0.5">{contentVal.error}</p>}
        </td>
      )}

      {cols.proxy && (
        <td className="px-3 py-2.5">
          {PROXYABLE_TYPES.includes(form.record_type)
            ? <ProxyToggle proxied={form.proxied} onChange={() => set('proxied', !form.proxied)} />
            : <span className="text-muted-foreground/50 text-xs">—</span>}
        </td>
      )}

      {cols.ttl && (
        <td className="px-3 py-2.5">
          <Select value={String(form.ttl)} onValueChange={v => set('ttl', Number(v))}>
            <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TTL_OPTIONS.map(o => <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
      )}

      {cols.status && <td />}

      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={submit} disabled={!canSave || saving} className="h-8 px-3 gap-1.5 text-xs">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-2 text-muted-foreground hover:text-foreground"><X size={14} /></Button>
        </div>
        {conflict.conflict && <p className="text-[10px] text-accent mt-0.5 whitespace-nowrap">{conflict.message}</p>}
      </td>
    </tr>
  );
}