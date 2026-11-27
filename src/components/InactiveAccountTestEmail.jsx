import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KINDS = [
  { value: 'notice', label: 'Closure Notice' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'closed', label: 'Account Closed' },
];

// Sends one sample inactivity email to an address the admin types in. Uses the
// saved settings; nothing is recorded and no account is affected.
export default function InactiveAccountTestEmail({ disabled = false }) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState('notice');
  const [sending, setSending] = useState(false);

  const send = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await rootminster.modules.sendInactiveAccountTestEmail(email.trim(), kind);
      toast.success(`Test email sent to ${result.to}`);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Could not send the test email');
    } finally { setSending(false); }
  };

  return <form noValidate onSubmit={send} className="space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Send Test Notification</h3>
    <div className="space-y-1.5">
      <label htmlFor="inactive-test-email" className="text-xs font-medium text-foreground">Send To</label>
      <Input id="inactive-test-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={disabled || sending} />
    </div>
    <div className="space-y-1.5">
      <label htmlFor="inactive-test-kind" className="text-xs font-medium text-foreground">Email</label>
      <Select value={kind} onValueChange={setKind} disabled={disabled || sending}><SelectTrigger id="inactive-test-kind"><SelectValue /></SelectTrigger><SelectContent>{KINDS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
    </div>
    <Button type="submit" variant="outline" disabled={disabled || sending || !email.trim()} className="w-full gap-2">{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Send Test Email</Button>
    <p className="text-xs leading-5 text-muted-foreground">Uses saved settings and your name, and is sent even when notification emails are skipped. Nothing is recorded and no account is affected.</p>
  </form>;
}
