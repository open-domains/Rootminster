import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, MinusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { checkConflict, validateAddName, validateContent } from './dnsConfig';

export default function DnsImportDialog({ open, onClose, baseName, importedRecords, existingRecords, availableTypes, fileName, onApply, applying }) {
  const preview = useMemo(() => {
    const simulatedRecords = [...existingRecords];
    return (importedRecords || []).map((record, index) => {
      const nameValidation = validateAddName(record.name, baseName);
      const contentValidation = validateContent(record.type, record.content);
      const typeAllowed = availableTypes.includes(record.type);
      const conflict = nameValidation.valid && contentValidation.valid
        ? checkConflict(nameValidation.full, record.type, record.content, simulatedRecords)
        : { conflict: false, message: null };
      const duplicate = conflict.message === 'Identical record already exists';
      const valid = nameValidation.valid && contentValidation.valid && typeAllowed && (!conflict.conflict || duplicate);
      if (valid && !duplicate) simulatedRecords.push({ id: `import-${index}`, name: nameValidation.full, record_type: record.type, content: record.content });
      return { ...record, nameValidation, contentValidation, typeAllowed, conflict, duplicate, valid };
    });
  }, [importedRecords, baseName, existingRecords, availableTypes]);

  const ready = preview.filter((record) => record.valid && !record.duplicate);
  const skipped = preview.filter((record) => record.duplicate);
  const blocked = preview.filter((record) => !record.valid);
  const canApply = ready.length > 0 && blocked.length === 0 && !applying;

  const apply = () => onApply(ready.map((record) => ({
    isRoot: record.nameValidation.isRoot,
    label: record.nameValidation.label,
    full: record.nameValidation.full,
    record_type: record.type,
    record_value: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    priority: record.priority,
    cname_flatten: record.cname_flatten,
  })));

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !applying && onClose()}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-3xl overflow-hidden rounded-lg p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base"><FileUp size={16} /> Import DNS backup</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{fileName}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 px-6 pt-4 text-center text-xs">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2"><strong className="block text-lg text-emerald-400">{ready.length}</strong>Ready</div>
          <div className="rounded-lg border border-border bg-muted/20 p-2"><strong className="block text-lg text-muted-foreground">{skipped.length}</strong>Already present</div>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2"><strong className="block text-lg text-destructive">{blocked.length}</strong>Blocked</div>
        </div>

        <ScrollArea className="max-h-[52vh] px-6 py-4">
          <div className="space-y-2">
            {preview.map((record, index) => {
              const error = !record.typeAllowed ? `${record.type} records are not enabled for this account`
                : !record.nameValidation.valid ? record.nameValidation.error
                : !record.contentValidation.valid ? record.contentValidation.error
                : record.conflict.conflict && !record.duplicate ? record.conflict.message : null;
              const Icon = error ? AlertTriangle : record.duplicate ? MinusCircle : CheckCircle2;
              return (
                <div key={`${record.name}-${record.type}-${index}`} className={`rounded-lg border p-3 ${error ? 'border-destructive/25 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex items-start gap-3">
                    <Icon size={15} className={`mt-0.5 shrink-0 ${error ? 'text-destructive' : record.duplicate ? 'text-muted-foreground' : 'text-emerald-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">{record.type}</span>
                        <span className="truncate font-mono text-xs text-foreground">{record.name === '@' ? baseName : `${record.name}.${baseName}`}</span>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{record.content}</p>
                      {(error || record.duplicate) && <p className={`mt-1 text-[11px] ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || 'An identical record will be skipped.'}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
            {!preview.length && <p className="py-10 text-center text-sm text-muted-foreground">This backup contains no records.</p>}
          </div>
        </ScrollArea>

        {blocked.length > 0 && <p className="mx-6 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">Fix the blocked records in the backup before importing. Nothing has been changed.</p>}

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={applying}>Cancel</Button>
          <Button onClick={apply} disabled={!canApply} className="gap-2">
            {applying ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            Import {ready.length || ''} record{ready.length === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
