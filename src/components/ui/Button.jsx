'use client';

const BASE_CLASSES = 'inline-flex items-center justify-center font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 focus:outline-none';

const VARIANT_CLASSES = {
  primary: 'bg-brand-orange hover:bg-brand-orange-dark text-white rounded-xl shadow-sm',
  secondary: 'bg-brand-blue hover:bg-[#154673] text-white rounded-xl',
  danger: 'bg-red-600 hover:bg-red-700 text-white rounded',
  ghost: 'text-slate-400 font-bold hover:text-slate-600 rounded',
  outline: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-200 dark:hover:bg-slate-300 text-slate-950 border border-slate-300 dark:border-slate-400 shadow-xs rounded-md',
};

const SIZE_CLASSES = {
  default: 'text-xs px-4 py-2.5',
  sm: 'text-xs px-3 py-1.5',
  compact: 'text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5',
};

const ICON_SIZE = {
  default: 14,
  sm: 12,
  compact: 10,
};

export function Button({
  variant = 'primary',
  size = 'default',
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = ICON_SIZE[size];

  return (
    <button className={classes} {...rest}>
      {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
    </button>
  );
}

export default Button;