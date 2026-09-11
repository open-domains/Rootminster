import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PasskeyManager({ onUpdated }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('My passkey');
  const [busy, setBusy] = useState(false);

  const load = async () => setItems(await rootminster.passkeys.list());
  useEffect(() => { load().catch(() => {}); }, []);

  const add = async () => {
    setBusy(true);
    try {
      const ceremony = await rootminster.passkeys.registrationOptions();
      const response = await startRegistration({ optionsJSON: ceremony.options });
      await rootminster.passkeys.verifyRegistration(ceremony.challenge_id, response, name);
      await load();
      await onUpdated?.();
      toast.success('Passkey added');
    } catch (error) {
      if (error.name !== 'NotAllowedError') toast.error(error.message || 'Could not add passkey');
    } finally { setBusy(false); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove “${item.name}”?`)) return;
    try {
      await rootminster.passkeys.remove(item.id);
      await load();
      await onUpdated?.();
      toast.success('Passkey removed');
    } catch (error) { toast.error(error.message || 'Could not remove passkey'); }
  };

  if (!window.PublicKeyCredential) return null;
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="border-b border-border px-5 py-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Fingerprint size={15} /> Passkeys</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Sign in securely with your fingerprint, face, device PIN or hardware security key.</p>
    </div>
    <div className="space-y-4 p-5">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Passkey name" />
        <Button onClick={add} disabled={busy || !name.trim()} className="gap-2">{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add passkey</Button>
      </div>
      {items.length === 0 ? <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">No passkeys registered.</p> : <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
        <Fingerprint size={17} className="text-primary" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-[11px] text-muted-foreground">Added {new Date(item.created_at).toLocaleDateString()}{item.last_used_at ? ` · Last used ${new Date(item.last_used_at).toLocaleDateString()}` : ''}</p></div>
        <Button size="icon" variant="ghost" onClick={() => remove(item)} className="text-destructive" aria-label={`Remove ${item.name}`}><Trash2 size={14} /></Button>
      </div>)}</div>}
    </div>
  </section>;
}
