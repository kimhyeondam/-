"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import ResetSampleCard from "./ResetSampleCard";
import AppearanceCard from "./AppearanceCard";
import QrCard from "./QrCard";
import { useServerState } from "@/lib/useServerState";
import { companyProfile as defaults, type CompanyProfile } from "@/data/sample";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const MAX_LOGO_BYTES = 400 * 1024;

type Settings = { company?: Partial<CompanyProfile>; photos?: { retentionYears?: number } };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    r.readAsDataURL(file);
  });
}

export default function SettingsForm({ storeKind, hasAiKey }: { storeKind: string; hasAiKey: boolean }) {
  const router = useRouter();
  const [settings, setSettings, loaded, loadError] = useServerState<Settings>("settings", {});
  const [form, setForm] = useState<CompanyProfile>(defaults);
  const [saved, setSaved] = useState<string | null>(null);
  const [retention, setRetention] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const markRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (loaded) { setForm({ ...defaults, ...(settings.company ?? {}) }); setRetention(settings.photos?.retentionYears ?? 3); }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof CompanyProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function pickImage(file: File | undefined, key: "logo" | "logoMark") {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setError("로고는 PNG 또는 JPG 파일만 올릴 수 있습니다.");
    if (file.size > MAX_LOGO_BYTES) return setError("로고 파일은 400KB 이하로 올려 주세요. (그림판이나 포토샵에서 크기를 줄이세요)");
    setError(null);
    setForm({ ...form, [key]: await readAsDataUrl(file) });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("상호를 입력하세요.");
    setSettings({ ...settings, company: { ...form, name: form.name.trim() }, photos: { ...(settings.photos ?? {}), retentionYears: Math.max(1, Math.round(Number(retention) || 3)) } });
    setSaved("저장했습니다. 왼쪽 메뉴·로그인 화면·문서 머리글에 바로 반영됩니다.");
    setTimeout(() => { setSaved(null); router.refresh(); }, 1200);
  }

  function resetLogo() { setForm({ ...form, logo: defaults.logo, logoMark: defaults.logoMark }); }

  return (
    <>
      <PageHeader title="시스템 설정" description="회사 정보와 로고를 관리합니다. 여기 입력한 내용이 견적서·거래명세표·납품확인서의 공급자 칸과 메뉴 상단에 표시됩니다." />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="데이터 저장소" value={storeKind === "postgres" ? "PostgreSQL" : "파일"} sub={storeKind === "postgres" ? "DATABASE_URL 연결됨" : "서버 data 폴더"} icon="▥" />
            <StatCard label="AI 비서" value={hasAiKey ? "Claude 연결" : "내장 비서"} sub={hasAiKey ? "ANTHROPIC_API_KEY 설정됨" : "API 키를 넣으면 Claude 사용"} icon="✦" highlight={hasAiKey} />
            <StatCard label="로고" value={form.logo ? "등록됨" : "없음"} sub="가로형 로고 (메뉴·문서)" icon="▣" />
            <StatCard label="심볼" value={form.logoMark ? "등록됨" : "없음"} sub="정사각 심볼 (로그인·접힌 메뉴)" icon="◉" />
          </div>

          <Card className="p-6 space-y-4">
            <h2 className="font-bold text-slate-800">회사 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="text-slate-600">상호 *</span><input value={form.name} onChange={set("name")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">대표자</span><input value={form.ceo} onChange={set("ceo")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">약칭 <span className="text-slate-400">(비서 이름 「약칭비서」·로그인 글자)</span></span><input value={form.shortName ?? ""} onChange={set("shortName")} className={inputCls} placeholder="예) 현담 → 현담비서" /></label>
              <label className="block text-sm"><span className="text-slate-600">인사말 호칭 <span className="text-slate-400">(대시보드 「안녕하세요, ○○」)</span></span><input value={form.ownerName ?? ""} onChange={set("ownerName")} className={inputCls} placeholder="예) 대표님" /></label>
              <label className="block text-sm"><span className="text-slate-600">사업자등록번호</span><input value={form.bizNo} onChange={set("bizNo")} className={inputCls} placeholder="000-00-00000" /></label>
              <label className="block text-sm"><span className="text-slate-600">대표 이메일</span><input type="email" value={form.email ?? ""} onChange={set("email")} className={inputCls} /></label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">주소</span><input value={form.address} onChange={set("address")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">전화</span><input value={form.phone} onChange={set("phone")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">팩스</span><input value={form.fax ?? ""} onChange={set("fax")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">업태</span><input value={form.bizType ?? ""} onChange={set("bizType")} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">종목</span><input value={form.bizItem ?? ""} onChange={set("bizItem")} className={inputCls} /></label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">입금 계좌 <span className="text-slate-400">(견적서·거래명세표에 표시)</span></span><input value={form.bank ?? ""} onChange={set("bank")} className={inputCls} placeholder="예) 농협 000-0000-0000-00 (예금주 현담토목)" /></label>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <div>
              <h2 className="font-bold text-slate-800">납품 사진 보관</h2>
              <p className="mt-1 text-xs text-slate-500">기사님이 올린 상차·인수 사진은 서버의 사진 폴더에 파일로 저장되고 매일 백업됩니다. 아래 기간이 지난 배차의 사진은 하루 한 번 자동으로 지워집니다(배차 기록 자체는 남습니다).</p>
            </div>
            <label className="block text-sm w-48"><span className="text-slate-600">보관 기간 (년)</span><input type="number" min={1} max={30} value={retention} onChange={(e) => setRetention(Number(e.target.value))} className={inputCls} /></label>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">로고</h2>
              <button type="button" onClick={resetLogo} className="text-xs text-slate-500 hover:text-primary">기본 로고로 되돌리기</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-slate-600">가로형 로고 <span className="text-slate-400">(메뉴 상단, 문서 머리글)</span></div>
                <div className="mt-2 flex h-24 items-center justify-center rounded-xl border border-dashed border-line bg-white p-3">
                  {form.logo ? <img src={form.logo} alt="로고" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">로고 없음</span>}
                </div>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], "logo")} />
                <button type="button" onClick={() => logoRef.current?.click()} className="mt-2 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">파일 선택 (PNG/JPG, 400KB 이하)</button>
              </div>
              <div>
                <div className="text-sm text-slate-600">심볼 로고 <span className="text-slate-400">(로그인 화면, 메뉴 접었을 때)</span></div>
                <div className="mt-2 flex h-24 items-center justify-center rounded-xl border border-dashed border-line bg-white p-3">
                  {form.logoMark ? <img src={form.logoMark} alt="심볼" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">심볼 없음</span>}
                </div>
                <input ref={markRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], "logoMark")} />
                <button type="button" onClick={() => markRef.current?.click()} className="mt-2 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">파일 선택 (PNG/JPG, 400KB 이하)</button>
              </div>
            </div>
            <p className="text-xs text-slate-400">로고 원본(.ai)에서 뽑은 가로형·심볼 이미지가 기본으로 들어 있습니다. 바꾸고 싶을 때만 올리면 됩니다.</p>
          </Card>

          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {saved && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{saved}</div>}
          <div className="flex justify-end">
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-6 py-2.5 text-sm font-semibold text-white shadow-sm">저장</button>
          </div>
        </form>
      )}
      {loaded && <><QrCard /><AppearanceCard /><ResetSampleCard /></>}
    </>
  );
}
