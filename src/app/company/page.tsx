// 명함 QR 코드로 여는 회사 소개 페이지 (로그인 없이 누구나). DESIGN.md 토큰만 사용.
// 구성: ① 소개(제목·서류 단추·제품 사진) ② 서류 내려받기 ③ 생산품목(분류 타일 + 규격 목록) ④ 연락처·공장
import type { Metadata } from "next";
import { loadCompany } from "@/lib/branding";
import { readPublicPage } from "@/lib/publicPage";
import { getStore } from "@/lib/store";
import { serverProfile } from "@/lib/bids/regions";
import type { Product } from "@/data/sample";
import OpenOnHash from "./OpenOnHash";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await loadCompany();
  return { title: `${c.name} 회사 소개`, description: `${c.name} 공급원승인서 · 제품 카탈로그 · 생산품목` };
}

async function loadProducts(): Promise<Product[]> {
  try {
    const row = await getStore().get<Product[]>("products");
    if (row && Array.isArray(row.data)) return row.data;
  } catch { /* 저장소 오류면 빈 목록 */ }
  return [];
}

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
/** 분류 표시 순서 (여기 없는 분류는 뒤에 가나다순) */
const CATEGORY_ORDER = ["흄관", "PC맨홀", "맨홀 부속자재", "측구", "집수정", "경계석", "옹벽블록"];

const pill = "inline-flex items-center justify-center rounded-full font-medium transition-colors";
const pillP = `${pill} bg-primary text-white hover:bg-primary-dark`;
const pillS = `${pill} border border-line bg-white text-slate-900 hover:border-slate-300`;
const mono = "font-mono text-xs leading-4 tracking-normal text-slate-600";

export default async function CompanyPage() {
  const [c, page] = await Promise.all([loadCompany(), readPublicPage()]);
  const showProducts = page.showProducts !== false;
  const products = showProducts ? await loadProducts() : [];
  const files = page.files ?? [];
  const approvals = files.filter((f) => f.kind === "승인서");
  const catalogs = files.filter((f) => f.kind === "카탈로그");
  const others = files.filter((f) => f.kind === "기타");
  const region = serverProfile().label;

  // 분류 → 품명 → 규격들
  const groups = new Map<string, Map<string, string[]>>();
  for (const p of products) {
    const g = groups.get(p.category || "기타") ?? new Map<string, string[]>();
    const specs = g.get(p.name) ?? []; if (p.spec && !specs.includes(p.spec)) specs.push(p.spec);
    g.set(p.name, specs); groups.set(p.category || "기타", g);
  }
  const categories = [...groups.keys()].sort((a, b) => { const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "ko"); });
  const countOf = (cat: string) => products.filter((p) => (p.category || "기타") === cat).length;

  const tel = (c.phone ?? "").replace(/[^0-9+]/g, "");
  const mapUrl = c.address ? `https://map.naver.com/p/search/${encodeURIComponent(c.address)}` : "";
  const sites = c.address ? [{ name: "본사·공장", address: c.address }] : [];
  const headline = ["현장이 믿고 쓰는", c.bizItem || "콘크리트 제품"];
  const lead = page.intro || `${c.bizItem || "콘크리트 제품"}을 KS 규격으로 직접 생산해 ${region} 현장에 바로 납품합니다.`;
  const firstApproval = approvals[0]; const firstCatalog = catalogs[0];

  return (
    <main className="min-h-screen bg-[var(--background)] text-slate-900">
      <OpenOnHash />
      {/* 상단 띠 */}
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-10">
          <a href="#top" className="flex items-center gap-2.5 font-semibold">
            {c.logoMark ? <img src={c.logoMark} alt="" className="h-7 w-7 object-contain" /> : <span aria-hidden className="inline-block h-7 w-7 rounded-lg bg-primary" />}
            <span>{c.name}</span>
          </a>
          {tel && <a href={`tel:${tel}`} className={`${pillS} h-9 px-4 text-sm`}>{c.phone}</a>}
        </div>
      </header>

      {/* ① 소개 */}
      <section id="top" className="rise mx-auto max-w-[1120px] px-5 py-12 sm:px-10 sm:py-24">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_.9fr] md:gap-16">
          <div>
            <div className={mono}>{[c.bizItem || "콘크리트 제품", "제조", c.address ? c.address.split(" ").slice(0, 2).join(" ") : region].filter(Boolean).join(" · ")}</div>
            <h1 className="mt-4 text-[32px] font-semibold leading-10 tracking-[-1.28px] sm:text-5xl sm:leading-[48px] sm:tracking-[-2.4px]">{headline[0]}<br />{headline[1]}</h1>
            <p className="mt-6 text-lg leading-7 text-slate-600" style={{ letterSpacing: 0 }}>{lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {firstApproval ? <a href={`/api/public/files/${firstApproval.id}`} download={firstApproval.fileName} className={`${pillP} h-12 px-6 text-base`}>공급원승인서 내려받기</a> : <a href="#docs" className={`${pillP} h-12 px-6 text-base`}>서류 보기</a>}
              {firstCatalog ? <a href={`/api/public/files/${firstCatalog.id}?view=1`} target="_blank" rel="noreferrer" className={`${pillS} h-12 px-6 text-base`}>카탈로그 보기</a> : <a href="#products" className={`${pillS} h-12 px-6 text-base`}>생산품목 보기</a>}
            </div>
            <div className="mt-10 flex flex-col gap-2 text-sm leading-5 text-slate-600 sm:flex-row sm:flex-wrap sm:gap-6">
              {c.phone && <span>전화 <a href={`tel:${tel}`} className="font-medium text-slate-900">{c.phone}</a></span>}
              {c.email && <span>이메일 <a href={`mailto:${c.email}`} className="font-medium text-slate-900">{c.email}</a></span>}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            {c.logo ? <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 p-10"><img src={c.logo} alt={c.name} className="max-h-full max-w-full object-contain" /></div> : <div className="flex aspect-[4/3] items-center justify-center bg-slate-50 text-6xl font-semibold text-slate-300">{c.name[0]}</div>}
          </div>
        </div>
      </section>

      {/* ② 서류 */}
      <section id="docs" className="rise border-t border-line">
        <div className="mx-auto grid max-w-[1120px] gap-6 px-5 py-16 sm:px-10 sm:py-24 md:grid-cols-[280px_1fr] md:gap-12">
          <div>
            <div className={mono}>서류</div>
            <h2 className="mt-2 text-[32px] font-semibold leading-10 tracking-[-1.28px]">바로 내려받기</h2>
            <p className="mt-3 text-sm leading-5 text-slate-600">누르면 바로 내려받아집니다. 다른 서류가 필요하면 전화 주세요.</p>
          </div>
          <ul>
            {[...approvals, ...others].map((f) => (
              <li key={f.id} className="flex flex-col gap-3 border-t border-line py-6 last:border-b sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div><div className="text-base font-medium leading-6">{f.title}</div><div className={`${mono} mt-1`}>{f.type === "application/pdf" ? "PDF" : "이미지"} · {fmtSize(f.size)} · {f.uploadedAt.slice(0, 7)}</div></div>
                <a href={`/api/public/files/${f.id}`} download={f.fileName} className={`${pillP} h-9 shrink-0 px-4 text-sm`}>내려받기</a>
              </li>
            ))}
            {catalogs.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 border-t border-line py-6 last:border-b sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div><div className="text-base font-medium leading-6">{f.title}</div><div className={`${mono} mt-1`}>{f.type === "application/pdf" ? "PDF" : "이미지"} · {fmtSize(f.size)} · {f.uploadedAt.slice(0, 7)}</div></div>
                <div className="flex shrink-0 gap-2"><a href={`/api/public/files/${f.id}?view=1`} target="_blank" rel="noreferrer" className={`${pillS} h-9 px-4 text-sm`}>열기</a><a href={`/api/public/files/${f.id}`} download={f.fileName} className={`${pillP} h-9 px-4 text-sm`}>저장</a></div>
              </li>
            ))}
            {files.length === 0 && <li className="border-y border-line py-6 text-sm text-slate-500">서류를 준비하고 있습니다. 필요하시면 전화로 요청해 주세요.</li>}
          </ul>
        </div>
      </section>

      {/* ③ 생산품목 */}
      {showProducts && (
        <section id="products" className="rise border-t border-line">
          <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-10 sm:py-24">
            <div className="grid gap-4 md:grid-cols-[280px_1fr] md:items-end md:gap-12">
              <div><div className={mono}>생산품목</div><h2 className="mt-2 text-[32px] font-semibold leading-10 tracking-[-1.28px]">{categories.length}개 분류<br />{products.length}개 규격</h2></div>
              <p className="text-sm leading-5 text-slate-600">분류를 누르면 아래에 규격 목록이 펼쳐집니다.</p>
            </div>
            {categories.length === 0 ? (
              <div className="mt-10 rounded-2xl bg-slate-50 p-12 text-center text-base text-slate-500">등록된 생산품목이 없습니다.</div>
            ) : (
              <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
                {categories.map((cat, i) => {
                  const last = i === categories.length - 1 && categories.length % 2 === 1;
                  return (
                    <a key={cat} href={`#spec-${encodeURIComponent(cat)}`} className={`group block bg-white p-4 sm:p-5 ${last ? "col-span-2 md:col-span-1" : ""}`}>
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
                        <span className={mono}>{cat}</span>
                      </div>
                      <div className="mt-4 text-base font-medium leading-6">{cat}</div>
                      <div className="text-sm leading-5 text-slate-500">{countOf(cat)}개 규격</div>
                    </a>
                  );
                })}
              </div>
            )}
            {categories.length > 0 && (
              <div className="mt-12">
                <div className={mono}>규격 목록</div>
                <div className="mt-2 border-t border-line">
                  {categories.map((cat) => (
                    <details key={cat} id={`spec-${cat}`} className="group border-b border-line">
                      <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-base font-medium leading-6 [&::-webkit-details-marker]:hidden">
                        <span>{cat} <span className="ml-2 text-sm font-normal text-slate-500">{countOf(cat)}개 규격</span></span>
                        <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-45">＋</span>
                      </summary>
                      <ul className="grid gap-x-8 pb-6 sm:grid-cols-2">
                        {[...groups.get(cat)!.entries()].map(([name, specs]) => (
                          <li key={name} className="border-t border-line py-3 text-sm leading-5"><div className="font-medium">{name}</div>{specs.length > 0 && <div className="mt-0.5 text-slate-500">{specs.join(" · ")}</div>}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ④ 연락처·공장 */}
      <section id="contact" className="rise border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-10 sm:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <div className={mono}>연락처</div>
              {c.phone && <a href={`tel:${tel}`} className="mt-2 block text-[32px] font-semibold leading-10 tracking-[-1.28px]">{c.phone}</a>}
              <dl className="mt-6 grid grid-cols-[96px_1fr] gap-x-4 gap-y-2 text-sm leading-5">
                {c.email && <><dt className="text-slate-500">이메일</dt><dd><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></dd></>}
                {c.fax && <><dt className="text-slate-500">팩스</dt><dd>{c.fax}</dd></>}
                {c.bizNo && <><dt className="text-slate-500">사업자번호</dt><dd>{c.bizNo}</dd></>}
                {c.ceo && <><dt className="text-slate-500">대표</dt><dd>{c.ceo}</dd></>}
              </dl>
            </div>
            <div>
              <div className={mono}>공장</div>
              <div className="mt-2 border-t border-line">
                {sites.map((s) => <div key={s.name} className="border-b border-line py-5"><div className="font-medium">{s.name}</div><div className="mt-0.5 text-sm leading-5 text-slate-600">{s.address}</div></div>)}
                {sites.length === 0 && <div className="border-b border-line py-5 text-sm text-slate-500">주소는 시스템 설정에서 넣으면 여기 보입니다.</div>}
              </div>
              {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className={`${pillS} mt-6 h-12 px-6 text-base`}>지도에서 보기</a>}
            </div>
          </div>
          <footer className="mt-12 flex flex-col gap-2 text-xs leading-4 text-slate-500 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} {c.name}</span>
            <span className={mono}>{[c.bizType, c.bizItem].filter(Boolean).join(" · ")}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
