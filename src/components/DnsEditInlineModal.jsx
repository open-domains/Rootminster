import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';

const PROXYABLE_TYPES = ['A', 'AAAA', 'CNAME'];
const BASE_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];

export default function DnsEditInlineModal({ open, onClose, record, siblingRecords = [], applyChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [nsUnlocked, setNsUnlocked] = useState(false);
  const [tab, setTab] = useState('edit');
  const [form, setForm] = useState({ new_content: '', new_proxied: false, new_ttl: 3600, new_type: '', new_value_for_type: '' });

  useEffect(() => {
    if (open && record) {
      setForm({
        new_content: record.content || '',
        new_proxied: record.proxied || false,
        new_ttl: record.ttl || 3600,
        new_type: '',
        new_value_for_type: '',
      });
      setTab('edit');
      rootminster.auth.me().then(u => setNsUnlocked(!!u?.ns_unlocked)).catch(() => {});
    }
  }, [open, record]);

  if (!record) return null;

  const RECORD_TYPES = nsUnlocked ? [...BASE_RECORD_TYPES, 'NS'] : BASE_RECORD_TYPES;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canProxy = PROXYABLE_TYPES.includes(record.record_type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const me = await rootminster.auth.me();
      const base = { requester_email: me.email, subdomain_name: record.name, root_domain: record.zone_name };

      if (tab === 'delete') {
        await applyChange({ ...base, dns_record_id: record.id, change_type: 'delete_record', old_content: record.content });
        toast.success('Record deleted');
      } else {
        const changes = [];
        if (form.new_content !== record.content) changes.push('content');
        if (canProxy && form.new_proxied !== record.proxied) changes.push('proxied');
        if (form.new_ttl !== record.ttl) changes.push('ttl');

        if (changes.length === 0) { toast.info('No changes made'); onClose(); return; }

        for (const change of changes) {
          if (change === 'content') {
            await applyChange({ ...base, dns_record_id: record.id, change_type: 'update_content', old_content: record.content, new_content: form.new_content });
          } else if (change === 'proxied') {
            await applyChange({ ...base, dns_record_id: record.id, change_type: 'change_proxied', old_proxied: record.proxied, new_proxied: form.new_proxied });
          } else if (change === 'ttl') {
            await applyChange({ ...base, dns_record_id: record.id, change_type: 'change_ttl', old_ttl: record.ttl, new_ttl: form.new_ttl });
          }
        }
        toast.success('Record updated');
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to apply change');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit DNS Record</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 mb-2">
          <p className="text-muted-foreground text-xs">Editing</p>
          <p className="text-primary font-mono font-medium">{record.name}</p>
          <p className="text-muted-foreground text-xs">{record.record_type} → {record.content}</p>
        </div>

        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setTab('edit')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${tab === 'edit' ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            Edit
          </button>
          <button type="button" onClick={() => setTab('delete')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${tab === 'delete' ? 'bg-destructive border-destructive text-destructive-foreground' : 'border-border text-muted-foreground hover:text-destructive'}`}>
            <Trash2 size={11} /> Delete
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'edit' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Content</Label>
                <Input value={form.new_content} onChange={e => set('new_content', e.target.value)} />
              </div>

              {canProxy && (
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <span className="text-foreground text-sm">Cloudflare Proxy</span>
                  <Switch checked={form.new_proxied} onCheckedChange={v => set('new_proxied', v)} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">TTL (seconds)</Label>
                <Input type="number" value={form.new_ttl} onChange={e => set('new_ttl', parseInt(e.target.value))} />
              </div>
            </>
          )}

          {tab === 'delete' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-destructive text-sm font-medium">⚠ Delete Record</p>
              <p className="text-destructive/80 text-xs mt-1">This will permanently remove <span className="font-mono">{record.record_type} {record.content}</span> from DNS.</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading}
              variant={tab === 'delete' ? 'destructive' : 'default'} className="flex-1">
              {loading && <Loader2 size={14} className="mr-1 animate-spin" />}
              {tab === 'delete' ? 'Delete Record' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}