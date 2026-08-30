import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';

function PublicNav() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Layers size={16} className="text-white" /></div>
          <span className="font-bold text-white">Open Domains</span>
        </Link>
      </div>
    </nav>
  );
}

const ABUSE_TYPES = ['Phishing / Fraud', 'Malware / Malicious Content', 'Spam', 'Illegal Content', 'Impersonation', 'Copyright Infringement', 'Other'];

export default function ReportAbuse() {
  const [form, setForm] = useState({ subdomain: '', abuse_type: '', description: '', evidence: '', reporter_email: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    rootminster.functions.invoke('getTurnstileSiteKey', {}).then(res => setSiteKey(res.data?.site_key || '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    widgetIdRef.current = null;
    const tryRender = () => {
      if (window.turnstile && turnstileRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          theme: 'dark',
        });
      }
    };
    const interval = setInterval(() => {
      if (window.turnstile) { tryRender(); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [siteKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      toast.error('Please complete the security check.');
      return;
    }
    setSending(true);
    try {
      await rootminster.functions.invoke('submitAbuseReport', {
        subdomain: form.subdomain,
        abuse_type: form.abuse_type,
        description: form.description,
        evidence: form.evidence,
        reporter_email: form.reporter_email,
        turnstile_token: turnstileToken,
      });
      setSent(true);
    } catch {
      toast.error('Failed to submit. Please try emailing hello@open-domains.net directly.');
    } finally {
      setSending(false);
    }
  };

  const canSubmit = form.subdomain && form.abuse_type && form.description && !!turnstileToken;

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Shield size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Report Abuse</h1>
            <p className="text-slate-400 text-sm">Help us keep Open Domains safe for everyone.</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8 flex gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Emergency Abuse</p>
            <p className="text-amber-400/70 text-xs mt-0.5">If you believe a subdomain is actively being used in a crime or for urgent harm, contact your local authorities in addition to filing this report. For immediate CSAM reports, also contact NCMEC at CyberTipline.org.</p>
          </div>
        </div>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center">
            <Shield size={32} className="text-emerald-400 mx-auto mb-3" />
            <h2 className="text-white font-bold text-lg mb-2">Report Received</h2>
            <p className="text-slate-400 text-sm">Thank you for helping keep Open Domains safe. Our team will investigate this report within 24 hours on business days.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Subdomain or URL being reported *</Label>
              <Input value={form.subdomain} onChange={e => set('subdomain', e.target.value)} required
                placeholder="e.g. suspicious.example.com or https://..."
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Type of Abuse *</Label>
              <Select value={form.abuse_type} onValueChange={v => set('abuse_type', v)}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select abuse type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {ABUSE_TYPES.map(t => <SelectItem key={t} value={t} className="text-white focus:bg-slate-700">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Description *</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} required
                placeholder="Describe the abusive activity in detail..."
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 resize-none h-28" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Evidence (URLs, screenshots, logs)</Label>
              <Textarea value={form.evidence} onChange={e => set('evidence', e.target.value)}
                placeholder="Paste any links or evidence here..."
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 resize-none h-20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Your Email (optional, for follow-up)</Label>
              <Input type="email" value={form.reporter_email} onChange={e => set('reporter_email', e.target.value)}
                placeholder="you@example.com"
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" />
            </div>

            {/* Cloudflare Turnstile */}
            <div className="flex justify-center py-2">
              <div ref={turnstileRef}></div>
            </div>

            <Button type="submit" disabled={sending || !canSubmit}
              className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
              {sending ? 'Submitting…' : 'Submit Abuse Report'}
            </Button>
          </form>
        )}

        <div className="mt-8 bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
          <p className="text-white text-sm font-semibold mb-2">Our Commitment to Safety</p>
          <p className="text-slate-400 text-xs leading-relaxed">We review all abuse reports within 24 hours on business days. Confirmed abusive subdomains are suspended immediately upon verification. We cooperate with law enforcement and maintain records of abuse reports as required by law. Repeat or serious offenders may have their accounts permanently banned.</p>
        </div>
      </div>
    </div>
  );
}