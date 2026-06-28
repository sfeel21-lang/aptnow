import { NextResponse, type NextRequest } from "next/server";
import { getCache, incrCounter } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 방문자 쿠키 이름 (오늘 1회 카운트 dedup) */
const VISIT_COOKIE = "aptnow_v";
/** 카운터 TTL: 2일(초) — 자정 경계 여유 */
const TTL_SECONDS = 2 * 24 * 60 * 60;

interface VisitorsResponse {
  /** 오늘 방문자 수 */
  readonly count: number;
  /** 추정치 여부(Redis 미사용 시 true) */
  readonly estimated: boolean;
}

/** YYYYMMDD */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Redis 미사용 시 시간대 기반 추정치.
 * - 하루 동안 자연스럽게 증가하도록 시/분을 반영(결정적).
 */
function estimateCount(): number {
  const now = new Date();
  const base = 820;
  return base + now.getHours() * 73 + Math.floor(now.getMinutes() / 2);
}

/**
 * GET /api/visitors
 * - 오늘 방문자 수를 반환한다(쿠키로 세션당 1회 집계).
 * - Redis 가 없으면 추정치(estimated:true)를 반환한다.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const day = today();
  const key = `visits:${day}`;
  const alreadyCounted = request.cookies.get(VISIT_COOKIE)?.value === day;

  // 신규 세션이면 증가, 아니면 현재값 읽기
  const counted = alreadyCounted
    ? await getCache<number>(key)
    : await incrCounter(key, TTL_SECONDS);

  // Redis 미사용/장애(null) → 추정치
  const estimated = counted === null;
  const count = estimated ? estimateCount() : counted;

  const response = NextResponse.json<VisitorsResponse>(
    { count, estimated },
    {
      headers: {
        "Cache-Control": "no-store", // 방문자 수는 캐시하지 않음
      },
    },
  );

  // 오늘 방문 쿠키 설정 (자정까지 dedup)
  if (!alreadyCounted) {
    response.cookies.set(VISIT_COOKIE, day, {
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}
