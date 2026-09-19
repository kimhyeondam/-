"use client";

import { useEffect, useRef, useState } from "react";
import { useBrand } from "@/lib/brand";
import { usePersistentState } from "@/lib/usePersistentState";
import { suggestedQuestions } from "@/lib/localAssistant";
import SmartInbox from "@/components/inbox/SmartInbox";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  mode?: "claude" | "local";
  href?: string; // 등록 결과 확인 링크
}

/** **굵게**와 줄바꿈만 간단히 표시 */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}
    </span>
  );
}

export default function AssistantPanel() {
  const company = useBrand();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("jeil.assistant.chat", []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || status) return;
    fetch("/api/assistant").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, model: "내장 비서" }));
  }, [open, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  function noteSaved(text: string, href: string) {
    setMessages((prev) => [...prev, { role: "assistant", content: `✅ ${text}`, mode: "local", href }]);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json()) as { text?: string; mode?: "claude" | "local"; usage?: { inputTokens: number; outputTokens: number }; error?: string };
      const answer = data.text ?? data.error ?? "답변을 받지 못했습니다.";
      setMessages([...next, { role: "assistant", content: answer, mode: data.mode ?? "local" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", mode: "local" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        data-print-hide
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl hover:bg-primary-dark transition"
        title={`${company.assistantName}에게 물어보기`}
        aria-label={`${company.assistantName} 열기`}
      >
        {open ? "×" : "✦"}
      </button>

      {open && (
        <div data-print-hide className="fixed bottom-24 right-3 left-3 md:left-auto md:right-6 z-40 md:w-[380px] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl bg-card border border-line shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
            <div>
              <div className="font-bold">✦ {company.assistantName}</div>
              <div className="text-[11px] text-white/80">{status ? (status.configured ? `Claude 연결됨 · ${status.model}` : "내장 비서 (API 키 없음)") : "연결 확인 중..."}</div>
            </div>
            <button onClick={() => setMessages([])} className="text-xs text-white/80 hover:text-white">대화 지우기</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/60">
            {messages.length === 0 && (
              <div className="text-sm text-slate-600">
                <p>안녕하세요, {company.assistantName}입니다. 할일·일정·프로젝트·고객·견적·매출·입금 현황을 물어보세요.</p>
                <div className="mt-3"><SmartInbox variant="camera" onSaved={noteSaved} /></div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestedQuestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-white border border-line text-slate-800 rounded-bl-sm"}`}>
                  <Rich text={m.content} />
                  {m.href && <Link href={m.href} className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline">확인하러 가기 →</Link>}
                  {m.role === "assistant" && m.mode && !m.href && <div className="mt-1.5 text-[10px] text-slate-400">{m.mode === "claude" ? "Claude" : "내장 비서"}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">생각 중...</div>}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-line p-3 bg-card"
          >
            <SmartInbox variant="button" onSaved={noteSaved} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예) ○○건설 미수금 얼마야?"
              className="flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold px-4 py-2">보내기</button>
          </form>
        </div>
      )}
    </>
  );
}
