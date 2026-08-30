import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Mail, MessageCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
        <Link to="/dashboard"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Get Started</Button></Link>
      </div>
    </nav>
  );
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await rootminster.integrations.Core.SendEmail({
        to: 'hello@open-domains.net',
        subject: `[Contact] ${form.subject}`,
        body: `<p><strong>From:</strong> ${form.name} (${form.email})</p><p><strong>Message:</strong></p><p>${form.message.replace(/\n/g, '<br>')}</p>`
      });
      toast.success('Message sent! We\'ll get back to you within 1–2 business days.');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch { toast.error('Failed to send. Please try again.'); }
    finally { setSending(false); }
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Get in Touch</h1>
            <p className="text-slate-400 leading-relaxed mb-8">Have a question, feedback, or an issue with your subdomain? We're here to help. Use the form or contact us directly.</p>

            <div className="space-y-5">
              {[
                { icon: Mail, title: 'General Support', desc: 'Questions about your account, requests, or DNS records.', email: 'hello@open-domains.net' },
                { icon: Shield, title: 'Abuse Reports', desc: 'Report a subdomain being used for phishing or spam.', link: '/report-abuse' },
                { icon: MessageCircle, title: 'Dashboard Support', desc: 'Already have an account? Use the conversation thread inside your request for faster responses.' },
              ].map(c => (
                <div key={c.title} className="flex gap-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/10 flex items-center justify-center shrink-0">
                    <c.icon size={17} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{c.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{c.desc}</p>
                    {c.email && <a href={`mailto:${c.email}`} className="text-indigo-400 text-xs hover:underline">{c.email}</a>}
                    {c.link && <Link to={c.link} className="text-indigo-400 text-xs hover:underline">Report Abuse →</Link>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <p className="text-white text-sm font-semibold mb-1">Response Times</p>
              <ul className="text-slate-400 text-xs space-y-1">
                <li>• General inquiries: 1–2 business days</li>
                <li>• Abuse reports: within 24 hours</li>
                <li>• Subdomain reviews: 1–2 business days</li>
              </ul>
            </div>
          </div>

          <form onSubmit={send} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg mb-2">Send a Message</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Your Name</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} required
                  className="bg-slate-900 border-slate-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Email Address</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="bg-slate-900 border-slate-700 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Subject</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} required
                className="bg-slate-900 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Message</Label>
              <Textarea value={form.message} onChange={e => set('message', e.target.value)} required
                className="bg-slate-900 border-slate-700 text-white resize-none h-32" />
            </div>
            <Button type="submit" disabled={sending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              {sending ? 'Sending…' : 'Send Message'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}