import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

/** 현재 로그인한 직원 정보 (화면에서 권한 표시용) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ id: user.id, name: user.name, role: user.role, team: user.team });
}
