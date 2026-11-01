// Every page opens the same way: its name, one plain sentence on what you
// can do here, and the page's main buttons (beside it on wide screens,
// below it otherwise).
export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-navy">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink/60">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 xl:shrink-0">{children}</div>}
    </div>
  );
}
