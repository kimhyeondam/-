import Link from "next/link";
import { formatWonCompact } from "@/lib/format";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl bg-card border border-line shadow-card ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  highlight = false,
  tone,
  href,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon?: string;
  highlight?: boolean;
  tone?: "amber" | "green";
  /** 있으면 상자 전체가 이 주소로 가는 링크가 됩니다 */
  href?: string;
  /** 있으면 상자 전체가 버튼처럼 눌립니다 (같은 화면 안에서 필터를 바꿀 때) */
  onClick?: () => void;
}) {
  const toneCls = tone === "amber" ? "bg-amber-50/70 border-amber-200" : tone === "green" ? "bg-green-50/70 border-green-200" : "";
  const clickable = !!href || !!onClick;
  // "293,615,678원"처럼 긴 금액 문자열은 휴대폰에서 "2억 9,362만원"으로 줄여 보여줍니다 (PC에서는 그대로)
  const m = typeof value === "string" ? value.match(/^(-?[\d,]{9,})원$/) : null;
  const shown = m ? (
    <>
      <span className="sm:hidden">{formatWonCompact(Number(m[1].replace(/,/g, "")))}</span>
      <span className="hidden sm:inline">{value}</span>
    </>
  ) : value;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 break-keep">{label}</div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-slate-800 leading-8 whitespace-nowrap tabular-nums" style={{ letterSpacing: "-0.96px" }}>{shown}</div>
        </div>
        {icon && (
          <div className="hidden sm:flex h-9 w-9 shrink-0 rounded-full bg-white border border-line items-center justify-center text-sm text-slate-400">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>{sub}</span>
        {clickable && <span className="shrink-0 text-primary">보기 →</span>}
      </div>
    </>
  );
  const cls = `block rounded-2xl bg-card border border-line shadow-card p-4 sm:p-5 text-left ${highlight ? "bg-primary-soft/40" : ""} ${toneCls} ${clickable ? "transition hover:border-primary/60 hover:shadow-md active:scale-[0.99] cursor-pointer" : ""}`;
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
