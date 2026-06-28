import { NextResponse, type NextRequest } from "next/server";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import { withTiming } from "@/lib/api/withTiming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 동 목록 추출용 조회 기간(개월) */
const MONTHS = 6;

interface DongsResponse {
  readonly success: boolean;
  /** 실제 거래가 있었던 읍/면/동명 목록 (가나다순) */
  readonly dongs: string[];
}

/**
 * GET /api/dongs?lawdCd=11680
 * - 해당 시군구의 최근 거래 데이터에서 읍/면/동명을 추출해 반환한다.
 * - 실거래가 없는 동은 포함되지 않는다(서비스 특성상 의도된 동작).
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const lawdCd = request.nextUrl.searchParams.get("lawdCd") ?? "";
  if (!/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json<DongsResponse>(
      { success: false, dongs: [] },
      { status: 400 },
    );
  }

  try {
    const deals = await fetchAptDealsMultiMonth(lawdCd, MONTHS);
    const dongs = Array.from(
      new Set(deals.map((deal) => deal.dong).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "ko"));

    return NextResponse.json<DongsResponse>(
      { success: true, dongs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    // 조회 실패 시 빈 목록(동 선택은 선택사항이므로 치명적이지 않음)
    return NextResponse.json<DongsResponse>({ success: true, dongs: [] });
  }
}

export const GET = withTiming("dongs", handler);
