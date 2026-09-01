import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import {
  ArrowRight, Check, Code2, Globe2, LockKeyhole, Menu, Network,
  Server, ShieldCheck, X, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import { usePublicConfig } from '@/lib/public-config';

function MarketingNav() {
  const { config } = usePublicConfig();
  const branding = config.branding;
  const [open, setOpen] = useState(false);
  const links = [
    ['Features', '/how-it-works'],
    ['Guides', '/guides'],
    ['API', '/api-docs'],
    ['Blog', '/blog'],
    ['Support', '/contact'],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src={branding.logo_url} alt={branding.platform_name} className="h-8 w-8 rounded-md bg-white p-0.5 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{branding.short_name}</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {links.map(([label, to]) => (
            <Link key={to} to={to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle compact />
          <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link to="/dashboard"><Button size="sm">Get started</Button></Link>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          {links.map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Log in</Link>
        </div>
      )}
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,.28)] dark:shadow-[0_24px_80px_-32px_rgba(0,0,0,.65)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">example.open-domains.com</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Cloudflare connected · DNSSEC enabled</p>
        </div>
        <Button variant="outline" size="sm">Manage domain</Button>
      </div>
      <div className="grid min-h-[310px] md:grid-cols-[150px_1fr]">
        <aside className="hidden border-r border-border bg-muted/20 p-3 md:block">
          {['Overview', 'DNS records', 'Subdomains', 'DNSSEC', 'Analytics', 'Settings'].map((x, i) => (
            <div key={x} className={`mb-1 rounded-md px-3 py-2 text-xs ${i === 1 ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground'}`}>{x}</div>
          ))}
        </aside>
        <div className="p-4">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[['DNS queries', '1.24M'], ['Uptime', '100%'], ['Response', '24ms']].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-background p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[520px]">
            <div className="grid grid-cols-[70px_1fr_1.4fr_70px_80px] border-b border-border bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Type</span><span>Name</span><span>Content</span><span>TTL</span><span>Proxy</span>
            </div>
            {[
              ['A', '@', '192.0.2.1', 'Auto', 'Proxied'],
              ['CNAME', 'www', 'example.open-domains.com', 'Auto', 'Proxied'],
              ['TXT', '@', 'v=spf1 include:_spf.google.com ~all', 'Auto', 'DNS only'],
              ['MX', '@', 'mail.example.open-domains.com', 'Auto', 'DNS only'],
            ].map((r) => (
              <div key={r.join()} className="grid grid-cols-[70px_1fr_1.4fr_70px_80px] items-center border-b border-border/70 px-3 py-2.5 text-xs last:border-0">
                <span className="font-medium text-foreground">{r[0]}</span><span className="font-mono text-muted-foreground">{r[1]}</span><span className="truncate font-mono text-muted-foreground">{r[2]}</span><span className="text-muted-foreground">{r[3]}</span><span className="text-muted-foreground">{r[4]}</span>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { config } = usePublicConfig();
  const branding = config.branding;
  const [domains, setDomains] = useState([]);
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    rootminster.entities.Domain.filter({ allow_new_requests: true }).then(setDomains).catch(() => {});
    rootminster.functions.invoke('getQueueStatus', {}).then(r => setQueue(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />

      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Free forever. No ads. No tracking.
              </div>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[58px] lg:leading-[1.05]">
                Free subdomains.<br />Powerful DNS management.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Create a free subdomain and manage DNS with fast, reliable infrastructure and a dashboard built for real projects.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/dashboard"><Button size="lg" className="gap-2">Get your free subdomain <ArrowRight size={16} /></Button></Link>
                <Link to="/how-it-works"><Button size="lg" variant="outline">View features</Button></Link>
              </div>
              <div className="mt-9 grid max-w-xl grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-3">
                {[
                  [Globe2, 'Global DNS', 'Cloudflare network'],
                  [ShieldCheck, 'Secure', 'DNSSEC & verification'],
                  [Code2, 'Developer friendly', 'API & tooling'],
                ].map(([Icon, title, desc]) => (
                  <div key={title} className="flex gap-3">
                    <Icon size={17} className="mt-0.5 shrink-0 text-primary" />
                    <div><p className="text-xs font-semibold text-foreground">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Network, 'Global DNS network', 'Reliable infrastructure around the world.'],
              [Server, 'Nested subdomains', 'Create and manage nested records naturally.'],
              [Zap, 'Direct DNS editing', 'Changes apply without unnecessary request queues.'],
              [LockKeyhole, 'Security first', '2FA, verification and careful access controls.'],
            ].map(([Icon, title, text], i) => (
              <div key={title} className={`p-5 ${i ? 'border-t border-border sm:border-l sm:border-t-0' : ''}`}>
                <Icon size={18} className="mb-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {domains.length > 0 && (
          <section className="border-y border-border bg-card/50">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Available domains</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick your address</h2></div>
                {queue && <p className="text-xs text-muted-foreground">Current review estimate: <span className="font-medium text-foreground">{queue.estimated_review}</span></p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {domains.slice(0, 9).map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <span className="font-mono text-sm font-medium text-foreground">*.{d.name}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Open</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[.14em] text-primary">Built for clarity</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">DNS management without the clutter.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">The interface is designed around the jobs people actually do: create a domain, edit a record, verify it, and get back to building.</p>
            </div>
            <div className="space-y-3">
              {['Clean DNS tables with sensible density', 'Light and dark themes with the same visual hierarchy', 'Clear status language for active, suspended and verification states', 'Responsive layouts that remain usable on mobile'].map(x => (
                <div key={x} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Check size={13} /></span>{x}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div><h2 className="text-2xl font-semibold tracking-tight">Ready to create your subdomain?</h2><p className="mt-2 text-sm text-muted-foreground">Free to use, with no advertising baked into the experience.</p></div>
            <Link to="/dashboard"><Button className="gap-2">Get started <ArrowRight size={15} /></Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2"><img src={branding.logo_url} alt={branding.platform_name} className="h-6 w-6 rounded bg-white p-0.5" /><span className="font-medium text-foreground">{branding.short_name}</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link to="/about" className="hover:text-foreground">About</Link><Link to="/guides" className="hover:text-foreground">Guides</Link><Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link><Link to="/terms-of-service" className="hover:text-foreground">Terms</Link><Link to="/report-abuse" className="hover:text-foreground">Report abuse</Link></div>
        </div>
      </footer>
    </div>
  );
}
