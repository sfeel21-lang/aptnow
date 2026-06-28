import { NextResponse, type NextRequest } from "next/server";
import {
  enrichWithRecentDeal,
  searchApartments,
  type SearchResult,
} from "@/lib/data/apartments";
import { withTiming } from "@/lib/api/withTiming";

// 실거래 보강 시 Node 런타임 필요
export const runtime = "nodejs";
// 쿼리 파라미터에 의존하므로 동적 처리(빌드 시 정적 렌더 시도 방지)
export const dynamic = "force-dynamic";

/** 자동완성 기본 결과 수 */
const DEFAULT_LIMIT = 8;
/** 최대 결과 수 */
const MAX_LIMIT = 20;

interface SearchApiResponse {
  readonly success: boolean;
  readonly results: SearchResult[];
}

/** 자동완성 캐시 헤더 (stale-while-revalidate) */
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
} as const;

/**
 * GET /api/search?q=래미안&sido=서울&limit=8&withDeal=1
 * - 로컬 단지 인덱스에서 단지명을 검색한다.
 * - withDeal=1 이면 각 결과에 최근 거래가를 보강한다(느림).
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const sido = searchParams.get("sido") ?? undefined;
  const withDeal = searchParams.get("withDeal") === "1";

  // limit 파싱 및 범위 제한
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isNaN(limitRaw)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitRaw, 1), MAX_LIMIT);

  // 빈 검색어 → 빈 결과
  if (!q) {
    return NextResponse.json<SearchApiResponse>(
      { success: true, results: [] },
      { headers: CACHE_HEADERS },
    );
  }

  const entries = searchApartments(q, sido, limit);

  // 최근 거래가 보강 여부
  if (withDeal) {
    const enriched = await enrichWithRecentDeal(entries);
    return NextResponse.json<SearchApiResponse>(
      {
        success: true,
        results: enriched.map((e) => ({
          aptName: e.aptName,
          address: e.address,
          lawdCd: e.lawdCd,
          recentDeal: e.recentDeal,
        })),
      },
      { headers: CACHE_HEADERS },
    );
  }

  // 자동완성용(빠름): 거래가 없이 반환
  return NextResponse.json<SearchApiResponse>(
    {
      success: true,
      results: entries.map((e) => ({
        aptName: e.aptName,
        address: e.address,
        lawdCd: e.lawdCd,
        recentDeal: null,
      })),
    },
    { headers: CACHE_HEADERS },
  );
}

// 응답시간 로깅 래퍼 적용
export const GET = withTiming("search", handler);
