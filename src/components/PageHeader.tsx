export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl bg-card border border-line px-5 py-4 md:px-6 md:py-5 shadow-card">
      <div className="min-w-0">
        <h1 className="text-lg md:text-xl font-semibold leading-7 text-slate-900" style={{ letterSpacing: "-0.6px" }}>{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-slate-500 break-keep">{description}</p>}
      </div>
      {action}
    </div>
  );
}
