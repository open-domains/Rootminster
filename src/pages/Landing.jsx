import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import {
  ArrowRight, Check, LockKeyhole, Menu, Network,
  Server, X, Zap,
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src={branding.logo_url} alt={branding.platform_name} className="h-8 w-8 rounded-md bg-white p-0.5 object-contain ring-1 ring-border" />
          <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{branding.short_name}</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {links.map(([label, to]) => (
            <Link key={to} to={to} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle compact />
          <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link to="/dashboard"><Button size="sm">Get started</Button></Link>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          {links.map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Log in</Link>
        </div>
      )}
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="od-product-preview overflow-hidden rounded-xl bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">example.open-domains.com</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Active</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">DNS check passed · Cloudflare connected</p>
        </div>
        <Link to="/dashboard"><Button variant="outline" size="sm">Manage DNS</Button></Link>
      </div>
      <div className="grid min-h-[330px] md:grid-cols-[150px_1fr]">
        <aside className="hidden border-r border-border bg-muted/20 p-3 md:block">
          {['Overview', 'DNS records', 'Requests', 'Guides', 'Security', 'Settings'].map((x, i) => (
            <div key={x} className={`mb-1 rounded-md px-3 py-2 text-xs ${i === 1 ? 'bg-background font-medium text-foreground ring-1 ring-border' : 'text-muted-foreground'}`}>{x}</div>
          ))}
        </aside>
        <div className="p-4">
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/20">
            <p className="font-medium text-foreground">DNS check passed</p>
            <p className="mt-1 text-xs text-muted-foreground">Records resolve and proxy settings are valid.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[520px]">
            <div className="grid grid-cols-[70px_1fr_1.4fr_80px] border-b border-border bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Type</span><span>Name</span><span>Content</span><span>Status</span>
            </div>
            {[
              ['A', '@', '192.0.2.1', 'Active'],
              ['CNAME', 'www', 'open-domains.pages.dev', 'Active'],
              ['TXT', '@', 'v=spf1 include:_spf', 'DNS only'],
              ['MX', '@', 'mail.open-domains.com', 'Verified'],
            ].map((r) => (
              <div key={r.join()} className="grid grid-cols-[70px_1fr_1.4fr_80px] items-center border-b border-border/70 px-3 py-2.5 text-xs last:border-0">
                <span className="font-semibold text-primary">{r[0]}</span><span className="font-mono text-muted-foreground">{r[1]}</span><span className="truncate font-mono text-muted-foreground">{r[2]}</span><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-center text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{r[3]}</span>
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
    <div className="landing-page min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <MarketingNav />

      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/60">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Free subdomains · careful DNS controls
              </div>
              <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.055em] text-foreground sm:text-6xl lg:text-[72px] lg:leading-[0.96]">
                Free subdomains without the mess.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Create a free OpenDomains address, manage DNS records, and understand your request status from one clear control room.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/dashboard"><Button size="lg" className="gap-2">Create a subdomain <ArrowRight size={16} /></Button></Link>
                <Link to="/guides"><Button size="lg" variant="outline">Read the guides</Button></Link>
              </div>
              <div className="mt-9 grid max-w-xl grid-cols-1 gap-3 border-t border-border pt-6 sm:grid-cols-2">
                {['No adverts or tracking added to your site', 'DNSSEC and verification-focused flows', 'Cloudflare-backed DNS management', 'Abuse and policy review built in'].map(item => (
                  <div key={item} className="flex gap-2 text-sm text-foreground"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />{item}</div>
                ))}
              </div>
            </div>
            <div className="landing-preview"><p className="preview-caption">Task-first DNS workspace · illustrative data</p><ProductPreview /></div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl divide-y divide-border px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
            {[
              ['Request', 'Pick an address', 'Choose an available domain and explain the non-commercial project clearly.'],
              ['Verify', 'Review safely', 'Rootminster handles terms, DNS compatibility, abuse signals and status updates.'],
              ['Manage', 'Edit DNS directly', 'Once approved, records are edited through a straightforward table-first interface.'],
            ].map(([step, title, text]) => (
              <div key={step} className="py-8 md:px-8 first:md:pl-0 last:md:pr-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{step}</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {domains.length > 0 && (
          <section className="border-b border-border bg-card/50">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Available domains</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Pick your address</h2></div>
                {queue && <p className="text-xs text-muted-foreground">Current review estimate: <span className="font-medium text-foreground">{queue.estimated_review}</span></p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {domains.slice(0, 9).map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                    <span className="font-mono text-sm font-medium text-foreground">*.{d.name}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Open</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-[.14em] text-primary">Professional by being quieter</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Infrastructure should feel predictable.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">The public site and app are designed around the jobs people actually do: create a domain, edit a record, verify it, and get back to building.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Network, 'Global DNS network', 'Reliable infrastructure around the world.'],
                [Server, 'Nested subdomains', 'Create and manage nested records naturally.'],
                [Zap, 'Direct DNS editing', 'Changes apply without unnecessary queues.'],
                [LockKeyhole, 'Security first', '2FA, verification and careful access controls.'],
              ].map(([Icon, title, text]) => (
                <div key={title} className="rounded-lg border border-border bg-card p-5">
                  <Icon size={18} className="mb-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p>
                </div>
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
          <div className="flex items-center gap-2"><img src={branding.logo_url} alt={branding.platform_name} className="h-6 w-6 rounded bg-white p-0.5 ring-1 ring-border" /><span className="font-medium text-foreground">{branding.short_name}</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link to="/about" className="hover:text-foreground">About</Link><Link to="/guides" className="hover:text-foreground">Guides</Link><Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link><Link to="/cookie-policy" className="hover:text-foreground">Cookies</Link><Link to="/terms-of-service" className="hover:text-foreground">Terms</Link><Link to="/report-abuse" className="hover:text-foreground">Report abuse</Link></div>
        </div>
      </footer>
    </div>
  );
}
