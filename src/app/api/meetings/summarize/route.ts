// 회의록 AI 정리: 원문을 요약·결정사항·할 일로 구조화합니다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { getMembers } from "@/lib/users";
import { todayIso } from "@/lib/format";

const MODEL = "claude-opus-5";

const Schema = z.object({
  summary: z.string().describe("회의 내용을 2~3문장으로 요약"),
  decisions: z.array(z.string()).describe("결정된 사항 목록. 없으면 빈 배열"),
  actions: z.array(z.object({
    title: z.string().describe("해야 할 일 (짧고 구체적으로)"),
    assignee: z.string().describe("담당자 이름. 회의록에 없거나 직원 목록에 없으면 빈 문자열"),
    due: z.string().describe("마감일 YYYY-MM-DD. 없으면 빈 문자열"),
  })).describe("후속 할 일 목록"),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI 정리는 AI 연결(ANTHROPIC_API_KEY)이 필요합니다. 요약과 할 일을 직접 적어 주세요." }, { status: 503 });
  const body = (await req.json()) as { title?: string; notes?: string; attendees?: string[] };
  if (!body.notes?.trim()) return NextResponse.json({ error: "회의록 내용이 비어 있습니다." }, { status: 400 });

  const members = (await getMembers()).map((m) => `${m.name}(${m.team})`).join(", ");
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Schema) },
      system: `콘크리트 제품 회사의 회의록을 정리하는 비서입니다. 오늘은 ${todayIso()}입니다. 직원 목록: ${members}. 담당자는 이 목록의 이름만 쓰고, "다음 주까지" 같은 표현은 오늘 날짜 기준으로 YYYY-MM-DD로 바꿉니다. 회의록에 없는 내용은 만들지 않습니다.`,
      messages: [{ role: "user", content: `미팅명: ${body.title ?? ""}\n참석자: ${(body.attendees ?? []).join(", ")}\n\n회의록:\n${body.notes}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return NextResponse.json({ error: "정리하지 못했습니다. 다시 시도해 주세요." }, { status: 422 });
    return NextResponse.json({ result: response.parsed_output });
  } catch (error) {
    let message = "AI 연결에 문제가 있어 정리하지 못했습니다.";
    if (error instanceof Anthropic.AuthenticationError) message = "API 키가 올바르지 않습니다.";
    else if (error instanceof Anthropic.RateLimitError) message = "요청이 많아 잠시 후 다시 시도해 주세요.";
    else if (error instanceof Anthropic.APIConnectionError) message = "네트워크 연결을 확인해 주세요.";
    else if (error instanceof Anthropic.APIError) message = `AI 서비스 오류 (${error.status})`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
