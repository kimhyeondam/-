// 스마트 업로드: 사진/PDF 한 장을 Claude 가 보고 어떤 서류인지 판별해 필요한 값을 뽑아 줍니다.
// (명함 / 매출 거래명세표 / 매입 명세표·영수증·세금계산서 / 납품요구서 / 입금 내역 / 생산일보 / 일정 / 할일)
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { loadCompany } from "@/lib/branding";
import { getStore } from "@/lib/store";
import type { Customer } from "@/data/sample";
import { resolveParties } from "@/lib/inbox/resolveParties";

const MODEL = "claude-opus-5";

export const INBOX_KINDS = ["명함", "매출명세표", "매입명세표", "납품요구서", "입금내역", "생산일보", "일정", "할일", "기타"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

const ItemSchema = z.object({
  name: z.string().describe("품명"),
  spec: z.string().describe("규격. 없으면 빈 문자열"),
  unit: z.string().describe("단위. 없으면 빈 문자열"),
  qty: z.number().describe("수량. 없으면 0"),
  unitPrice: z.number().describe("단가(원). 없으면 0"),
  amount: z.number().describe("금액(원). 없으면 0"),
  defect: z.number().describe("불량 수량 (생산일보만). 없으면 0"),
  note: z.string().describe("비고. 없으면 빈 문자열"),
});

const InboxSchema = z.object({
  kind: z.enum(INBOX_KINDS).describe("서류 종류. 우리 회사가 공급자면 매출명세표, 우리 회사가 공급받는자(구매)면 매입명세표, 공장의 하루 생산 기록표면 생산일보"),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().describe("이 서류를 한 문장으로 (예: 고흥군에 원형1호 30개 납품한 거래명세표)"),
  title: z.string().describe("제목/건명. 일정·할일이면 그 제목, 매출·매입이면 '거래처 품목 납품'처럼 짧게. 없으면 빈 문자열"),
  date: z.string().describe("문서 날짜 / 일정 시작일 / 거래일 / 입금일. YYYY-MM-DD. 없으면 빈 문자열"),
  endDate: z.string().describe("일정 종료일 (여러 날이면). YYYY-MM-DD. 없으면 빈 문자열"),
  time: z.string().describe("일정 시작 시각 HH:MM. 없으면 빈 문자열"),
  endTime: z.string().describe("일정 종료 시각 HH:MM. 없으면 빈 문자열"),
  dueDate: z.string().describe("납품기한 / 지급 예정일 / 할일 마감일. YYYY-MM-DD. 없으면 빈 문자열"),
  counterparty: z.string().describe("상대방 회사·기관 (거래처, 발주처, 매입처, 입금자, 회의 주최). 없으면 빈 문자열"),
  supplierName: z.string().describe("문서에 적힌 공급자(파는 쪽) 회사명. 거래명세표·송장·세금계산서·영수증에서. 없으면 빈 문자열"),
  supplierBizNo: z.string().describe("공급자 사업자등록번호 (000-00-00000). 없으면 빈 문자열"),
  recipientName: z.string().describe("공급받는자(받는 쪽·회사명·현장 회사). 없으면 빈 문자열"),
  recipientBizNo: z.string().describe("공급받는자 사업자등록번호. 없으면 빈 문자열"),
  siteName: z.string().describe("현장명 (예: 진도실업고등학교). 없으면 빈 문자열"),
  contact: z.string().describe("담당자 연락처 (전화). 없으면 빈 문자열"),
  person: z.string().describe("사람 이름 (명함 이름, 담당자). 없으면 빈 문자열"),
  jobTitle: z.string().describe("직책. 없으면 빈 문자열"),
  mobile: z.string().describe("휴대전화. 없으면 빈 문자열"),
  phone: z.string().describe("회사 전화/대표번호. 없으면 빈 문자열"),
  email: z.string().describe("이메일. 없으면 빈 문자열"),
  address: z.string().describe("주소. 없으면 빈 문자열"),
  location: z.string().describe("일정 장소 / 납품장소 / 현장. 없으면 빈 문자열"),
  projectName: z.string().describe("사업명·공사명. 없으면 빈 문자열"),
  orderNo: z.string().describe("문서 번호 / 납품요구번호 / 승인번호. 없으면 빈 문자열"),
  contractNo: z.string().describe("계약번호. 없으면 빈 문자열"),
  endUserContact: z.string().describe("납품요구서 기타사항의 '실수요부서 담당자, 전화번호' (예: 우주항공전략실 김승훈 061-830-5213). 납품요구서가 아니거나 없으면 빈 문자열"),
  items: z.array(ItemSchema).describe("품목 목록 (매출·매입·납품요구서). 없으면 빈 배열"),
  supplyAmount: z.number().describe("공급가액(원). 없으면 0"),
  vatAmount: z.number().describe("부가세(원). 없으면 0"),
  totalAmount: z.number().describe("합계 금액(원, 부가세 포함) / 입금액. 없으면 0"),
  bank: z.string().describe("은행명·계좌 (입금내역). 없으면 빈 문자열"),
  category: z.enum(["원자재", "부자재", "운반", "외주", "설비", "기타"]).describe("매입이면 분류. 아니면 기타"),
  eventType: z.enum(["납품", "회의", "생산", "점검", "기타"]).describe("일정이면 종류. 아니면 기타"),
  priority: z.enum(["high", "medium", "low"]).describe("할일이면 중요도. 아니면 medium"),
  memo: z.string().describe("참고할 내용 한두 줄 (담당자 연락처, 조건, 특이사항). 없으면 빈 문자열"),
  signed: z.boolean().describe("문서에 손으로 쓴 서명·사인·도장(인수 확인)이 있으면 true. 인쇄된 글자만 있으면 false"),
  docNo: z.string().describe("거래명세표의 문서 번호 (예: No 16218 → 16218, ST-2609-003). 없으면 빈 문자열"),
  line: z.string().describe("생산일보의 라인·조 (예: 1라인, 야간조). 없으면 빈 문자열"),
  workers: z.string().describe("생산일보의 작업 인원 이름들을 쉼표로 (근태현황·주간근무 칸에서 사람 이름만). 없으면 빈 문자열"),
  workHours: z.number().describe("생산일보의 작업 시간(시간 단위, 예: 0800~1700 이면 8). 없으면 0"),
});

export type InboxDoc = z.infer<typeof InboxSchema>;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "사진 분석은 AI 연결(ANTHROPIC_API_KEY)이 필요합니다." }, { status: 503 });
  const body = (await req.json()) as { file?: string; mediaType?: string; fileName?: string; hint?: string };
  const isPdf = body.mediaType === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(body.mediaType ?? "");
  if (!body.file || (!isPdf && !isImage)) return NextResponse.json({ error: "사진(JPG/PNG) 또는 PDF 파일을 올려 주세요." }, { status: 400 });
  if (body.file.length > 12_000_000) return NextResponse.json({ error: "파일이 너무 큽니다(8MB 이하)." }, { status: 413 });

  const co = await loadCompany();
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium", format: zodOutputFormat(InboxSchema) },
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: body.file } }
              : { type: "image", source: { type: "base64", media_type: body.mediaType as ImageType, data: body.file } },
            {
              type: "text",
              text: [
                `우리 회사는 「${co.name}」(사업자번호 ${co.bizNo}, 콘크리트 제품 제조·판매)입니다.`,
                "이 사진/문서가 어떤 서류인지 판별하고 값을 뽑아 정리하세요.",
                "판별 기준: 명함 → 명함. 거래명세표·세금계산서·영수증에서 우리 회사가 '공급자'면 매출명세표, 우리 회사가 '공급받는자'(우리가 산 것)면 매입명세표. 조달청·수요기관이 보낸 분할납품요구서/납품요구서 → 납품요구서. 통장 입금 내역·입금 확인증 → 입금내역. 품목·규격·생산량(생산수량)·시멘트 계량/사용량·믹서횟수·근태현황 같은 칸이 있는 공장의 하루 생산 기록표(제목이 손글씨로 「생산일보」라 적혀 있기도 함) → 생산일보. 회의·행사·납품 일정 통지·공문 → 일정. 지시·요청 메모 → 할일. 그 외 → 기타.",
                "사진이 옆으로 눕거나 거꾸로 찍혀 있어도 글자 방향을 맞춰 읽습니다. 손글씨도 읽습니다.",
                "생산일보는 품목 줄마다 name=품목, spec=규격 칸(예: 600H, 900*900, 000H·600H 처럼 적힌 대로), unit=EA, qty=생산량, defect=불량 수량, note=비고. 생산량이 비어 있는 줄은 qty 0. workers 에는 근태현황·주간근무 칸의 사람 이름만 쉼표로, workHours 에는 근무 시간, memo 에는 기타사항(출하·청소 등)을 적습니다. 시멘트 계량·사용량·사이로 재고 같은 숫자는 memo 에 한 줄로 요약합니다.",
                "같은 송장이 한 장에 두 번 인쇄돼 있으면(보관용·송부용) 한 번만 읽습니다. 공급자와 공급받는자의 회사명·사업자번호를 꼭 따로 적습니다. 손으로 쓴 서명·사인·도장이 있으면 signed=true (인수증으로 보관합니다). 거래명세표의 No/문서번호는 docNo 에 적습니다.",
                "납품요구서는 사업명을 문서 그대로(줄임 없이) 적고, memo에는 실수요부서 담당자·전화번호만 적습니다(조달청 담당자·안내문구는 넣지 않음). 품목 규격에는 모델명(예: JI-D9B-H8A)과 치수를 넣습니다.",
                `품목은 한 줄도 빠뜨리지 말고 순서대로, 숫자는 숫자만. 날짜는 YYYY-MM-DD, 월일만 있으면 문서 연도를, 연도가 어디에도 없으면 오늘(${new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)})의 연도를 씁니다. 읽을 수 없는 항목은 빈 문자열 또는 0.`,
                body.hint ? `사용자 메모: ${body.hint}` : "",
              ].filter(Boolean).join(" "),
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return NextResponse.json({ error: "서류를 읽지 못했습니다. 더 밝고 선명하게 다시 찍어 주세요." }, { status: 422 });
    const doc = response.parsed_output;
    const customersRow = await getStore().get<Customer[]>("customers");
    const customers = Array.isArray(customersRow?.data) ? customersRow.data : [];
    const match = resolveParties(doc, customers, co.bizNo);
    await audit({ user: user.name, userId: user.id, action: "스마트 업로드 분석", target: doc.kind, detail: `${doc.summary.slice(0, 100)}${match.type === "dealer" ? ` · 대리점 ${match.dealer?.name}` : ""}` });
    return NextResponse.json({ doc, fileName: body.fileName ?? "", match });
  } catch (error) {
    let message = "AI 연결에 문제가 있어 분석하지 못했습니다.";
    if (error instanceof Anthropic.AuthenticationError) message = "API 키가 올바르지 않습니다.";
    else if (error instanceof Anthropic.RateLimitError) message = "요청이 많아 잠시 후 다시 시도해 주세요.";
    else if (error instanceof Anthropic.APIConnectionError) message = "AI 서버에 연결하지 못했습니다.";
    else if (error instanceof Anthropic.APIError) message = `AI 오류 (${error.status}): ${error.message}`;
    console.error("[inbox/analyze]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
