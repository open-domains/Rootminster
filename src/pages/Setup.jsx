import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Cloud, Database, Github, HeartHandshake, Loader2, Lock, Mail, MessageCircle, Network, Rocket, ShieldCheck, User } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const integrationLabels = {
  smtp: ['Email delivery', Mail],
  cloudflare: ['Cloudflare DNS', Cloud],
  turnstile: ['Turnstile protection', ShieldCheck],
  google_oauth: ['Google sign-in', User],
  github_oauth: ['GitHub sign-in', Github],
  discord_bot: ['Discord bot', MessageCircle],
  mcp: ['MCP server', Network],
  donations: ['Stripe donations', HeartHandshake],
};

export default function Setup() {
  const [status, setStatus] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { rootminster.setup.status().then(setStatus).catch((err) => setError(err.message)); }, []);

  const passwordChecks = useMemo(() => [
    ['At least 12 characters', password.length >= 12],
    ['Passwords match', password.length > 0 && password === confirmPassword],
  ], [password, confirmPassword]);
  const canSubmit = status?.setup_key_configured && setupKey && firstName.trim() && email.trim() && passwordChecks.every(([, valid]) => valid);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await rootminster.setup.initialize({ setupKey, firstName, email, password });
      window.location.assign('/user-dashboard');
    } catch (err) {
      setError(err.message || 'Initial setup failed');
      setLoading(false);
    }
  };

  return <div className="min-h-[100dvh] bg-background text-foreground">
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
      <main className="mx-auto w-full max-w-xl">
        <div className="mb-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Rocket size={23} /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Rootminster V2 · First-run setup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Let’s get your platform ready</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Create the first administrator. This page permanently locks itself after the account is created.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><User size={17} /></span>
            <div><h2 className="text-sm font-semibold">Initial administrator</h2><p className="text-xs text-muted-foreground">This account receives full platform access.</p></div>
          </div>
          {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-4">
            {!status?.setup_key_configured && status && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">Set <code>INITIAL_SETUP_KEY</code> in the server environment, restart Rootminster, then reload this page.</div>}
            <div className="space-y-1.5"><Label htmlFor="setup-key">Initial setup key</Label><Input id="setup-key" type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} placeholder="From INITIAL_SETUP_KEY" required /><p className="text-[11px] text-muted-foreground">This one-time key proves you control the server.</p></div>
            <div className="space-y-1.5"><Label htmlFor="setup-name">First name</Label><Input id="setup-name" autoComplete="given-name" autoFocus maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Andy" required /></div>
            <div className="space-y-1.5"><Label htmlFor="setup-email">Email address</Label><Input id="setup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="setup-password">Password</Label><Input id="setup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="setup-confirm">Confirm password</Label><Input id="setup-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 rounded border-border" /> Show passwords</label>
            <div className="grid gap-2 sm:grid-cols-2">{passwordChecks.map(([label, valid]) => <div key={label} className={`flex items-center gap-2 text-xs ${valid ? 'text-emerald-400' : 'text-muted-foreground'}`}>{valid ? <CheckCircle2 size={13} /> : <Circle size={13} />}{label}</div>)}</div>
          </div>
          <Button type="submit" disabled={!canSubmit || loading} className="mt-6 h-11 w-full gap-2">{loading ? <><Loader2 size={15} className="animate-spin" /> Creating administrator…</> : <><Lock size={15} /> Complete setup</>}</Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Next, Rootminster will ask you to secure this administrator with 2FA.</p>
        </form>
      </main>

      <aside className="rounded-2xl border border-border bg-card/70 p-5 lg:p-6">
        <div className="flex items-center gap-3 border-b border-border pb-4"><Database size={18} className="text-primary" /><div><h2 className="text-sm font-semibold">Configuration check</h2><p className="text-xs text-muted-foreground">Detected from the server environment</p></div></div>
        <div className="mt-4 space-y-2">
          {!status ? <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Checking integrations…</div> : Object.entries(integrationLabels).map(([key, [label, Icon]]) => {
            const enabled = Boolean(status.integrations?.[key]);
            return <div key={key} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/30 px-3 py-2.5"><span className="flex items-center gap-2 text-xs"><Icon size={14} className="text-muted-foreground" />{label}</span><span className={`text-[11px] font-medium ${enabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>{enabled ? 'Configured' : 'Not configured'}</span></div>;
          })}
        </div>
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Not configured is okay.</strong> You can finish the administrator setup now and add optional environment credentials before exposing the platform publicly.</div>
      </aside>
    </div>
  </div>;
}
