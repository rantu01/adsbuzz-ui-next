export default function StatCard({ title, value, variant = 'blue', subtext, badge, icon: Icon, onClick, id, size = 'default', className = '' }) {
  const variantStyles = {
    blue: { bg: 'bg-surface-blue', border: 'border-border-blue', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    purple: { bg: 'bg-[#F8F3FF]', border: 'border-[#E7D7FB]', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    amber: { bg: 'bg-surface-orange', border: 'border-border-orange', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    rose: { bg: 'bg-surface-rose', border: 'border-border-rose', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    emerald: { bg: 'bg-surface-green', border: 'border-border-green', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    indigo: { bg: 'bg-[#F3F6FF]', border: 'border-[#D8E1FB]', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
    pink: { bg: 'bg-[#FFF3FA]', border: 'border-[#F7D4E8]', label: 'text-brand-blue-deep', value: 'text-brand-blue-deep', sub: 'text-brand-blue-deep/75' },
  };

  const sizeStyles = {
    default: { card: 'p-5 rounded-xl', stack: 'space-y-2', title: 'text-xs sm:text-sm', value: 'text-2xl sm:text-3xl', subtext: 'text-[11px]', icon: '' },
    compact: { card: 'p-3.5 rounded-lg', stack: 'space-y-1.5', title: 'text-[10px] sm:text-[11px] leading-snug', value: 'text-lg sm:text-xl leading-tight', subtext: 'text-[9px] sm:text-[10px]', icon: '[&>svg]:h-4 [&>svg]:w-4' },
  };

  const styles = variantStyles[variant] || variantStyles.blue;
  const sizing = sizeStyles[size];

  return (
    <div
      id={id}
      onClick={onClick}
      className={`${sizing.card} border ${styles.bg} ${styles.border} transition-all ${onClick ? 'cursor-pointer hover:opacity-95 active:scale-[0.995]' : ''} ${className}`}
    >
      <div className={`flex flex-col justify-between h-full ${sizing.stack}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`${sizing.title} font-medium tracking-normal ${styles.label}`}>
            {title}
          </span>
          {badge && <div>{badge}</div>}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div className={`${sizing.value} font-bold tracking-tight ${styles.value}`}>
            {value}
          </div>
          {Icon && <div className={`${styles.label} ${sizing.icon} opacity-80 flex-shrink-0`}>{Icon}</div>}
        </div>

        {subtext && (
          <div className={`${sizing.subtext} pt-0.5 font-medium ${styles.sub}`}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}