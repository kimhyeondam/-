"use client";

import { useEffect, useRef, useState } from "react";

type View = { contract: { title: string; customer: string; customerRef?: string; body: string; amount: number; status: string; signedAt?: string; signerName?: string }; company: { name: string; ceo: string; phone: string; logo?: string } };

export default function SignClient({ token }: { token: string }) {
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    fetch(`/api/contracts/sign?token=${token}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    }).catch((e) => setError(e.message));
  }, [token]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    hasInk.current = true;
  }
  function up() { drawing.current = false; }
  function clear() { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); hasInk.current = false; }

  async function submit() {
    if (!hasInk.current) return setError("서명란에 서명을 그려 주세요.");
    setBusy(true); setError(null);
    try {
      const signature = canvasRef.current!.toDataURL("image/png");
      const r = await fetch("/api/contracts/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, signature, agree }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDone(d.signedAt);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (error && !data) return <Shell><div className="rounded-2xl bg-white border border-line p-10 text-center text-slate-600">{error}</div></Shell>;
  if (!data) return <Shell><div className="text-center text-slate-500">계약서를 불러오는 중...</div></Shell>;
  const { contract, company } = data;
  const signed = contract.status === "서명완료" || !!done;

  return (
    <Shell>
      <div className="rounded-2xl bg-white border border-line shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          {company.logo ? <img src={company.logo} alt={company.name} className="h-8 object-contain" /> : <b>{company.name}</b>}
          <span className="text-xs text-slate-500">전자서명 요청</span>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{contract.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{contract.customer} {contract.customerRef ?? ""}님께 {company.name}이(가) 보낸 계약서입니다. 내용을 확인하시고 아래에 서명해 주세요.</p>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-slate-50 p-5 text-[13px] leading-relaxed text-slate-800 max-h-[480px] overflow-y-auto font-sans">{contract.body}</pre>
          <div className="text-sm text-slate-600">계약금액 <b className="text-slate-800">₩{contract.amount.toLocaleString("ko-KR")}</b> (부가세 포함)</div>

          {signed ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
              <div className="text-2xl">✅</div>
              <div className="mt-2 font-bold text-green-800">서명이 완료되었습니다</div>
              <p className="mt-1 text-sm text-green-700">{contract.signerName ?? name} · {(done ?? contract.signedAt ?? "").slice(0, 10)}</p>
              <p className="mt-2 text-xs text-slate-500">서명된 계약서는 {company.name}에서 보관하며, 요청하시면 사본을 보내드립니다. 문의 {company.phone}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-line p-5 space-y-4">
              <label className="block text-sm"><span className="text-slate-600">서명자 이름 *</span><input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-primary" placeholder="예) 홍길동 (직책 포함 가능)" /></label>
              <div className="text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-600">서명 (마우스나 손가락으로 그려 주세요)</span><button type="button" onClick={clear} className="text-xs text-slate-500 hover:text-red-600">지우기</button></div>
                <canvas ref={canvasRef} width={600} height={200} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} className="mt-1 w-full h-40 rounded-xl border-2 border-dashed border-line bg-white touch-none" />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-primary" /> 위 계약 내용을 확인하였으며, 이 전자서명이 본인의 서명임에 동의합니다.</label>
              {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
              <button onClick={submit} disabled={busy || !name.trim() || !agree} className="w-full rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-3">{busy ? "서명 처리 중..." : "서명 완료"}</button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background p-4 md:p-8"><div className="mx-auto w-full max-w-3xl">{children}</div></div>;
}
