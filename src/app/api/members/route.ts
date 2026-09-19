// 담당자(활성 직원) 목록
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMembers } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ members: await getMembers() });
}
