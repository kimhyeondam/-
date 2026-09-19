// 현담비서 API
// - GET  : Claude 연결 여부 확인
// - POST : 질문 + 회사 현황 요약을 받아 답변. API 키가 있으면 Claude, 없으면 내장 비서가 답합니다.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { localAnswer } from "@/lib/localAssistant";
import { buildSnapshot, slimSnapshot } from "@/lib/assistantContext";
import { brandOf, loadCompany } from "@/lib/branding";
import { loadCollections } from "@/lib/loadCollections";
import { getCurrentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import type { UsageEntry } from "@/lib/assistantUsage";
import { audit } from "@/lib/audit";

const MODEL = "claude-sonnet-5"; // 직원용 비서는 Sonnet 5 (빠르고 저렴). 명함·문서 인식은 정확도를 위해 Opus 5 유지
const configured = () => !!process.env.ANTHROPIC_API_KEY;

export async function GET() {
  return NextResponse.json({ configured: configured(), model: configured() ? MODEL : "내장 비서" });
}

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
}

async function recordUsage(entry: UsageEntry) {
  try {
    const store = getStore();
    const row = await store.get<UsageEntry[]>("assistantUsage");
    const list = Array.isArray(row?.data) ? row.data : [];
    list.unshift(entry);
    await store.set("assistantUsage", list.slice(0, 1000));
  } catch {
    // 기록 실패는 답변을 막지 않음
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = (await req.json()) as Body;
  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
  const last = history[history.length - 1];
  if (!last || last.role !== "user") return NextResponse.json({ error: "질문이 비어 있습니다." }, { status: 400 });
  const snapshot = buildSnapshot(await loadCollections(), brandOf(await loadCompany()));
  const base = { at: new Date().toISOString(), question: last.content, user: user.name };
  await audit({ user: user.name, userId: user.id, action: "AI 비서 질문", detail: last.content.slice(0, 80) });

  // 1) API 키가 없으면 내장 비서
  if (!configured()) {
    await recordUsage({ ...base, mode: "local", inputTokens: 0, outputTokens: 0 });
    return NextResponse.json({ text: localAnswer(last.content, snapshot), mode: "local" });
  }

  // 2) Claude에게 질문
  // 30초 안에 답이 없거나 한 번 재시도 후에도 실패하면 내장 비서로 넘어갑니다.
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: [
        `당신은 콘크리트 제품(흄관, 맨홀, 경계석, 보도블록, PC 암거 등)을 생산·판매하는 회사 "${snapshot.company}"의 업무 비서 "${snapshot.assistantName}"입니다.`,
        "대표님과 직원들이 한국어로 질문하면, 아래 <회사현황> 데이터만 근거로 정확하고 짧게 답합니다.",
        "데이터에 없는 내용은 지어내지 말고 '등록된 데이터에 없습니다'라고 말합니다.",
        "금액은 원 단위에 쉼표를 넣어 표기하고, 목록은 '- ' 글머리로 씁니다. 전문 용어는 쉽게 풀어 설명합니다.",
        "견적서 초안을 요청받으면 품명·규격·단위·수량·단가·금액 표 형식으로 작성하되, 단가가 데이터에 없으면 '단가 확인 필요'로 표시합니다.",
      ].join("\n"),
    },
    {
      type: "text",
      text: `<회사현황>\n${JSON.stringify(slimSnapshot(snapshot))}\n</회사현황>`,
      cache_control: { type: "ephemeral" },
    },
  ];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system,
      messages: history.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content })),
    });

    const usage = pickUsage(response);
    await recordUsage({ ...base, mode: "claude", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ text: "죄송합니다. 이 질문에는 답변드릴 수 없습니다.", mode: "claude", usage });
    }
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return NextResponse.json({ text: text || "답변을 만들지 못했습니다.", mode: "claude", usage });
  } catch (error) {
    // 오류 종류별 안내 후, 내장 비서로 대신 답합니다.
    let reason = "AI 연결에 문제가 있어";
    if (error instanceof Anthropic.AuthenticationError) reason = "API 키가 올바르지 않아";
    else if (error instanceof Anthropic.RateLimitError) reason = "요청이 너무 많아 잠시";
    else if (error instanceof Anthropic.APIConnectionError) reason = "네트워크 연결이 안 되어";
    else if (error instanceof Anthropic.APIError) reason = `AI 서비스 오류(${error.status})로`;
    await recordUsage({ ...base, mode: "local", inputTokens: 0, outputTokens: 0 });
    return NextResponse.json({ text: `(${reason} 내장 비서가 대신 답합니다)\n\n${localAnswer(last.content, snapshot)}`, mode: "local", warning: reason });
  }
}

/** 입력 토큰은 「새로 읽은 것 + 캐시에 새로 저장한 것 + 캐시에서 재사용한 것」 합계. 요금은 종류마다 달라 따로 기록합니다 */
function pickUsage(r: Anthropic.Message) {
  const cacheRead = r.usage.cache_read_input_tokens ?? 0;
  const cacheWrite = r.usage.cache_creation_input_tokens ?? 0;
  return { inputTokens: r.usage.input_tokens + cacheRead + cacheWrite, outputTokens: r.usage.output_tokens, cacheRead, cacheWrite };
}
