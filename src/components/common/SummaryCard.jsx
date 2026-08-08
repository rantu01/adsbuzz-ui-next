const VARIANT_STYLES = {
  blue: {
    card: 'bg-blue-50/50 border-blue-200/80',
    value: 'text-blue-900',
  },
  emerald: {
    card: 'bg-emerald-50/50 border-emerald-200/80',
    value: 'text-emerald-800',
  },
  amber: {
    card: 'bg-amber-50/50 border-amber-200/80',
    value: 'text-amber-800',
  },
};

function SummaryCardSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse" aria-hidden="true">
      <div className="h-2.5 w-28 rounded bg-slate-300/50" />
      <div className="h-9 w-20 rounded bg-slate-300/60" />
      <div className="h-2.5 w-40 rounded bg-slate-300/40" />
    </div>
  );
}

export default function SummaryCard({ id, label, value = 0, subtext, variant = 'blue', loading = false, className = '' }) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.blue;

  return (
    <div
      id={id}
      className={`rounded-xl border shadow-xs p-4 sm:p-5 transition-colors ${styles.card} ${className}`}
    >
      {loading ? (
        <SummaryCardSkeleton />
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
          <p className={`text-3xl font-bold my-1 ${styles.value}`}>{Number(value).toLocaleString()}</p>
          <p className="text-xs text-slate-500">{subtext}</p>
        </div>
      )}
    </div>
  );
}