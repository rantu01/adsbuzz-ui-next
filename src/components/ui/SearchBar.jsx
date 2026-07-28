import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search…', maxWidthClass = 'max-w-xs', className = '' }) {
  return (
    <div className={`relative ${maxWidthClass} ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none"
      />
    </div>
  );
}
