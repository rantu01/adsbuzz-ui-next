'use client';

const PILL_TONE_CLASSES = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
};

const BOX_TONE_CLASSES = {
  success: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
  warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
  danger: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
  info: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
  neutral: 'bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60',
  sky: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60',
};

const STYLE_SHAPE_CLASSES = {
  pill: 'rounded-full px-2.5 py-1',
  box: 'rounded px-2 py-0.5',
};

export function Badge({
  tone = 'neutral',
  style = 'pill',
  leftIcon,
  className = '',
  children,
  ...rest
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1',
        'whitespace-nowrap',
        'text-[10px] font-bold',
        STYLE_SHAPE_CLASSES[style],
        style === 'pill' ? PILL_TONE_CLASSES[tone] : BOX_TONE_CLASSES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {leftIcon}
      {children}
    </span>
  );
}

export default Badge;