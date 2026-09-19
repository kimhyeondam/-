// 납품 문서 인식: 분할납품요구서·거래명세표 사진(또는 PDF)을 Claude 가 읽어 품목·수량·기관·현장을 정리합니다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { loadCompany } from "@/lib/branding";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const MODEL = "claude-opus-5";

const ItemSchema = z.object({
  name: z.string().describe("품명"),
  spec: z.string().describe("규격. 없으면 빈 문자열"),
  unit: z.string().describe("단위(EA, M, 조 등). 없으면 빈 문자열"),
  qty: z.number().describe("수량. 숫자만"),
  unitPrice: z.number().describe("단가(원). 없으면 0"),
  amount: z.number().describe("금액/공급가액(원). 없으면 0"),
  note: z.string().describe("비고. 없으면 빈 문자열"),
});

const DocSchema = z.object({
  kind: z.enum(["분할납품요구서", "거래명세표", "납품요구서", "기타"]).describe("문서 종류"),
  projectName: z.string().describe("사업명·공사명·건명 (예: ○○지구 농공단지 조성공사). 문서에 사업명/공사명 칸이 있으면 그 값, 없으면 납품장소·현장명으로 만든 짧은 이름"),
  orderNo: z.string().describe("납품요구번호 또는 문서 번호(No). 없으면 빈 문자열"),
  contractNo: z.string().describe("계약번호. 없으면 빈 문자열"),
  agency: z.string().describe("수요기관·발주처·공급받는자(우리 회사가 납품하는 상대). 없으면 빈 문자열"),
  site: z.string().describe("납품장소·현장명. 없으면 빈 문자열"),
  date: z.string().describe("요구일자 또는 거래일자. YYYY-MM-DD. 없으면 빈 문자열"),
  dueDate: z.string().describe("납품기한. YYYY-MM-DD. 없으면 빈 문자열"),
  items: z.array(ItemSchema).describe("품목 목록. 문서에 적힌 순서대로 전부"),
  totalQty: z.number().describe("수량 합계. 없으면 품목 수량을 더한 값"),
  totalAmount: z.number().describe("합계 금액(원). 없으면 0"),
  memo: z.string().describe("납품요구서라면 기타사항의 '실수요부서 담당자, 전화번호'만 (예: 실수요부서 담당: 우주항공전략실 김승훈 061-830-5213). 조달청 담당자·안내문은 넣지 않음. 없으면 빈 문자열"),
  confidence: z.enum(["high", "medium", "low"]).describe("전체 인식 신뢰도"),
});

export type ExtractedDoc = z.infer<typeof DocSchema>;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "문서 인식은 AI 연결(ANTHROPIC_API_KEY)이 필요합니다. 시스템 설정에서 AI 연결 상태를 확인하세요." }, { status: 503 });
  }
  const body = (await req.json()) as { file?: string; mediaType?: string; fileName?: string };
  const companyName = (await loadCompany()).name;
  const isPdf = body.mediaType === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(body.mediaType ?? "");
  if (!body.file || (!isPdf && !isImage)) return NextResponse.json({ error: "사진(JPG/PNG) 또는 PDF 파일을 올려 주세요." }, { status: 400 });
  if (body.file.length > 12_000_000) return NextResponse.json({ error: "파일이 너무 큽니다(8MB 이하). 사진이면 조금 작게 찍어 주세요." }, { status: 413 });

  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium", format: zodOutputFormat(DocSchema) },
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
                `이 문서는 콘크리트 제품 회사(${companyName})가 받은 납품 관련 서류입니다. 분할납품요구서(관급, 조달청/수요기관이 보낸 납품 요청), 거래명세표, 납품요구서 중 하나입니다.`,
                "사업명(공사명·건명) 칸이 있으면 projectName 에 그대로 적습니다.",
                "문서에 적힌 대로 정확히 읽어 정리하세요. 품목은 한 줄도 빠뜨리지 말고 순서대로, 품명과 규격은 원문 그대로, 수량·단가·금액은 숫자만 적습니다.",
                `'공급자'가 ${companyName}이면 상대방(공급받는자·수요기관·현장)이 agency/site 입니다. 날짜는 YYYY-MM-DD 로 바꾸고, 월일만 있으면 문서의 연도를 씁니다.`,
                "읽을 수 없는 항목은 빈 문자열 또는 0 으로 둡니다.",
              ].join(" "),
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "문서를 읽지 못했습니다. 더 밝고 선명하게 다시 찍어 주세요." }, { status: 422 });
    }
    const doc = response.parsed_output;
    const totalQty = doc.totalQty || doc.items.reduce((s, i) => s + (i.qty || 0), 0);
    await audit({ user: user.name, userId: user.id, action: "납품 문서 인식", target: `${doc.kind} ${doc.orderNo || ""}`.trim(), detail: `${doc.site || doc.agency || ""} · 품목 ${doc.items.length}건 · 수량 ${totalQty}` });
    return NextResponse.json({ doc: { ...doc, totalQty }, fileName: body.fileName ?? "" });
  } catch (error) {
    let message = "AI 연결에 문제가 있어 인식하지 못했습니다.";
    if (error instanceof Anthropic.AuthenticationError) message = "API 키가 올바르지 않습니다.";
    else if (error instanceof Anthropic.RateLimitError) message = "요청이 많아 잠시 후 다시 시도해 주세요.";
    else if (error instanceof Anthropic.APIConnectionError) message = "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    else if (error instanceof Anthropic.APIError) message = `AI 오류 (${error.status}): ${error.message}`;
    console.error("[extract-order]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
