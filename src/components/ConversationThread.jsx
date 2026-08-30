import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Send, Lock, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import QuickChips from '@/components/QuickChips';

const roleColors = {
  admin: 'bg-accent/20 text-accent border-accent/30',
  staff: 'bg-primary/20 text-primary border-primary/30',
  user: 'bg-muted text-muted-foreground border-border',
};

export default function ConversationThread({ requestId, requestType = 'subdomain', currentUser, readOnly = false }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [messageType, setMessageType] = useState('comment');
  const scrollContainerRef = useRef(null);
  const isStaffOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'staff';

  const typeLabel = (type) => {
    switch (type) {
      case 'question': return t('conversation.typeQuestion');
      case 'reply': return t('conversation.typeReply');
      case 'status_change': return t('conversation.typeStatusChange');
      default: return t('conversation.typeComment');
    }
  };

  const roleLabel = (role) => role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  const load = async () => {
    try {
      const all = await rootminster.entities.RequestComment.filter({ request_id: requestId });
      const visible = isStaffOrAdmin ? all : all.filter(c => !c.is_internal);
      const sorted = visible.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setComments(sorted);
      const emails = [...new Set(sorted.map(c => c.author_email).filter(Boolean))];
      if (emails.length) {
        const users = await rootminster.entities.User.list();
        const map = {};
        users.forEach(u => { if (u.email) map[u.email] = u.display_name || u.full_name || u.email; });
        setUserNames(map);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (requestId) load(); }, [requestId]);
  useEffect(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; }, [comments]);

  const post = async () => {
    if (!message.trim()) return;
    setPosting(true);
    try {
      const isQuestion = messageType === 'question';
      const isReply = messageType === 'reply';
      await rootminster.functions.invoke('postComment', {
        request_id: requestId,
        request_type: requestType,
        message: message.trim(),
        is_internal: isInternal,
        message_type: messageType,
        notify_user: isQuestion,
        notify_staff: isReply,
      });
      setMessage('');
      setIsInternal(false);
      setMessageType(isStaffOrAdmin ? 'comment' : 'reply');
      load();
    } catch { toast.error(t('conversation.failed')); }
    finally { setPosting(false); }
  };

  useEffect(() => {
    if (!isStaffOrAdmin) setMessageType('reply');
  }, [isStaffOrAdmin]);

  return (
    <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageCircle size={15} className="text-muted-foreground" />
        <span className="text-foreground text-sm font-medium">{t('conversation.title')}</span>
        {comments.length > 0 && <span className="text-muted-foreground text-xs">({comments.length})</span>}
      </div>

      <div ref={scrollContainerRef} className="max-h-80 overflow-y-auto review-modal-scroll p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : comments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">{t('conversation.empty')}</p>
        ) : comments.map(c => (
          <div key={c.id} className="flex gap-3 flex-row">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border', roleColors[c.author_role] || roleColors.user)}>
              {(userNames[c.author_email] || c.author_email)?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-foreground text-xs font-medium" title={c.author_email}>{userNames[c.author_email] || c.author_email}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded border', roleColors[c.author_role] || roleColors.user)}>{roleLabel(c.author_role)}</span>
                {c.is_internal && <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Lock size={10} /> {t('conversation.internal')}</span>}
                <span className="text-muted-foreground/60 text-xs ml-auto">{c.created_date ? format(new Date(c.created_date), 'MMM d, HH:mm') : ''}</span>
              </div>
              <div className={cn('rounded-xl px-3 py-2 text-sm',
                c.message_type === 'question' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100' :
                c.message_type === 'reply' ? 'bg-primary/10 border border-primary/30 text-primary-foreground' :
                c.is_internal ? 'bg-muted border border-dashed border-border text-muted-foreground' :
                'bg-muted border border-border text-foreground'
              )}>
                {c.message_type !== 'comment' && <span className="text-xs font-semibold opacity-60 block mb-1">{typeLabel(c.message_type)}</span>}
                {c.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="p-4 border-t border-border space-y-3">
          {isStaffOrAdmin && (
            <QuickChips
              titleKey="reviewRequest.quickReplyTitle"
              options={[
                { labelKey: 'reviewRequest.quickReply.verifyProject', text: t('reviewRequest.quickReply.verifyProject') },
                { labelKey: 'reviewRequest.quickReply.addSubdomainReason', text: t('reviewRequest.quickReply.addSubdomainReason') },
                { labelKey: 'reviewRequest.quickReply.fixRecord', text: t('reviewRequest.quickReply.fixRecord') },
                { labelKey: 'reviewRequest.quickReply.enableProxy', text: t('reviewRequest.quickReply.enableProxy') },
              ]}
              onSelect={(text) => setMessage(prev => (prev ? `${prev}\n\n${text}` : text))}
            />
          )}
          {isStaffOrAdmin && (
            <div className="flex gap-3 items-center">
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment" className="text-xs">{t('conversation.typeComment')}</SelectItem>
                  <SelectItem value="question" className="text-xs">{t('conversation.askUser')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-muted-foreground text-sm flex items-center gap-1.5"><Lock size={15} /> {t('conversation.internalLabel')}</Label>
                <Switch checked={isInternal} onCheckedChange={setIsInternal} className="scale-110" />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
              placeholder={isStaffOrAdmin ? (messageType === 'question' ? t('conversation.placeholderQuestion') : t('conversation.placeholderComment')) : t('conversation.placeholderReply')}
              className="resize-none h-16 text-sm flex-1"
            />
            <Button onClick={post} disabled={posting || !message.trim()} size="icon"
              className="self-end h-16 w-12 shrink-0">
              {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          {!isStaffOrAdmin && <p className="text-muted-foreground text-xs">{t('conversation.userNote')}</p>}
          {isStaffOrAdmin && messageType === 'question' && <p className="text-accent/80 text-xs">{t('conversation.questionNote')}</p>}
        </div>
      )}
    </div>
  );
}
