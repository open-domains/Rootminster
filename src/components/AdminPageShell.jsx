import { cn } from '@/lib/utils';

export function AdminPage({ children, className }) {
  return (
    <div className={cn('admin-page relative space-y-6', className)}>
      <div className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-48 rounded-full bg-primary/5 blur-3xl" />
      {children}
    </div>
  );
}

export function AdminHeader({ eyebrow = 'Administration', title, description, actions, meta, children }) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="relative px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
              {meta && <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{meta}</span>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="relative flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="relative mt-5">{children}</div>}
      </div>
    </header>
  );
}

export function AdminStatsGrid({ stats = [], columns = 4 }) {
  const columnClass = columns >= 5 ? 'lg:grid-cols-5' : columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', columnClass)}>
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
              {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-primary"><Icon size={15} /></span>}
            </div>
            <p className={cn('mt-3 text-2xl font-semibold tabular-nums text-foreground', item.className)}>{item.value ?? '—'}</p>
            {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function AdminSection({ title, description, action, children, className }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card shadow-card', className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={title || description || action ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function AdminLoading({ label = 'Loading admin data…' }) {
  return (
    <div role="status" className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm text-muted-foreground shadow-card">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
