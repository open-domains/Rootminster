import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LifeBuoy, MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { buildSupportChatTicket, normalizeSupportSubdomainOptions, TOPIC_LABELS } from '@/lib/support-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TOPICS = [
  ['dns', TOPIC_LABELS.dns],
  ['account', TOPIC_LABELS.account],
  ['request', TOPIC_LABELS.request],
  ['billing', TOPIC_LABELS.billing],
  ['other', TOPIC_LABELS.other],
];

export default function FloatingSupportChat({ user }) {
  const [open, setOpen] = useState(false);
  const [loadingSubdomains, setLoadingSubdomains] = useState(false);
  const [ownerships, setOwnerships] = useState([]);
  const [selectedSubdomain, setSelectedSubdomain] = useState('account');
  const [topic, setTopic] = useState('dns');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTicket, setSentTicket] = useState(null);

  const subdomainOptions = useMemo(() => normalizeSupportSubdomainOptions(ownerships), [ownerships]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    setLoadingSubdomains(true);
    rootminster.entities.SubdomainOwnership.filter({ owner_id: user.id }, 'full_name', 200)
      .then((rows) => {
        if (cancelled) return;
        setOwnerships(rows || []);
        if (rows?.length && selectedSubdomain === 'account') {
          const options = normalizeSupportSubdomainOptions(rows);
          setSelectedSubdomain(options[1]?.value || 'account');
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load your subdomains. You can still contact support.');
      })
      .finally(() => { if (!cancelled) setLoadingSubdomains(false); });
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const reset = () => {
    setSummary('');
    setDetails('');
    setTopic('dns');
    setSentTicket(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await rootminster.support.createTicket(buildSupportChatTicket({
        selectedSubdomain,
        topic,
        summary,
        details,
        user,
        path: window.location.pathname,
      }));
      setSentTicket(result.ticket || {});
      setSummary('');
      setDetails('');
      toast.success(result.ticket?.number ? `Support ticket #${result.ticket.number} created.` : 'Support ticket created.');
    } catch (error) {
      toast.error(error?.message || 'Could not create a support ticket.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section className="w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:w-[380px]" aria-label="Support chat">
          <div className="flex items-start gap-3 border-b border-border bg-primary/5 px-4 py-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LifeBuoy size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">OpenDomains support</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Choose the subdomain or account area having trouble, then tell us what happened.</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close support chat">
              <X size={16} />
            </button>
          </div>

          {sentTicket ? (
            <div className="space-y-4 px-4 py-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 size={22} className="mb-2 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">Ticket created</p>
                <p className="mt-1 text-xs text-muted-foreground">{sentTicket.number ? `Ticket #${sentTicket.number} is with support.` : 'Your request is with support.'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>Send another</Button>
                <Button className="flex-1" onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-subdomain" className="text-xs">What are you having issues with?</Label>
                <Select value={selectedSubdomain} onValueChange={setSelectedSubdomain}>
                  <SelectTrigger id="support-subdomain" className="h-10">
                    <SelectValue placeholder={loadingSubdomains ? 'Loading your subdomains…' : 'Choose a subdomain'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subdomainOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}{option.status && !['active', 'account'].includes(option.status) ? ` (${option.status})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingSubdomains && <p className="text-[11px] text-muted-foreground">Loading your account subdomains…</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-topic" className="text-xs">Issue type</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="support-topic" className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOPICS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-summary" className="text-xs">Short summary</Label>
                <Input id="support-summary" value={summary} onChange={event => setSummary(event.target.value)} maxLength={140} required placeholder="e.g. DNS is not resolving" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-details" className="text-xs">Details</Label>
                <Textarea id="support-details" value={details} onChange={event => setDetails(event.target.value)} required className="min-h-[112px] resize-none" placeholder="What did you try? What did you expect? Any error message?" />
              </div>

              <Button type="submit" disabled={sending || !summary.trim() || !details.trim()} className="w-full gap-2">
                <Send size={14} /> {sending ? 'Sending…' : 'Send to support'}
              </Button>
            </form>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          open && 'scale-95'
        )}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
