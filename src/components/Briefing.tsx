import { brandOf, loadCompany } from "@/lib/branding";
import { buildSnapshot } from "@/lib/assistantContext";
import { briefing } from "@/lib/localAssistant";
import { loadCollections } from "@/lib/loadCollections";

/** 대시보드의 "현담비서 브리핑" 카드 (서버 저장소의 최신 데이터 기준) */
export default async function Briefing() {
  const company = brandOf(await loadCompany());
  const text = briefing(buildSnapshot(await loadCollections()));
  const lines = text.split("\n").slice(1);
  return (
    <div className="rounded-xl bg-primary-soft/60 border border-primary/10 p-4 text-sm text-slate-700 leading-relaxed">
      <div className="font-semibold text-primary mb-1">✦ 오늘의 요약</div>
      <ul className="space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className={l.startsWith("  ·") ? "pl-4 text-xs text-slate-500" : ""}>{l.replace(/^- /, "• ").replace(/^ {2}· /, "· ")}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">오른쪽 아래 ✦ 버튼을 눌러 {company.assistantName}에게 더 물어보세요.</p>
    </div>
  );
}
