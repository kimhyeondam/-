// 명함 사진 인식: 사진(base64)을 받아 Claude가 이름·회사·직책·전화·이메일·주소를 읽어 냅니다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";

const MODEL = "claude-opus-5";

const CardSchema = z.object({
  name: z.string().describe("사람 이름. 없으면 빈 문자열"),
  company: z.string().describe("회사명. 없으면 빈 문자열"),
  title: z.string().describe("직책/직위. 없으면 빈 문자열"),
  mobile: z.string().describe("휴대전화 번호(010 등). 없으면 빈 문자열"),
  phone: z.string().describe("회사 전화/대표번호. 없으면 빈 문자열"),
  email: z.string().describe("이메일. 없으면 빈 문자열"),
  address: z.string().describe("주소. 없으면 빈 문자열"),
  confidence: z.enum(["high", "medium", "low"]).describe("전체 인식 신뢰도"),
});

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "명함 사진 인식은 AI 연결(ANTHROPIC_API_KEY)이 필요합니다. 직접 입력으로 등록해 주세요." }, { status: 503 });
  }

  const body = (await req.json()) as { image?: string; mediaType?: string };
  if (!body.image || !body.mediaType || !(ALLOWED as readonly string[]).includes(body.mediaType)) {
    return NextResponse.json({ error: "사진 파일(JPG/PNG/WEBP)을 올려 주세요." }, { status: 400 });
  }
  if (body.image.length > 8_000_000) return NextResponse.json({ error: "사진이 너무 큽니다. 더 작은 사진으로 시도해 주세요." }, { status: 413 });

  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(CardSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: body.mediaType as MediaType, data: body.image } },
            { type: "text", text: "이 명함 사진에서 정보를 읽어 정리해 주세요. 한글 이름과 회사명은 원문 그대로 적고, 전화번호는 하이픈(-)으로 구분합니다. 사진에 없는 항목은 빈 문자열로 둡니다." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "명함을 읽지 못했습니다. 더 밝고 선명한 사진으로 다시 시도해 주세요." }, { status: 422 });
    }
    return NextResponse.json({ card: response.parsed_output });
  } catch (error) {
    let message = "AI 연결에 문제가 있어 인식하지 못했습니다.";
    if (error instanceof Anthropic.AuthenticationError) message = "API 키가 올바르지 않습니다.";
    else if (error instanceof Anthropic.RateLimitError) message = "요청이 많아 잠시 후 다시 시도해 주세요.";
    else if (error instanceof Anthropic.BadRequestError) message = "사진 형식을 처리할 수 없습니다. JPG나 PNG로 다시 시도해 주세요.";
    else if (error instanceof Anthropic.APIConnectionError) message = "네트워크 연결을 확인해 주세요.";
    else if (error instanceof Anthropic.APIError) message = `AI 서비스 오류 (${error.status})`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
