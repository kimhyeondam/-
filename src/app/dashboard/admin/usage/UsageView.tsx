"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { useBrand } from "@/lib/brand";
import { estimateCostKrw, type UsageEntry } from "@/lib/assistantUsage";
import { useServerState } from "@/lib/useServerState";

export default function UsageView() {
  const company = useBrand();
  const [entries, setEntries] = useServerState<UsageEntry[]>("assistantUsage", []);
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/assistant").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, model: "내장 비서" }));
  }, []);

  const month = new Date().toISOString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.at.startsWith(month));
  const inTok = entries.reduce((s, e) => s + e.inputTokens, 0);
  const outTok = entries.reduce((s, e) => s + e.outputTokens, 0);
  const cacheRead = entries.reduce((s, e) => s + (e.cacheRead ?? 0), 0);
  const cacheWrite = entries.reduce((s, e) => s + (e.cacheWrite ?? 0), 0);
  const claudeCount = entries.filter((e) => e.mode === "claude").length;

  function clear() {
    if (confirm("사용 기록을 모두 지울까요?")) setEntries([]);
  }

  return (
    <>
      <PageHeader
        title={`${company.assistantName} 사용량`}
        description="AI 비서에게 물어본 횟수와 사용한 토큰(글자 단위 사용량), 예상 비용을 확인합니다."
        action={<button onClick={clear} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-red-400 hover:text-red-600 transition">기록 지우기</button>}
      />

      <Card className={`px-5 py-4 text-sm flex items-center gap-3 ${status?.configured ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <span className="text-lg">{status?.configured ? "✅" : "ℹ️"}</span>
        <div>
          <div className="font-semibold text-slate-800">{status === null ? "연결 상태 확인 중..." : status.configured ? `Claude 연결됨 (${status.model})` : "내장 비서 모드 (Claude 미연결)"}</div>
          <div className="text-xs text-slate-500">{status?.configured ? "질문이 Claude에게 전달되며 토큰 사용량이 기록됩니다." : "서버 환경 변수 ANTHROPIC_API_KEY를 넣으면 Claude가 자유로운 질문에도 답합니다. 지금은 정해진 질문만 프로그램이 직접 계산해 답합니다."}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="총 질문 수" value={`${entries.length}건`} sub={`Claude ${claudeCount}건 · 내장 ${entries.length - claudeCount}건`} icon="✦" />
        <StatCard label="이번 달 질문" value={`${monthEntries.length}건`} sub={`${month.replace("-", "년 ")}월 기준`} icon="▤" highlight />
        <StatCard label="입력 토큰" value={inTok.toLocaleString("ko-KR")} sub={cacheRead ? `이 중 캐시 재사용 ${cacheRead.toLocaleString("ko-KR")} (요금 1/10)` : "질문 + 회사 현황 요약"} icon="↓" />
        <StatCard label="출력 토큰" value={outTok.toLocaleString("ko-KR")} sub="AI가 작성한 답변" icon="↑" />
        <StatCard label="예상 비용" value={`${estimateCostKrw(inTok, outTok, cacheRead, cacheWrite).toLocaleString("ko-KR")}원`} sub="claude-sonnet-5 요금 · 캐시 반영 · 1달러 1,400원" icon="₩" tone="green" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <th className="px-5 py-3 font-medium">시각</th>
              <th className="px-3 py-3 font-medium">질문</th>
              <th className="px-3 py-3 font-medium">질문자</th>
              <th className="px-3 py-3 font-medium">답변 방식</th>
              <th className="px-3 py-3 font-medium text-right">입력 토큰</th>
              <th className="px-3 py-3 font-medium text-right pr-5">출력 토큰</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">아직 질문 기록이 없습니다. 오른쪽 아래 ✦ 버튼으로 물어보세요.</td></tr>}
            {entries.slice(0, 50).map((e, i) => (
              <tr key={i} className="hover:bg-primary-soft/30">
                <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{new Date(e.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-3 py-3 text-slate-800 max-w-[380px] truncate">{e.question}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{e.user ?? "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${e.mode === "claude" ? "bg-primary-soft text-primary border-primary/20" : "bg-slate-100 text-slate-600 border-slate-200"}`}>{e.mode === "claude" ? "Claude" : "내장"}</span></td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600">{e.inputTokens.toLocaleString("ko-KR")}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600 pr-5">{e.outputTokens.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
