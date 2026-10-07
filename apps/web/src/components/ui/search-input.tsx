import { Search } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative">
      <label htmlFor="search" className="sr-only">{label}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        id="search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border border-border bg-surface pl-10 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
