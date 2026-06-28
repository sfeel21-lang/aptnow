import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { AdSlot } from "@/components/ui/AdSlot";
import { Skeleton } from "@/components/ui/Skeleton";
import { RankingView } from "@/components/deals/RankingView";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import { getLawdCd } from "@/lib/constants/regionCodes";
import { SITE } from "@/lib/constants";
import type { AptDeal } from "@/types";

/** 집계 기간(개월) */
const MONTHS = 12;

/** 시도 축약 (지역 라벨용) */
const SIDO_SHORT: Readonly<Record<string, string>> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

interface RankingPageProps {
  params: { sido: string; gugun: string };
  searchParams: { dong?: string };
}

/** 동적 메타데이터 (SEO) */
export function generateMetadata({ params }: RankingPageProps): Metadata {
  const gugun = decodeURIComponent(params.gugun);
  return {
    title: { absolute: `${gugun} 최고가 아파트 순위 | ${SITE.name}` },
    description: `${gugun} 지역 최고가 아파트 순위. 지역 최고가 아파트는 보통 지역 시세를 견인합니다. 국토교통부 실거래가 기준.`,
    alternates: {
      canonical: `/${encodeURIComponent(params.sido)}/${encodeURIComponent(params.gugun)}/ranking`,
    },
  };
}

/**
 * 지역 최고가 아파트 순위 페이지.
 * - 선택 지역의 단지별 최고 거래가를 집계해 순위로 보여준다(아실 스타일).
 */
export default function RankingPage({
  params,
  searchParams,
}: RankingPageProps): JSX.Element {
  const sido = decodeURIComponent(params.sido);
  const gugun = decodeURIComponent(params.gugun);
  const lawdCd = getLawdCd(sido, gugun);
  if (!lawdCd) notFound();

  const dong = searchParams.dong ? decodeURIComponent(searchParams.dong) : "";
  const regionPath = `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`;
  const sidoShort = SIDO_SHORT[sido] ?? sido;
  const regionLabel = `${sidoShort} ${gugun}`;

  return (
    <Container className="py-8">
      {/* 브레드크럼 */}
      <nav
        aria-label="현재 위치"
        className="flex flex-wrap items-center gap-1 text-sm text-content-secondary"
      >
        <Link href="/" className="hover:text-content">
          홈
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span>{sido}</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link href={regionPath} className="hover:text-content">
          {gugun}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-content">최고가 순위</span>
      </nav>

      {/* 제목 */}
      <h1 className="mt-2 flex items-center gap-2 font-heading text-2xl font-bold sm:text-3xl">
        <Trophy className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        {gugun}
        {dong ? ` ${dong}` : ""} 최고가 아파트 순위
      </h1>
      <p className="mt-2 text-sm text-content-secondary">
        지역 최고가 아파트가 보통 지역 시세를 견인합니다. 단지별 최근 12개월 최고
        거래가 기준입니다.
      </p>

      {/* 일반 목록으로 돌아가기 */}
      <Link
        href={dong ? `${regionPath}?dong=${encodeURIComponent(dong)}` : regionPath}
        className="mt-2 inline-flex items-center gap-1 text-sm text-content-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
      >
        {gugun} 실거래가 목록 보기 →
      </Link>

      {/* 배너 광고 */}
      <AdSlot type="banner" adSlot="1234567890" />

      {/* 순위 (스트리밍) */}
      <Suspense fallback={<RankingSkeleton />}>
        <RankingBody
          lawdCd={lawdCd}
          dong={dong}
          regionLabel={regionLabel}
          basePath={regionPath}
        />
      </Suspense>

      {/* 푸터 광고 */}
      <AdSlot type="footer" adSlot="0987654321" />
    </Container>
  );
}

/* ───────────────────────── 데이터 영역 ───────────────────────── */

interface RankingBodyProps {
  lawdCd: string;
  dong: string;
  regionLabel: string;
  basePath: string;
}

/** 지역 거래를 조회해 순위 뷰로 전달 (async, 스트리밍) */
async function RankingBody({
  lawdCd,
  dong,
  regionLabel,
  basePath,
}: RankingBodyProps): Promise<JSX.Element> {
  let deals: AptDeal[] = [];
  try {
    const all = await fetchAptDealsMultiMonth(lawdCd, MONTHS);
    deals = dong ? all.filter((d) => d.dong === dong) : all;
  } catch {
    deals = [];
  }

  if (deals.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed py-16 text-center text-sm text-content-muted">
        최근 {MONTHS}개월간 거래 내역이 없습니다.
      </div>
    );
  }

  return (
    <RankingView deals={deals} regionLabel={regionLabel} basePath={basePath} />
  );
}

/** 순위 스켈레톤 */
function RankingSkeleton(): JSX.Element {
  return (
    <div className="mt-4" aria-busy="true">
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-96 rounded-lg" />
    </div>
  );
}
