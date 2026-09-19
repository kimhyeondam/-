"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { dispatchSteps, type Dispatch, type DispatchStatus } from "@/data/sample";
import { deliverUrl, smsBody, smsHref, statusBadge } from "./dispatchMeta";

/** 배차 상세: 링크 보내기(문자·복사·QR·카드 이미지), 상태·사진 확인 */
export default function DispatchDetail({ d, company, onClose, onEdit, onStatus, onDelete }: { d: Dispatch; company: string; onClose: () => void; onEdit: () => void; onStatus: (s: DispatchStatus) => void; onDelete: () => void }) {
  const url = deliverUrl(d.token);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsPhone(/Android|iPhone|iPad/i.test(navigator.userAgent)); }, []);
  async function copyMessage() {
    const text = smsBody(company, d, url);
    try { await navigator.clipboard.writeText(text); setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000); } catch { window.prompt("문자 내용을 복사하세요", text); }
  }
  useEffect(() => { QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => {}); }, [url]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("링크를 복사하세요", url); }
  }
  /** 회사 이름·납품 정보·QR이 들어간 카드 이미지를 만들어 저장/공유 (카카오톡 등으로 보낼 때) */
  async function shareCard() {
    const c = document.createElement("canvas"); c.width = 900; c.height = 640;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#171717"; ctx.fillRect(0, 0, c.width, 96);
    ctx.fillStyle = "#fff"; ctx.font = "bold 36px sans-serif"; ctx.fillText(`${company} 납품 배차`, 36, 62);
    ctx.fillStyle = "#171717"; ctx.font = "bold 34px sans-serif"; ctx.fillText(`${d.customer}`, 36, 160);
    ctx.font = "26px sans-serif"; ctx.fillStyle = "#4d4d4d";
    const lines = [d.site ? `현장: ${d.site}` : "", d.address ? `주소: ${d.address}` : "", `납품일: ${d.date}`, `차량: ${d.vehicle}`, `기사: ${d.driver}${d.driverPhone ? ` (${d.driverPhone})` : ""}`, ...d.items.map((i) => `• ${i.name}${i.spec ? ` ${i.spec}` : ""}  ${i.qty}${i.unit}`), d.memo ? `메모: ${d.memo}` : ""].filter(Boolean);
    lines.slice(0, 10).forEach((l, i) => ctx.fillText(l.length > 40 ? l.slice(0, 40) + "…" : l, 36, 210 + i * 38));
    if (qr) { const img = new Image(); await new Promise<void>((res) => { img.onload = () => res(); img.src = qr; }); ctx.drawImage(img, c.width - 260, 130, 220, 220); ctx.fillStyle = "#4d4d4d"; ctx.font = "20px sans-serif"; ctx.fillText("QR을 찍으면 납품 확인 화면", c.width - 268, 380); }
    ctx.fillStyle = "#a1a1a1"; ctx.font = "18px sans-serif"; ctx.fillText(url, 36, c.height - 28);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
    if (!blob) return;
    const file = new File([blob], `배차_${d.date}_${d.customer}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: "납품 배차", text: smsBody(company, d, url) }); return; } catch { /* 취소 */ } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  }
  const idx = dispatchSteps.indexOf(d.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-800">{d.customer}</h2><span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge[d.status]}`}>{d.status}</span></div>
            <div className="text-sm text-slate-500">{d.date}{d.site ? ` · ${d.site}` : ""}{d.docNumber ? ` · ${d.docNumber}` : ""}</div>
            <div className="text-sm text-slate-600 mt-1">🚚 {d.vehicle} · {d.driver}{d.driverPhone ? ` (${d.driverPhone})` : ""}{(d.carrier ?? (d.own ? "자차" : "용차")) === "자차" ? "" : ` · ${d.carrier ?? "용차"}`}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {d.items.map((it, i) => <li key={i} className="flex justify-between px-3 py-2"><span>{it.name}{it.spec ? <span className="text-slate-400"> {it.spec}</span> : ""}</span><b>{it.qty.toLocaleString("ko-KR")} {it.unit}</b></li>)}
        </ul>
        {d.memo && <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">📝 {d.memo}</div>}

        <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-4">
          <div className="text-sm font-semibold text-slate-800">기사님께 링크 보내기</div>
          <p className="text-xs text-slate-500 mt-0.5">기사님은 로그인 없이 이 링크에서 상차·출발·도착·인수 버튼을 누르고 사진을 올립니다.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
            {qr && <img src={qr} alt="QR" className="h-28 w-28 rounded-lg border border-line bg-white p-1 self-start" />}
            <div className="flex flex-wrap gap-2">
              {isPhone ? (
                <a href={smsHref(d.driverPhone, smsBody(company, d, url))} className="rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark">문자로 보내기</a>
              ) : (
                <button onClick={copyMessage} className="rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark">{copiedMsg ? "문자 내용 복사됨 ✓" : "문자 내용 복사"}</button>
              )}
              <button onClick={copy} className="rounded-full border border-line bg-white text-sm px-4 py-2 text-slate-700 hover:border-primary hover:text-primary">{copied ? "복사됨 ✓" : "링크 복사"}</button>
              <button onClick={shareCard} className="rounded-full border border-line bg-white text-sm px-4 py-2 text-slate-700 hover:border-primary hover:text-primary">카드 이미지로 공유</button>
              <a href={url} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white text-sm px-4 py-2 text-slate-700 hover:border-primary hover:text-primary">기사 화면 열기</a>
            </div>
          </div>
          <div className="mt-2 break-all text-[11px] text-slate-400">{url}</div>
          {!isPhone && <p className="mt-2 text-[11px] text-slate-500">컴퓨터에서는 문자 앱이 없어 바로 발송되지 않습니다. 「문자 내용 복사」 뒤 카카오톡 PC나 휴대폰 문자에 붙여넣거나, 휴대폰으로 이 화면을 열어 「문자로 보내기」를 누르세요.</p>}
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-800">진행</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dispatchSteps.map((s, i) => (
              <button key={s} onClick={() => onStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${i <= idx && d.status !== "취소" ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-line hover:border-primary"}`}>{i + 1}. {s}</button>
            ))}
            <button onClick={() => onStatus("취소")} className={`rounded-full border px-3 py-1 text-xs ${d.status === "취소" ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200"}`}>취소</button>
          </div>
          {d.log.length > 0 && <ul className="mt-2 text-xs text-slate-500 space-y-0.5">{d.log.map((l, i) => <li key={i}>{l.at.slice(5, 16).replace("T", " ")} {l.status}{l.by ? ` · ${l.by}` : ""}</li>)}</ul>}
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-800">사진 <span className="text-xs font-normal text-slate-400">{d.photos.length}장</span></div>
          {d.photos.length === 0 ? <p className="mt-1 text-xs text-slate-400">아직 올라온 사진이 없습니다. 기사님이 링크에서 올리면 여기에 보입니다.</p> : (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {d.photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-line">
                  <button onClick={() => setBig(p.image)} className="block w-full"><img src={p.image} alt={p.kind} className="aspect-[4/3] w-full object-cover" /></button>
                  <figcaption className="px-2 py-1 text-[11px] text-slate-500">{p.kind} · {p.at.slice(5, 16).replace("T", " ")}{p.note ? ` · ${p.note}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>
          <div className="flex gap-2"><button onClick={onEdit} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary">수정</button><button onClick={onClose} className="rounded-full bg-primary text-white px-5 py-2 text-sm font-semibold">닫기</button></div>
        </div>
      </div>
      {big && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)}><img src={big} alt="" className="max-h-full max-w-full rounded-xl" /></div>}
    </div>
  );
}
