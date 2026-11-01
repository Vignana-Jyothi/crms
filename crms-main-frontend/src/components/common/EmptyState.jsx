import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Says what is missing and, where there is one, the next thing to do.
export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink/50">
          <Icon size={22} />
        </span>
      )}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-ink/60">{children}</p>}
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex items-center gap-1.5 rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
        >
          {action.label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
