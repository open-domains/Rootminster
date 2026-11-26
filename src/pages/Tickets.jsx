import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Download, ExternalLink, LifeBuoy, Search } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const statusClass = {
  open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  closed: 'bg-muted text-muted-foreground',
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '');

function TicketRow({ item, staffView, initiallyOpen }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || detail) return;
    let cancelled = false;
    setLoading(true);
    rootminster.discord.ticket(item.id)
      .then((result) => { if (!cancelled) setDetail(result.ticket); })
      .catch((error) => toast.error(error.message || 'Could not load the ticket'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, detail, item.id]);

  const download = async () => {
    try {
      const text = await rootminster.discord.ticketTranscript(item.id);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${item.number}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'Could not download the transcript');
    }
  };

  const channelUrl = item.guild_id && item.channel_id && !item.channel_deleted_at ? `https://discord.com/channels/${item.guild_id}/${item.channel_id}` : null;
  const messages = detail?.transcript?.messages || [];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/40">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><LifeBuoy size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">#{item.number} · {item.category_label}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[item.status] || statusClass.closed}`}>{item.status}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {item.subdomain ? <span className="font-mono">{item.subdomain}</span> : 'Not about a specific subdomain'}
            {staffView && <> · {item.user_email}{item.discord_username ? ` (${item.discord_username})` : ''}</>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opened {formatDate(item.created_at)}{item.closed_at ? ` · Closed ${formatDate(item.closed_at)}` : ''}{staffView && item.claimed_by_email ? ` · Claimed by ${item.claimed_by_email}` : ''}
          </p>
        </div>
        <ChevronDown size={16} className={`mt-2 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {loading || !detail ? <p className="text-sm text-muted-foreground">Loading ticket…</p> : (
            <>
              <section className="rounded-lg border border-border bg-background/50 p-4">
                <h3 className="text-sm font-semibold">Answers</h3>
                <dl className="mt-3 space-y-3">
                  {(detail.answers || []).map((answer) => (
                    <div key={answer.question}>
                      <dt className="text-xs font-medium text-muted-foreground">{answer.question}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{answer.answer}</dd>
                    </div>
                  ))}
                </dl>
                {detail.close_reason && <p className="mt-4 text-sm"><span className="font-medium">Close reason:</span> {detail.close_reason}</p>}
              </section>

              <section className="rounded-lg border border-border bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Transcript</h3>
                  <div className="flex flex-wrap gap-2">
                    {channelUrl && <Button asChild size="sm" variant="outline"><a href={channelUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open in Discord</a></Button>}
                    {detail.transcript && <Button size="sm" variant="outline" onClick={download}><Download size={14} /> Download</Button>}
                  </div>
                </div>
                {!detail.transcript ? (
                  <p className="mt-2 text-xs text-muted-foreground">The transcript is saved when the ticket closes. Until then, the conversation is in the ticket channel on Discord.</p>
                ) : (
                  <>
                    {detail.transcript.error && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{detail.transcript.error}</p>}
                    <ol className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                      {messages.map((entry) => (
                        <li key={entry.id} className="text-sm">
                          <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{entry.author}</span>{entry.bot ? ' · bot' : ''} · {formatDate(entry.at)}</p>
                          {entry.content && <p className="mt-0.5 whitespace-pre-wrap break-words">{entry.content}</p>}
                          {(entry.embeds || []).map((embed, index) => <p key={index} className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{[embed.title, embed.description].filter(Boolean).join(': ')}</p>)}
                          {(entry.attachments || []).map((file) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mt-0.5 block break-all text-xs text-primary underline">{file.name}</a>)}
                        </li>
                      ))}
                      {!messages.length && <li className="text-xs text-muted-foreground">No messages were recorded.</li>}
                    </ol>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Tickets({ scope = 'mine' }) {
  const staffView = scope === 'all';
  const [searchParams] = useSearchParams();
  const focused = searchParams.get('ticket');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(staffView ? 'open' : '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    rootminster.discord.tickets({ scope, status })
      .then(async (result) => {
        let list = result.tickets || [];
        // A linked ticket can be outside this list (a staff member opening a
        // user's ticket from Discord, or a filtered-out status).
        if (focused && !list.some((item) => item.id === focused)) {
          const linked = await rootminster.discord.ticket(focused).then((value) => value.ticket).catch(() => null);
          if (linked) list = [linked, ...list];
        }
        if (!cancelled) setItems(list);
      })
      .catch((error) => toast.error(error.message || 'Failed to load tickets'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, status, focused]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => [item.number, item.category_label, item.subdomain, item.user_email, item.discord_username, item.close_reason]
      .some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Support</p>
          <h1 className="text-2xl font-semibold tracking-tight">{staffView ? 'Discord Tickets' : 'Support Tickets'}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {staffView ? 'Every ticket opened in Discord, with intake answers and the saved transcript once closed.' : 'Tickets you opened in our Discord server. Run /ticket in Discord to open a new one.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={staffView ? 'Search by number, user, subdomain or category…' : 'Search your tickets…'} className="pl-9" aria-label="Search tickets" />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by status">
          {[['open', 'Open'], ['closed', 'Closed'], ['', 'All']].map(([value, label]) => (
            <Button key={label} size="sm" variant={status === value ? 'default' : 'outline'} onClick={() => setStatus(value)} aria-pressed={status === value}>{label}</Button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading tickets…</p> : !filtered.length ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LifeBuoy className="mx-auto text-muted-foreground" size={22} />
          <p className="mt-2 text-sm font-medium">No Tickets</p>
          <p className="mt-1 text-xs text-muted-foreground">{staffView ? 'Nothing matches this filter.' : 'Link your Discord account in Account Settings, then run /ticket in our Discord server.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => <TicketRow key={item.id} item={item} staffView={staffView} initiallyOpen={item.id === focused} />)}
        </div>
      )}
    </div>
  );
}
