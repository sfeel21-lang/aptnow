import { NextResponse, type NextRequest } from "next/server";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import { getCache, setCache } from "@/lib/cache/redis";
import { getRegionByLawdCd } from "@/lib/constants/regionCodes";
import { computeNewHighFlags } from "@/lib/deals/analysis";
import { withTiming } from "@/lib/api/withTiming";
import type { AptDeal } from "@/types";

// ioredis 등 Node API 사용 — Edge 가 아닌 Node 런타임에서 실행
export const runtime = "nodejs";
// 쿼리/시점에 따라 응답이 달라지므로 동적 처리
export const dynamic = "force-dynamic";

/** 캐시 TTL: 6시간(초) */
const CACHE_TTL_SECONDS = 6 * 60 * 60;
/** months 파라미터 허용 범위 */
const MIN_MONTHS = 1;
const MAX_MONTHS = 12;

/** 응답 meta 정보 */
interface DealsMeta {
  /** 전체 거래 건수 */
  readonly total: number;
  /** 신고가 건수 */
  readonly newHighCount: number;
  /** 지역명 (예: "강남구") */
  readonly region: string;
  /** 조회 기간 (예: "2024년 11월") */
  readonly period: string;
}

/** /api/deals 응답 형태 */
interface DealsApiResponse {
  readonly success: boolean;
  readonly data: AptDeal[];
  readonly meta?: DealsMeta;
  readonly error?: string;
  readonly cached?: boolean;
}

/**
 * 현재 연월 문자열을 반환한다.
 * @returns { ymd: "202411", label: "2024년 11월" }
 */
function getCurrentPeriod(): { ymd: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const ymd = `${year}${String(month).padStart(2, "0")}`;
  return { ymd, label: `${year}년 ${month}월` };
}

/**
 * GET /api/deals?lawdCd=11680&months=1
 * - 지역/기간 아파트 매매 실거래가를 조회한다(캐시 우선).
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const lawdCd = searchParams.get("lawdCd") ?? "";
  const monthsRaw = searchParams.get("months") ?? "1";

  // ── 1) 파라미터 유효성 검사 ──
  // lawdCd: 숫자 5자리 필수
  if (!/^\d{5}$/.test(lawdCd)) {
    return NextResponse.json<DealsApiResponse>(
      {
        success: false,
        data: [],
        error: "lawdCd 파라미터는 5자리 숫자여야 합니다. (예: 11680)",
      },
      { status: 400 },
    );
  }
  // months: 1~12 정수 (범위 밖이면 보정)
  const parsedMonths = Number.parseInt(monthsRaw, 10);
  if (Number.isNaN(parsedMonths) || parsedMonths < MIN_MONTHS) {
    return NextResponse.json<DealsApiResponse>(
      {
        success: false,
        data: [],
        error: "months 파라미터는 1 이상의 정수여야 합니다.",
      },
      { status: 400 },
    );
  }
  const months = Math.min(parsedMonths, MAX_MONTHS);

  // 지역명 역조회 (없으면 코드 그대로 표기)
  const region = getRegionByLawdCd(lawdCd)?.gugun ?? lawdCd;
  const { ymd, label: period } = getCurrentPeriod();

  // ── 2) 캐시 조회 (키: deals:{lawdCd}:{yyyyMM}:m{months}) ──
  const cacheKey = `deals:${lawdCd}:${ymd}:m${months}`;
  const cached = await getCache<AptDeal[]>(cacheKey);

  let deals: AptDeal[];
  let isCached: boolean;

  if (cached) {
    deals = cached;
    isCached = true;
  } else {
    // ── 3) 캐시 미스 → 국토부 API 조회 + 신고가 계산 ──
    try {
      const fetched = await fetchAptDealsMultiMonth(lawdCd, months);
      deals = computeNewHighFlags(fetched);
    } catch (error) {
      // API 키 미설정 등 치명적 오류
      return NextResponse.json<DealsApiResponse>(
        {
          success: false,
          data: [],
          error:
            error instanceof Error
              ? error.message
              : "거래 데이터 조회에 실패했습니다.",
        },
        { status: 500 },
      );
    }
    isCached = false;
    // 계산된 결과를 캐시에 저장 (TTL 6시간)
    await setCache(cacheKey, deals, CACHE_TTL_SECONDS);
  }

  const newHighCount = deals.filter((deal) => deal.isNewHigh).length;

  // ── 4) 응답 + Cache-Control 헤더 ──
  return NextResponse.json<DealsApiResponse>(
    {
      success: true,
      data: deals,
      meta: {
        total: deals.length,
        newHighCount,
        region,
        period: months > 1 ? `최근 ${months}개월` : period,
      },
      cached: isCached,
    },
    {
      status: 200,
      headers: {
        // 6시간 캐시 + 1시간 stale-while-revalidate
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=3600",
      },
    },
  );
}

// 응답시간 로깅 래퍼 적용
export const GET = withTiming("deals", handler);
