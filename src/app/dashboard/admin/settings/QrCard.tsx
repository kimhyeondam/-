"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card } from "@/components/Card";

type PublicFile = { id: string; kind: "승인서" | "카탈로그" | "기타"; title: string; fileName: string; size: number; type: string; uploadedAt: string };
type Page = { intro?: string; showProducts?: boolean; files?: PublicFile[] };

const kindLabel: Record<PublicFile["kind"], string> = { 승인서: "공급원승인서", 카탈로그: "카탈로그", 기타: "기타 자료" };
const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

/** 명함 QR 코드 · 회사 소개 페이지 관리: QR 그림 내려받기, 공급원승인서·카탈로그 올리기, 안내 문구 */
export default function QrCard() {
  const [page, setPage] = useState<Page | null>(null);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [kind, setKind] = useState<PublicFile["kind"]>("승인서");
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRefs = useRef<Record<PublicFile["kind"], HTMLInputElement | null>>({ 승인서: null, 카탈로그: null, 기타: null });

  useEffect(() => {
    const u = `${window.location.origin}/company`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    QRCode.toDataURL(u, { width: 240, margin: 1, errorCorrectionLevel: "M" }).then(setQr).catch(() => {});
    fetch("/api/admin/public-files").then((r) => (r.ok ? r.json() : null)).then((d: Page | null) => { if (d) { setPage(d); setIntro(d.intro ?? ""); } }).catch(() => {});
  }, []);

  async function downloadQr(format: "png" | "svg") {
    const name = `명함QR-회사소개.${format}`;
    let href: string;
    if (format === "png") href = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "H" });
    else href = URL.createObjectURL(new Blob([await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" })], { type: "image/svg+xml" }));
    const a = document.createElement("a"); a.href = href; a.download = name; a.click();
  }

  async function copyUrl() { try { await navigator.clipboard.writeText(url); setMsg({ ok: true, text: "주소를 복사했습니다." }); } catch { window.prompt("주소를 복사하세요", url); } }

  async function upload(e: React.FormEvent, k: PublicFile["kind"]) {
    e.preventDefault();
    setKind(k);
    const file = fileRefs.current[k]?.files?.[0];
    if (!file) return setMsg({ ok: false, text: "파일을 골라 주세요." });
    if (file.size > 20 * 1024 * 1024) return setMsg({ ok: false, text: "파일은 20MB 이하로 올려 주세요." });
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("file", file); fd.append("kind", k); fd.append("title", (kind === k ? title : "") || file.name.replace(/\.[^.]+$/, ""));
    try {
      const r = await fetch("/api/admin/public-files", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "올리지 못했습니다.");
      setPage(d.page); setTitle(""); const el = fileRefs.current[k]; if (el) el.value = "";
      setMsg({ ok: true, text: `「${d.file.title}」을(를) ${kindLabel[k]}(으)로 올렸습니다. 소개 페이지에 바로 보입니다.` });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "올리지 못했습니다." }); }
    finally { setBusy(false); }
  }

  async function remove(f: PublicFile) {
    if (!window.confirm(`「${f.title}」을(를) 소개 페이지에서 지울까요?`)) return;
    const r = await fetch(`/api/admin/public-files?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
    const d = await r.json(); if (r.ok) setPage(d.page); else setMsg({ ok: false, text: d.error || "지우지 못했습니다." });
  }

  async function changeFile(f: PublicFile, patch: { kind?: string; title?: string }) {
    const r = await fetch("/api/admin/public-files", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: f.id, ...patch }) });
    const d = await r.json();
    if (r.ok) { setPage(d.page); setMsg({ ok: true, text: patch.kind ? `「${f.title}」을(를) ${kindLabel[patch.kind as PublicFile["kind"]]}(으)로 옮겼습니다.` : "이름을 바꿨습니다." }); }
    else setMsg({ ok: false, text: d.error || "바꾸지 못했습니다." });
  }

  async function savePage(patch: { intro?: string; showProducts?: boolean }) {
    const r = await fetch("/api/admin/public-files", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const d = await r.json(); if (r.ok) { setPage(d.page); setMsg({ ok: true, text: "저장했습니다." }); }
  }

  const files = page?.files ?? [];

  return (
    <Card className="p-5">
      <h3 className="font-semibold">명함 QR 코드 · 회사 소개 페이지</h3>
      <p className="mt-1 text-sm text-slate-500">명함에 이 QR을 넣으면 휴대폰으로 찍는 즉시 회사 소개 페이지가 열립니다. 로그인 없이 누구나 볼 수 있고, 공급원승인서는 누르면 바로 내려받아지며 생산품목은 재고관리의 품목 목록이 그대로 나옵니다.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="text-center">
          {qr ? <img src={qr} alt="QR" className="mx-auto h-40 w-40 rounded-lg border border-line bg-white p-1" /> : <div className="mx-auto h-40 w-40 rounded-lg skeleton" />}
          <div className="mt-2 flex justify-center gap-1.5">
            <button type="button" onClick={() => downloadQr("png")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">PNG 내려받기</button>
            <button type="button" onClick={() => downloadQr("svg")} className="rounded-lg border border-line px-3 py-1.5 text-xs">SVG (인쇄용)</button>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-slate-600">소개 페이지 주소</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <a href={url || "/company"} target="_blank" rel="noreferrer" className="break-all font-mono text-primary underline underline-offset-2">{url || "/company"}</a>
            <button type="button" onClick={copyUrl} className="rounded-lg border border-line px-2 py-1 text-xs">복사</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">명함 인쇄소에는 SVG 파일을 주면 크기를 키워도 깨지지 않습니다. PNG는 카카오톡·문자로 보낼 때 씁니다. QR 크기는 명함에서 가로세로 1.5cm 이상이 좋습니다.</p>
          <label className="mt-3 block"><span className="text-slate-600">한 줄 소개 <span className="text-slate-400">(상호 아래에 표시)</span></span>
            <div className="mt-1 flex gap-2"><input value={intro} onChange={(e) => setIntro(e.target.value)} className={inputCls + " mt-0"} placeholder="예) 콘크리트 수로관·맨홀 전문 생산업체 (KS 인증)" maxLength={300} /><button type="button" onClick={() => savePage({ intro })} className="shrink-0 rounded-xl border border-line px-3 text-sm">저장</button></div>
          </label>
          <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={page?.showProducts !== false} onChange={(e) => savePage({ showProducts: e.target.checked })} className="h-4 w-4 accent-primary" /><span>생산품목 보이기 (재고관리 품목 목록 기준)</span></label>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(["승인서", "카탈로그", "기타"] as const).map((k) => (
          <form key={k} onSubmit={(e) => upload(e, k)} className={`rounded-xl border p-3 ${kind === k ? "border-primary bg-primary-soft/40" : "border-line bg-slate-50/60"}`} onFocus={() => setKind(k)}>
            <div className="text-sm font-semibold">{kindLabel[k]} 올리기</div>
            <div className="text-[11px] text-slate-500">{k === "승인서" ? "누르면 바로 내려받아지는 서류" : k === "카탈로그" ? "브라우저에서 열어 보는 제품 카탈로그" : "그 밖에 보여 줄 자료"} · PDF·PNG·JPG 20MB 이하</div>
            <input value={kind === k ? title : ""} onChange={(e) => { setKind(k); setTitle(e.target.value); }} className={inputCls + " mt-2"} placeholder={k === "승인서" ? "표시 이름 (예: 공급원승인서 2026)" : k === "카탈로그" ? "표시 이름 (예: 제품 카탈로그 2026)" : "표시 이름"} />
            <input ref={(el) => { fileRefs.current[k] = el; }} type="file" accept="application/pdf,image/png,image/jpeg" onChange={() => setKind(k)} className="mt-2 w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5" />
            <button type="submit" disabled={busy} className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy && kind === k ? "올리는 중…" : `${kindLabel[k]}로 올리기`}</button>
          </form>
        ))}
      </div>
      {msg && <div className={`mt-2 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</div>}

      <ul className="mt-3 divide-y divide-line">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm sm:flex-nowrap sm:gap-3">
            <select value={f.kind} onChange={(e) => changeFile(f, { kind: e.target.value })} title="종류 바꾸기" className="rounded-md border border-line bg-primary-soft px-1.5 py-0.5 text-xs text-primary"><option value="승인서">공급원승인서</option><option value="카탈로그">카탈로그</option><option value="기타">기타 자료</option></select>
            <a href={`/api/public/files/${f.id}?view=1`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{f.title}</a>
            <button type="button" onClick={() => { const t = window.prompt("표시 이름을 바꿉니다", f.title); if (t && t.trim() && t.trim() !== f.title) changeFile(f, { title: t.trim() }); }} className="text-xs text-slate-500 hover:text-primary">이름 바꾸기</button>
            <span className="text-xs text-slate-500">{fmtSize(f.size)} · {f.uploadedAt.slice(0, 10)}</span>
            <button type="button" onClick={() => remove(f)} className="text-xs text-red-600">삭제</button>
          </li>
        ))}
        {page && !files.length && <li className="py-3 text-center text-sm text-slate-400">아직 올린 파일이 없습니다. 공급원승인서와 카탈로그 PDF를 올려 주세요.</li>}
        {files.length > 0 && <li className="pt-2 text-[11px] text-slate-400">종류를 잘못 골랐으면 왼쪽 종류 칸에서 바꾸면 됩니다. 다시 올릴 필요 없습니다.</li>}
      </ul>
    </Card>
  );
}
