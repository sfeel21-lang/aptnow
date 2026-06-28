import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Flame, Smartphone, Zap } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { AdSlot } from "@/components/ui/AdSlot";
import { Skeleton } from "@/components/ui/Skeleton";
import { RegionSelector } from "@/components/deals/RegionSelector";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import { computeNewHighFlags } from "@/lib/deals/analysis";
import { displayAptName } from "@/lib/utils/format";
import { SITE } from "@/lib/constants";
import type { AptDeal } from "@/types";

// 신고가 등 데이터는 1시간 단위로 재생성 (ISR)
export const revalidate = 3600;

/** 인기 지역 목록 (바로가기 + 신고가 집계 대상) */
const POPULAR_REGIONS = [
  { sido: "서울특별시", gugun: "강남구", label: "강남구", lawdCd: "11680", emoji: "🏙️" },
  { sido: "서울특별시", gugun: "서초구", label: "서초구", lawdCd: "11650", emoji: "🌳" },
  { sido: "서울특별시", gugun: "송파구", label: "송파구", lawdCd: "11710", emoji: "🏟️" },
  { sido: "서울특별시", gugun: "마포구", label: "마포구", lawdCd: "11440", emoji: "🌉" },
  { sido: "서울특별시", gugun: "용산구", label: "용산구", lawdCd: "11170", emoji: "🗼" },
  { sido: "경기도", gugun: "성남시 분당구", label: "분당구", lawdCd: "41135", emoji: "🏞️" },
] as const;

type PopularRegion = (typeof POPULAR_REGIONS)[number];

interface NewHighItem extends AptDeal {
  regionLabel: string;
  /** 상세 페이지 경로용 시도/시군구 */
  sido: string;
  gugun: string;
}

/** 신고가 비교용 히스토리 조회 개월 (전고가 산정) */
const HISTORY_MONTHS = 6;
/** "오늘의 신고가"로 노출할 최근 거래 범위(개월) — MOLIT 신고 지연 고려 */
const RECENT_MONTHS = 3;

interface RegionResult {
  region: PopularRegion;
  deals: AptDeal[];
  /** 최근 RECENT_MONTHS 개월 거래 수 */
  recentCount: number;
}

/** 최근 노출 기준 컷오프(YYYY.MM.01) 생성 */
function recentCutoff(): string {
  const now = new Date();
  const c = new Date(now.getFullYear(), now.getMonth() - (RECENT_MONTHS - 1), 1);
  return `${c.getFullYear()}.${String(c.getMonth() + 1).padStart(2, "0")}.01`;
}

/** 인기 지역 데이터를 병렬 조회해 신고가/건수/합계를 산출(서버) */
async function loadHomeData(): Promise<{
  regions: RegionResult[];
  newHighs: NewHighItem[];
  total: number;
}> {
  const cutoff = recentCutoff();

  const regions = await Promise.all(
    POPULAR_REGIONS.map(async (region): Promise<RegionResult> => {
      try {
        // 전고가 비교가 가능하도록 충분한 히스토리(HISTORY_MONTHS)를 조회한다.
        // (2개월만 보면 단지·평형별 거래가 1건뿐이라 비교 대상이 없어 신고가가 0건이 된다.)
        const deals = computeNewHighFlags(
          await fetchAptDealsMultiMonth(region.lawdCd, HISTORY_MONTHS),
        );
        const recentCount = deals.filter((d) => d.dealDate >= cutoff).length;
        return { region, deals, recentCount };
      } catch {
        return { region, deals: [], recentCount: 0 };
      }
    }),
  );

  // 신고가: 전체 히스토리에서 판정하되, 최근 거래만 노출
  const newHighs = regions
    .flatMap(({ region, deals }) =>
      deals
        .filter((d) => d.isNewHigh && d.dealDate >= cutoff)
        .map((d) => ({
          ...d,
          regionLabel: region.label,
          sido: region.sido,
          gugun: region.gugun,
        })),
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const total = regions.reduce((sum, { recentCount }) => sum + recentCount, 0);
  return { regions, newHighs, total };
}

/** 동적 메타데이터 (SEO) */
export function generateMetadata(): Metadata {
  return {
    title: { absolute: "AptNow - 아파트 실거래가 조회" },
    description:
      "국토교통부 공식 실거래가 데이터로 전국 아파트 매매·전세·월세 실거래가를 매일 업데이트해 빠르게 확인하세요.",
    alternates: { canonical: "/" },
    openGraph: {
      title: "AptNow - 아파트 실거래가 조회",
      description: "국토교통부 공식 데이터 · 매일 업데이트",
      url: SITE.url,
      siteName: SITE.name,
      type: "website",
    },
  };
}

/**
 * 메인(랜딩) 페이지.
 * - 히어로/광고/서비스소개는 즉시 렌더(셸), 데이터 영역은 Suspense 로 스트리밍한다.
 */
export default function HomePage(): JSX.Element {
  // JSON-LD 구조화 데이터 (WebSite + SearchAction)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ───────── 히어로 (즉시 렌더) ───────── */}
      <section className="bg-gradient-to-b from-primary to-[#15409E] text-white">
        <Container className="py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
              아파트 실거래가, 지금 바로 확인하세요
            </h1>
            <p className="mt-3 text-white/80">
              국토교통부 공식 데이터 · 매일 업데이트
            </p>
            <div className="mx-auto mt-8 max-w-3xl rounded-2xl bg-card p-4 text-left shadow-card">
              <Suspense fallback={<div className="h-11" />}>
                <RegionSelector />
              </Suspense>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-10">
        {/* 배너 광고 */}
        <AdSlot type="banner" adSlot="1234567890" />

        {/* ───────── 데이터 영역 (스트리밍) ───────── */}
        <Suspense fallback={<HomeSectionsSkeleton />}>
          <HomeSections />
        </Suspense>

        {/* ───────── 서비스 소개 (즉시 렌더) ───────── */}
        <section className="mt-12">
          <ul className="grid gap-4 sm:grid-cols-3">
            <ServiceItem
              icon={<Building2 className="h-6 w-6" aria-hidden />}
              title="공식 데이터"
              desc="국토교통부 실거래가 공개시스템"
            />
            <ServiceItem
              icon={<Zap className="h-6 w-6" aria-hidden />}
              title="실시간 업데이트"
              desc="매일 오전 6시 갱신"
            />
            <ServiceItem
              icon={<Smartphone className="h-6 w-6" aria-hidden />}
              title="어디서든 확인"
              desc="PC, 태블릿, 스마트폰"
            />
          </ul>
        </section>

        {/* 푸터 광고 */}
        <AdSlot type="footer" adSlot="0987654321" />
      </Container>
    </>
  );
}

/** 데이터 의존 섹션 (신뢰지표 + 신고가 + 인기지역) — async, Suspense 로 스트리밍 */
async function HomeSections(): Promise<JSX.Element> {
  const { regions, newHighs, total } = await loadHomeData();
  const countByLawd = new Map<string, number>(
    regions.map(({ region, recentCount }) => [region.lawdCd, recentCount]),
  );

  return (
    <>
      {/* 신뢰 지표 */}
      <p className="mt-2 text-center text-sm text-content-secondary">
        📊 오늘 전국 거래{" "}
        <span className="num font-bold text-content">
          {total.toLocaleString("ko-KR")}
        </span>
        건 업데이트
      </p>

      {/* 오늘의 신고가 */}
      <section className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-bold">
          <Flame className="h-5 w-5 text-accent" aria-hidden />
          오늘의 신고가
        </h2>
        {newHighs.length > 0 ? (
          <ul className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
            {newHighs.map((deal) => (
              <li key={deal.id} className="min-w-[260px] sm:min-w-0">
                <Link
                  href={`/${encodeURIComponent(deal.sido)}/${encodeURIComponent(deal.gugun)}/${encodeURIComponent(deal.aptName)}${deal.dong ? `?dong=${encodeURIComponent(deal.dong)}` : ""}`}
                  className="block rounded-xl border border-l-[3px] border-l-accent bg-[#FFF5F5] p-4 shadow-sm outline-none transition-colors hover:bg-[#FFEBEB] focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-heading font-semibold">
                      {displayAptName(deal.aptName)}
                    </span>
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                      신고가
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold tabular-nums">
                    {deal.amountText}
                  </p>
                  <p className="mt-1 text-sm text-content-secondary">
                    {deal.regionLabel} {deal.dong} · {deal.pyeong}평
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-content-muted">
            표시할 신고가 데이터가 없습니다.
          </p>
        )}
      </section>

      {/* 인기 지역 바로가기 */}
      <section className="mt-12">
        <h2 className="mb-4 font-heading text-xl font-bold">인기 지역 바로가기</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR_REGIONS.map((region) => {
            const count = countByLawd.get(region.lawdCd) ?? 0;
            const href = `/${encodeURIComponent(region.sido)}/${encodeURIComponent(region.gugun)}`;
            return (
              <li key={region.lawdCd}>
                <Link
                  href={href}
                  className="flex flex-col items-center gap-1 rounded-xl border bg-card p-4 text-center outline-none transition-colors hover:border-primary hover:shadow-card focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="text-2xl" aria-hidden>
                    {region.emoji}
                  </span>
                  <span className="font-semibold">{region.label}</span>
                  <span className="text-xs tabular-nums text-content-muted">
                    최근 거래 {count.toLocaleString("ko-KR")}건
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** HomeSections 스켈레톤 (스트리밍 fallback) */
function HomeSectionsSkeleton(): JSX.Element {
  return (
    <div aria-busy="true">
      <div className="mt-2 flex justify-center">
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="mt-8 h-7 w-40" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-12 h-7 w-44" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** 서비스 소개 아이템 */
function ServiceItem({
  icon,
  title,
  desc,
}: {
  icon: JSX.Element;
  title: string;
  desc: string;
}): JSX.Element {
  return (
    <li className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary">
        {icon}
      </span>
      <span className="font-heading text-lg font-bold">{title}</span>
      <span className="text-sm text-content-secondary">{desc}</span>
    </li>
  );
}
