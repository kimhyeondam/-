"use client";

export default function Tabs({ value, onChange, tabs }: { value: string; onChange: (v: string) => void; tabs: { key: string; label: string; n?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-full border border-line bg-slate-50 p-0.5 w-fit">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${value === t.key ? "bg-white text-slate-900 font-medium shadow-card border border-line" : "text-slate-600 hover:text-slate-900"}`}>
          {t.label}
          {t.n !== undefined && <span className={`ml-1 text-xs rounded-full px-1.5 ${value === t.key ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-500"}`}>{t.n}</span>}
        </button>
      ))}
    </div>
  );
}
