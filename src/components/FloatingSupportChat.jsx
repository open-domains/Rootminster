import { useEffect, useMemo, useRef, useState } from 'react';
import { LifeBuoy, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import {
  SUPPORT_TOPICS,
  WAIT_TIME_REPLY,
  buildSupportChatTicket,
  getTopic,
  isWaitTimeQuestion,
  normalizeSupportSubdomainOptions,
} from '@/lib/support-chat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Topics where a free-text answer about review speed should get the volunteer reply instead of a ticket.
const WAIT_TIME_CHECK_TOPICS = new Set(['request', 'other']);

function greeting(user) {
  const first = String(user?.full_name || '').trim().split(/\s+/)[0];
  return `Hi${first ? ` ${first}` : ''}! Which subdomain do you need help with?`;
}

function Bubble({ from, children }) {
  return (
    <div className={cn('flex', from === 'user' ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
        from === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'
      )}>
        {children}
      </div>
    </div>
  );
}

function Choices({ options, onPick, disabled }) {
  return (
    <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function FloatingSupportChat({ user }) {
  const [open, setOpen] = useState(false);
  const [ownerships, setOwnerships] = useState([]);
  const [loadingSubdomains, setLoadingSubdomains] = useState(false);
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState('subdomain');
  const [selectedSubdomain, setSelectedSubdomain] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const subdomainOptions = useMemo(() => normalizeSupportSubdomainOptions(ownerships), [ownerships]);
  const topic = topicId ? getTopic(topicId) : null;
  const question = topic?.questions[questionIndex];

  const say = (...entries) => setMessages(previous => [...previous, ...entries]);

  const restart = () => {
    setMessages([{ from: 'bot', text: greeting(user) }]);
    setStep('subdomain');
    setSelectedSubdomain(null);
    setTopicId(null);
    setQuestionIndex(0);
    setAnswers([]);
    setDraft('');
  };

  useEffect(() => {
    if (open && messages.length === 0) restart();
  }, [open]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    setLoadingSubdomains(true);
    rootminster.entities.SubdomainOwnership.filter({ owner_id: user.id }, 'full_name', 200)
      .then(rows => { if (!cancelled) setOwnerships(rows || []); })
      .catch(() => { if (!cancelled) toast.error('Could not load your subdomains. You can still pick "My account / login".'); })
      .finally(() => { if (!cancelled) setLoadingSubdomains(false); });
    return () => { cancelled = true; };
  }, [open, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  const askQuestion = (nextTopic, index) => {
    const next = nextTopic.questions[index];
    if (next) {
      setQuestionIndex(index);
      setStep('question');
      say({ from: 'bot', text: next.prompt });
    } else {
      setStep('review');
      say({ from: 'bot', text: "Thanks, that's everything I need. Check the summary below, then open the support request when you're ready." });
    }
  };

  const pickSubdomain = (option) => {
    setSelectedSubdomain(option.value);
    setStep('topic');
    say(
      { from: 'user', text: option.label },
      { from: 'bot', text: option.value === 'account' ? "What's going on with your account?" : `What's going on with ${option.label}?` },
    );
  };

  const pickTopic = (option) => {
    const nextTopic = getTopic(option.value);
    setTopicId(nextTopic.id);
    setAnswers([]);
    say({ from: 'user', text: nextTopic.label });
    if (nextTopic.noTicket) {
      setStep('waitReply');
      say({ from: 'bot', text: WAIT_TIME_REPLY });
      return;
    }
    askQuestion(nextTopic, 0);
  };

  const submitAnswer = (event, skip = false) => {
    event?.preventDefault();
    const answer = skip ? '' : draft.trim();
    if (!skip && !answer) return;
    setDraft('');
    setAnswers(previous => [...previous, { question: question.prompt, answer }]);
    say({ from: 'user', text: skip ? 'Skip' : answer });
    if (!skip && WAIT_TIME_CHECK_TOPICS.has(topic.id) && isWaitTimeQuestion(answer)) {
      setStep('waitCheck');
      say({ from: 'bot', text: WAIT_TIME_REPLY });
      return;
    }
    askQuestion(topic, questionIndex + 1);
  };

  const finishedAfterWaitReply = () => {
    say({ from: 'user', text: 'That answers it, thanks' }, { from: 'bot', text: 'Glad that helped. You can close this chat or start again any time.' });
    setStep('done');
  };

  const openTicket = async () => {
    setSending(true);
    try {
      const result = await rootminster.support.createTicket(buildSupportChatTicket({
        selectedSubdomain,
        topic: topic.id,
        answers,
        user,
        path: window.location.pathname,
      }));
      const number = result.ticket?.number;
      say({ from: 'bot', text: number
        ? `Done. Ticket #${number} is with the support team. We'll reply by email, and replies depend on volunteer availability.`
        : "Done. Your request is with the support team. We'll reply by email, and replies depend on volunteer availability." });
      setStep('done');
    } catch (error) {
      toast.error(error?.message || 'Could not open a support request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const topicOptions = SUPPORT_TOPICS.map(t => ({ value: t.id, label: t.label }));
  const subdomainChoices = subdomainOptions.map(option => ({
    value: option.value,
    label: option.status && !['active', 'account'].includes(option.status) ? `${option.label} (${option.status})` : option.label,
  }));
  const reviewAnswers = answers.filter(entry => entry.answer);
  const selectedLabel = selectedSubdomain === 'account' ? 'My account / login' : selectedSubdomain;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section className="flex max-h-[min(640px,calc(100dvh-6rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:w-[380px]" aria-label="Support chat">
          <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LifeBuoy size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">OpenDomains support</h2>
              <p className="text-[11px] text-muted-foreground">A few quick questions first, so volunteers can help faster.</p>
            </div>
            <button onClick={restart} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Start over" title="Start over">
              <RotateCcw size={15} />
            </button>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close support chat">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((message, index) => <Bubble key={index} from={message.from}>{message.text}</Bubble>)}

            {step === 'review' && (
              <div className="space-y-2 rounded-lg border border-border bg-background p-3 text-[12px]">
                <p><span className="text-muted-foreground">About:</span> <span className="font-mono">{selectedLabel}</span></p>
                <p><span className="text-muted-foreground">Topic:</span> {topic?.label}</p>
                {reviewAnswers.map((entry, index) => (
                  <div key={index}>
                    <p className="text-muted-foreground">{entry.question}</p>
                    <p className="whitespace-pre-wrap text-foreground">{entry.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            {step === 'subdomain' && (
              loadingSubdomains
                ? <p className="text-xs text-muted-foreground">Loading your subdomains…</p>
                : <Choices options={subdomainChoices} onPick={pickSubdomain} />
            )}

            {step === 'topic' && <Choices options={topicOptions} onPick={pickTopic} />}

            {step === 'question' && question && (
              <form onSubmit={submitAnswer} className="space-y-2">
                <Textarea
                  autoFocus
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) submitAnswer(event); }}
                  maxLength={2000}
                  rows={2}
                  className="min-h-[64px] resize-none text-[13px]"
                  placeholder="Type your answer…"
                  aria-label={question.prompt}
                />
                <div className="flex gap-2">
                  {question.optional && <Button type="button" variant="outline" className="flex-1" onClick={() => submitAnswer(null, true)}>Skip</Button>}
                  <Button type="submit" disabled={!draft.trim()} className="flex-1 gap-2"><Send size={14} /> Send</Button>
                </div>
              </form>
            )}

            {step === 'waitReply' && (
              <Choices
                options={[{ value: 'ok', label: 'That answers it, thanks' }, { value: 'other', label: 'I have a different question' }]}
                onPick={option => {
                  if (option.value === 'ok') return finishedAfterWaitReply();
                  say({ from: 'user', text: 'I have a different question' }, { from: 'bot', text: 'No problem. What is it about?' });
                  setStep('topic');
                }}
              />
            )}

            {step === 'waitCheck' && (
              <Choices
                options={[{ value: 'ok', label: 'That answers it, thanks' }, { value: 'continue', label: 'No, I still need help with something else' }]}
                onPick={option => {
                  if (option.value === 'ok') return finishedAfterWaitReply();
                  say({ from: 'user', text: 'I still need help' });
                  askQuestion(topic, questionIndex + 1);
                }}
              />
            )}

            {step === 'review' && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={restart} disabled={sending}>Start over</Button>
                <Button className="flex-1 gap-2" onClick={openTicket} disabled={sending}>
                  <Send size={14} /> {sending ? 'Opening…' : 'Open support request'}
                </Button>
              </div>
            )}

            {step === 'done' && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={restart}>New question</Button>
                <Button className="flex-1" onClick={() => setOpen(false)}>Close</Button>
              </div>
            )}
          </div>
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
