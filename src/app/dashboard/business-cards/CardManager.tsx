"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMembers } from "@/lib/useMembers";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { todayIso } from "@/lib/format";
import { resizeImageToBase64 } from "@/lib/imageResize";
import { businessCards as initialCards, customers as initialCustomers, type BusinessCard, type Customer } from "@/data/sample";
import CardForm, { type CardInput } from "./CardForm";
import { newId } from "@/lib/ids";

export default function CardManager() {
  const [items, setItems, loaded, loadError] = useServerState<BusinessCard[]>("businessCards", initialCards);
  const [customers, setCustomers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BusinessCard | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 담당자별 보기: 관리자는 전체·미지정·직원별 탭, 직원은 서버가 자기 명함만 내려주므로 탭 없음
  const [me, setMe] = useState<{ id?: string; name?: string; role?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  const isAdmin = me?.role === "관리자";
  const members = useMembers();
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of items) if (c.ownerId) m.set(c.ownerId, c.ownerName ?? c.ownerId);
    for (const x of members) if (m.has(x.id)) m.set(x.id, x.name);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [items, members]);
  const ownerOptions = useMemo(() => { const m = new Map(members.map((x) => [x.id, x.name])); for (const o of owners) if (!m.has(o.id)) m.set(o.id, o.name); return [...m.entries()].map(([id, name]) => ({ id, name })); }, [members, owners]);
  const [ownerTab, setOwnerTab] = useState<string>("all"); // all | none | ownerId
  const [assignTo, setAssignTo] = useState("");
  const unassigned = items.filter((c) => !c.ownerId).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter((c) => !isAdmin || ownerTab === "all" || (ownerTab === "none" ? !c.ownerId : c.ownerId === ownerTab))
      .filter((c) => !q || [c.name, c.company, c.title ?? "", c.email ?? "", c.phone ?? "", c.mobile ?? "", c.memo ?? "", c.ownerName ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query, isAdmin, ownerTab]);

  /** 지금 보이는 명함(미지정 탭 또는 특정 담당자 탭)을 다른 직원에게 한꺼번에 넘깁니다 */
  function assignVisible() {
    const o = ownerOptions.find((x) => x.id === assignTo); if (!o) return;
    const ids = new Set(filtered.map((c) => c.id));
    setItems((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, ownerId: o.id, ownerName: o.name } : c)));
    flash(`명함 ${ids.size}건의 담당자를 ${o.name}(으)로 지정했습니다.`);
    setAssignTo(""); setOwnerTab(o.id);
  }

  const companies = new Set(items.map((c) => c.company.trim()));
  const manual = items.filter((c) => c.source === "수기").length;
  const isCustomer = (company: string) => customers.some((c) => c.name === company);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }
  function add(data: CardInput) {
    // 담당자를 고르지 않았으면 등록한 사람이 담당자 (직원은 서버에서도 본인으로 고정)
    const owner = data.ownerId ? {} : { ownerId: me?.id, ownerName: me?.name };
    setItems((prev) => [{ ...data, ...owner, id: newId("bc"), createdAt: todayIso() }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: CardInput) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setEditing(null);
  }
  function remove(c: BusinessCard) {
    if (!confirm(`${c.name} (${c.company}) 명함을 삭제할까요?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    setMenuFor(null);
  }
  /** 사진을 올리면 AI가 읽어서 바로 저장하고, 확인·수정 창을 엽니다. */
  async function scan(file: File) {
    setScanError(null);
    setScanning(true);
    try {
      const { base64, mediaType } = await resizeImageToBase64(file);
      const res = await fetch("/api/business-cards/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mediaType }) });
      const data = (await res.json()) as { card?: Record<string, string>; error?: string };
      if (!res.ok || !data.card) throw new Error(data.error ?? "인식에 실패했습니다.");
      const c = data.card;
      if (!c.name && !c.company) throw new Error("사진에서 이름이나 회사명을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.");
      const clean = (v?: string) => v?.trim() || undefined;
      const card: BusinessCard = {
        id: newId("bc"),
        name: c.name?.trim() || "(이름 미확인)",
        company: c.company?.trim() || "(회사 미확인)",
        title: clean(c.title), mobile: clean(c.mobile), phone: clean(c.phone), email: clean(c.email), address: clean(c.address),
        source: "스캔",
        memo: c.confidence === "low" ? "AI 인식 신뢰도 낮음 · 내용을 확인하세요" : undefined,
        ownerId: me?.id, ownerName: me?.name,
        createdAt: todayIso(),
      };
      setItems((prev) => [card, ...prev]);
      setEditing(card);
      flash("명함 사진을 읽어 저장했습니다. 내용이 맞는지 확인해 주세요.");
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** 명함의 회사를 고객관리에 등록 */
  function toCustomer(c: BusinessCard) {
    setMenuFor(null);
    if (isCustomer(c.company)) return flash(`${c.company}은(는) 이미 고객으로 등록되어 있습니다.`);
    setCustomers((prev) => [{ id: newId("c"), name: c.company, ceo: undefined, phone: c.phone ?? c.mobile, email: c.email, address: c.address, memo: `명함에서 등록 (담당자 ${c.name}${c.title ? ` ${c.title}` : ""})`, createdAt: todayIso() }, ...prev]);
    flash(`${c.company}을(를) 고객관리에 등록했습니다.`);
  }

  return (
    <>
      <PageHeader
        title="명함관리"
        description={isAdmin ? "받은 명함을 담당자별로 보관합니다. 관리자는 전체를, 직원은 자기 담당 명함만 봅니다." : "내가 받은 명함을 보관합니다. 다른 직원의 명함은 보이지 않고, 관리자만 전체를 봅니다."}
        action={
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) scan(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary disabled:opacity-60 transition">
              {scanning ? "인식 중..." : "📷 사진으로 추가"}
            </button>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 명함추가</button>
          </div>
        }
      />
      {notice && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{notice}</div>}
      {scanning && <div className="rounded-xl bg-primary-soft border border-primary/20 px-4 py-3 text-sm text-primary">사진을 읽고 있습니다. 잠시만 기다려 주세요...</div>}
      {scanError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
          <span>{scanError}</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setAdding(true)} className="rounded-full bg-white border border-amber-300 px-3 py-1 text-xs hover:bg-amber-100">직접 입력</button>
            <button onClick={() => setScanError(null)} className="text-xs text-amber-700 hover:underline">닫기</button>
          </div>
        </div>
      )}
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label={isAdmin ? "등록 명함" : "내 명함"} value={`${items.length}건`} sub={isAdmin ? `담당자 ${owners.length}명${unassigned ? ` · 미지정 ${unassigned}건` : ""}` : "내가 담당자인 명함"} icon="▬" />
            <StatCard label="수기 입력" value={`${manual}건`} sub="직접 입력으로 등록된 명함" icon="✎" highlight />
            <StatCard label="회사 수" value={`${companies.size}곳`} sub="중복 제외 회사 기준" icon="▣" tone="green" />
          </div>

          <Card className="p-4 space-y-3">
            <div className="relative max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 회사명, 직책, 이메일, 전화번호 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {[{ key: "all", label: "전체", n: items.length }, ...(unassigned ? [{ key: "none", label: "미지정", n: unassigned }] : []), ...owners.map((o) => ({ key: o.id, label: o.name, n: items.filter((c) => c.ownerId === o.id).length }))].map((t) => (
                  <button key={t.key} type="button" onClick={() => setOwnerTab(t.key)} className={`rounded-full border px-3 py-1.5 text-sm transition ${ownerTab === t.key ? "border-primary bg-primary text-white" : "border-line bg-white text-slate-700 hover:border-primary"}`}>{t.label} <span className={`text-xs ${ownerTab === t.key ? "text-white/70" : "text-slate-400"}`}>{t.n}</span></button>
                ))}
                {ownerTab !== "all" && filtered.length > 0 && (
                  <div className="ml-auto flex items-center gap-1.5 text-sm">
                    <span className="text-slate-500">{ownerTab === "none" ? "이 명함들의 담당자를" : "이 담당자의 명함을"}</span>
                    <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-primary">
                      <option value="">직원 선택</option>
                      {ownerOptions.filter((o) => o.id !== ownerTab).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <button type="button" disabled={!assignTo} onClick={assignVisible} className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{ownerTab === "none" ? "지정" : "넘기기"}</button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-12 text-center text-sm text-slate-400">표시할 명함이 없습니다.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" onClick={() => setMenuFor(null)}>
              {filtered.map((c) => (
                <Card key={c.id} className="p-5 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800">{c.name}</span>
                        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-slate-500">{c.source}입력</span>
                        {isCustomer(c.company) && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary">고객</span>}
                        {isAdmin && <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.ownerName ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-500"}`}>{c.ownerName ? `담당 ${c.ownerName}` : "담당 미지정"}</span>}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{c.company}</div>
                      {c.title && <div className="text-sm text-slate-500">{c.title}</div>}
                    </div>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="메뉴">⋯</button>
                      {menuFor === c.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-line bg-card shadow-lg py-1 text-sm">
                          <button onClick={() => { setEditing(c); setMenuFor(null); }} className="block w-full px-4 py-2 text-left hover:bg-primary-soft">수정</button>
                          <button onClick={() => toCustomer(c)} className="block w-full px-4 py-2 text-left hover:bg-primary-soft">고객으로 등록</button>
                          <button onClick={() => remove(c)} className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50">삭제</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                    {c.email && <li className="flex items-center gap-2"><span className="text-slate-400">✉</span><a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a></li>}
                    {c.mobile && <li className="flex items-center gap-2"><span className="text-slate-400">📱</span><a href={`tel:${c.mobile}`} className="hover:text-primary">{c.mobile}</a></li>}
                    {c.phone && <li className="flex items-center gap-2"><span className="text-slate-400">☎</span><a href={`tel:${c.phone}`} className="hover:text-primary">{c.phone}</a></li>}
                    {c.address && <li className="flex items-center gap-2"><span className="text-slate-400">⌖</span>{c.address}</li>}
                  </ul>
                  {c.memo && <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-slate-500">{c.memo}</div>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {adding && <CardForm owners={isAdmin ? ownerOptions : undefined} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <CardForm initial={editing} owners={isAdmin ? ownerOptions : undefined} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} />}
    </>
  );
}
