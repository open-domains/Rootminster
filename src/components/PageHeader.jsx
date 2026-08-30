export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}