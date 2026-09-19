"use client";

import type { FormDoc, CompanyProfile } from "@/data/sample";
import { docSupply, docVat, docTotal, docNetSupply, toKoreanNumber, fmtDateKo } from "@/lib/documents/calc";

const won = (n: number) => n.toLocaleString("ko-KR");

/** 화면·인쇄용 문서 미리보기 (PDF와 같은 구성) */
export default function DocPreview({ doc, company }: { doc: FormDoc; company: CompanyProfile }) {
  const total = docTotal(doc);
  const rows = Math.max(doc.items.length, 8);
  return (
    <div className="doc-sheet bg-white text-slate-900 mx-auto w-full max-w-[794px] p-10 text-[13px] leading-snug shadow-sm border border-line print:border-0 print:shadow-none">
      <div className="flex items-end justify-between">
        {company.logo ? <img src={company.logo} alt={company.name} className="h-9 object-contain" /> : <span />}
        <span className="text-xs text-slate-500">문서번호 {doc.number}</span>
      </div>
      <h1 className="mt-2 text-center text-3xl font-bold tracking-[0.5em]">{doc.type}</h1>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="border border-slate-400 p-3">
          <div className="text-xs font-bold text-slate-500">수 신</div>
          <div className="mt-1 text-lg font-bold">{doc.customer} 귀하</div>
          {doc.customerRef && <div className="text-xs text-slate-600">{doc.customerRef}</div>}
          {doc.project && <div className="mt-1 text-xs">건명: {doc.project}</div>}
          {doc.site && <div className="text-xs">현장: {doc.site}</div>}
          <div className="text-xs">일자: {fmtDateKo(doc.date)}</div>
        </div>
        <div className="border border-slate-400 p-3">
          <div className="text-xs font-bold text-slate-500">공 급 자</div>
          <table className="mt-1 text-xs">
            <tbody>
              {[["상 호", company.name], ["대 표", company.ceo], ["등록번호", company.bizNo], ["주 소", company.address], ["전 화", `${company.phone}${company.fax ? ` / FAX ${company.fax}` : ""}`], ...(company.bizType ? [["업태/종목", `${company.bizType} / ${company.bizItem ?? ""}`]] : [])].map(([k, v]) => (
                <tr key={k}><td className="pr-3 text-slate-500 whitespace-nowrap align-top">{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4">
        {doc.type === "견적서" ? `아래와 같이 견적합니다.${doc.validDays ? ` (유효기간: 견적일로부터 ${doc.validDays}일)` : ""}` : doc.type === "거래명세표" ? "아래와 같이 거래 내역을 통보합니다." : "아래 품목을 이상 없이 납품하였음을 확인합니다."}
      </p>

      <div className="mt-3 flex items-center justify-between border border-slate-400 bg-slate-100 px-3 py-2 font-bold">
        <span>합계금액 ({doc.vatIncluded ? "부가세 포함" : "부가세 별도"})</span>
        <span>일금 {toKoreanNumber(total)}원정 (₩{won(total)})</span>
      </div>

      <table className="mt-3 w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            {["번호", "품명", "규격", "단위", "수량", "단가", "금액"].map((h) => <th key={h} className="border border-slate-400 px-2 py-1.5 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const it = doc.items[i];
            return (
              <tr key={i} className="h-7">
                <td className="border border-slate-300 px-2 text-center">{it ? i + 1 : ""}</td>
                <td className="border border-slate-300 px-2">{it?.name ?? ""}</td>
                <td className="border border-slate-300 px-2">{it?.spec ?? ""}</td>
                <td className="border border-slate-300 px-2 text-center">{it?.unit ?? ""}</td>
                <td className="border border-slate-300 px-2 text-right">{it ? won(it.qty) : ""}</td>
                <td className="border border-slate-300 px-2 text-right">{it ? won(it.unitPrice) : ""}</td>
                <td className="border border-slate-300 px-2 text-right">{it ? won(it.qty * it.unitPrice) : ""}</td>
              </tr>
            );
          })}
          <tr className="bg-slate-50 font-bold"><td className="border border-slate-300 px-2" /><td className="border border-slate-300 px-2" colSpan={5}>소계</td><td className="border border-slate-300 px-2 text-right">{won(docSupply(doc.items))}</td></tr>
          <tr><td className="border border-slate-300 px-2" /><td className="border border-slate-300 px-2" colSpan={5}>{doc.vatIncluded ? "공급가액(부가세 제외)" : "공급가액"}</td><td className="border border-slate-300 px-2 text-right">{won(docNetSupply(doc))}</td></tr>
          <tr><td className="border border-slate-300 px-2" /><td className="border border-slate-300 px-2" colSpan={5}>부가세</td><td className="border border-slate-300 px-2 text-right">{won(docVat(doc))}</td></tr>
          <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 px-2" /><td className="border border-slate-300 px-2" colSpan={5}>합계</td><td className="border border-slate-300 px-2 text-right">{won(total)}</td></tr>
        </tbody>
      </table>

      {doc.memo && <div className="mt-3 text-xs"><b>비고</b> <span className="ml-2 whitespace-pre-wrap">{doc.memo}</span></div>}
      {doc.type !== "납품확인서" && company.bank && <div className="mt-2 text-xs"><b>입금계좌</b> <span className="ml-2">{company.bank}</span></div>}

      {doc.type === "납품확인서" ? (
        <div className="mt-8 space-y-4">
          <p className="text-center">위 물품을 {fmtDateKo(doc.date)} 정히 인수하였습니다.</p>
          <p className="text-right">인수자 : {doc.receiver ?? " ".repeat(20)} (서명/인)</p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-center">{fmtDateKo(doc.date)}</p>
          <p className="text-right font-bold">{company.name} 대표 {company.ceo} (인)</p>
        </div>
      )}
    </div>
  );
}
