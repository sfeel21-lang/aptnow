import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { AdSlot } from "@/components/ui/AdSlot";
import { DealTableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { DealTable } from "@/components/deals/DealTable";
import { CopyButton } from "@/components/deals/CopyButton";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import {
  fetchAptRentsMultiMonth,
  filterByRentKind,
} from "@/lib/api/molitRent";
import { computeNewHighFlags } from "@/lib/deals/analysis";
import { displayAptName, formatAmountKorean } from "@/lib/utils/format";
import { getGugunList, getLawdCd } from "@/lib/constants/regionCodes";
import { SITE } from "@/lib/constants";
import type { AptDeal } from "@/types";

/** 기간 탭 정의 */
const PERIODS = [
  { id: "1m", label: "이번달", months: 1 },
  { id: "3m", label: "3개월", months: 3 },
  { id: "6m", label: "6개월", months: 6 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

/** 거래 유형 탭 정의 (매매/전세/월세) */
const DEAL_TYPES = [
  { id: "sale", label: "매매", ready: true },
  { id: "jeonse", label: "전세", ready: true },
  { id: "wolse", label: "월세", ready: true },
] as const;
type DealTypeId = (typeof DEAL_TYPES)[number]["id"];

interface RegionPageProps {
  params: { sido: string; gugun: string };
  searchParams: { period?: string; type?: string; dong?: string };
}

function resolvePeriod(value: string | undefined): (typeof PERIODS)[number] {
  return PERIODS.find((p) => p.id === value) ?? PERIODS[0];
}
function resolveType(value: string | undefined): (typeof DEAL_TYPES)[number] {
  return DEAL_TYPES.find((t) => t.id === value) ?? DEAL_TYPES[0];
}

/** 현재 연월 라벨 (예: "2024년 11월") */
function currentMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

/** 지역 거래를 조회해 신고가까지 계산한다 (서버) */
/** 변동률(전고가 대비) 계산용 히스토리 범위(개월) */
const HISTORY_MONTHS = 12;

/**
 * 지역 거래를 조회해 신고가/변동률을 계산한 뒤, 선택 기간(months)만 반환한다.
 * - 변동률을 의미 있게 계산하려고 12개월 히스토리로 전고가를 잡고,
 *   화면에는 선택한 기간(이번달/3개월/6개월) 거래만 노출한다.
 */
async function loadRegionDeals(
  lawdCd: string,
  months: number,
): Promise<AptDeal[]> {
  const history = computeNewHighFlags(
    await fetchAptDealsMultiMonth(lawdCd, HISTORY_MONTHS),
  );
  const cutoff = periodCutoffYmd(months);
  return history.filter((d) => dealYmd(d) >= cutoff);
}

/**
 * 거래 유형(매매/전세/월세)에 맞는 지역 거래를 조회한다.
 * - 전월세는 종류별(전세/월세)로 먼저 분리한 뒤 신고가/변동률을 계산해
 *   보증금 기준 비교가 서로 섞이지 않게 한다.
 */
async function loadRegionByType(
  lawdCd: string,
  months: number,
  type: DealTypeId,
): Promise<AptDeal[]> {
  if (type === "sale") return loadRegionDeals(lawdCd, months);

  const kind = type === "jeonse" ? "jeonse" : "wolse";
  const all = await fetchAptRentsMultiMonth(lawdCd, HISTORY_MONTHS);
  const history = computeNewHighFlags(filterByRentKind(all, kind));
  const cutoff = periodCutoffYmd(months);
  return history.filter((d) => dealYmd(d) >= cutoff);
}

/** 거래일("2026.06.05")에서 연월 키("202606") 추출 */
function dealYmd(deal: AptDeal): string {
  return deal.dealDate.slice(0, 7).replace(".", "");
}

/** 최근 months 개월의 가장 이른 연월 키(YYYYMM) */
function periodCutoffYmd(months: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 동적 메타데이터 (SEO) */
export async function generateMetadata({
  params,
  searchParams,
}: RegionPageProps): Promise<Metadata> {
  const sido = decodeURIComponent(params.sido);
  const gugun = decodeURIComponent(params.gugun);
  const dong = searchParams.dong ? decodeURIComponent(searchParams.dong) : "";
  const regionLabel = dong ? `${gugun} ${dong}` : gugun;
  const lawdCd = getLawdCd(sido, gugun);
  const monthLabel = currentMonthLabel();

  let count = 0;
  let aptNames = "";
  if (lawdCd) {
    try {
      const deals = await fetchAptDealsMultiMonth(lawdCd, 1);
      count = deals.length;
      aptNames = Array.from(new Set(deals.map((d) => displayAptName(d.aptName))))
        .slice(0, 2)
        .join(", ");
    } catch {
      /* 일반 설명 사용 */
    }
  }

  const description = aptNames
    ? `${regionLabel} 아파트 매매 실거래가 최신 정보. ${aptNames} 등 이번달 거래 ${count}건.`
    : `${regionLabel} 아파트 매매 실거래가 최신 정보를 국토교통부 공식 데이터로 확인하세요.`;

  return {
    title: {
      absolute: `${regionLabel} 아파트 실거래가 ${monthLabel} | ${SITE.name}`,
    },
    description,
    alternates: {
      canonical: `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`,
    },
  };
}

/**
 * 지역별 실거래가 페이지.
 * - 브레드크럼/제목/탭/광고는 즉시 렌더(셸), 데이터(목록+통계)는 Suspense 로 스트리밍.
 */
export default function RegionPage({
  params,
  searchParams,
}: RegionPageProps): JSX.Element {
  const sido = decodeURIComponent(params.sido);
  const gugun = decodeURIComponent(params.gugun);
  const lawdCd = getLawdCd(sido, gugun);
  if (!lawdCd) notFound();

  const period = resolvePeriod(searchParams.period);
  const dealType = resolveType(searchParams.type);
  // 선택된 읍/면/동 (있으면 결과를 해당 동으로 필터)
  const dong = searchParams.dong ? decodeURIComponent(searchParams.dong) : "";
  const regionPath = `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`;

  const tabHref = (next: { period?: PeriodId; type?: DealTypeId }): string => {
    const p = next.period ?? period.id;
    const t = next.type ?? dealType.id;
    const dongQuery = dong ? `&dong=${encodeURIComponent(dong)}` : "";
    return `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}?period=${p}&type=${t}${dongQuery}`;
  };

  // JSON-LD: LocalBusiness(지역 서비스) + Dataset(실거래가 데이터셋)
  const pageUrl = `${SITE.url}/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: `${gugun} 아파트 실거래가 - ${SITE.name}`,
        url: pageUrl,
        areaServed: { "@type": "AdministrativeArea", name: `${sido} ${gugun}` },
        description: `${sido} ${gugun}의 아파트 매매 실거래가 정보`,
      },
      {
        "@type": "Dataset",
        name: `${gugun} 아파트 매매 실거래가`,
        description: `국토교통부 실거래가 공개시스템 기반 ${gugun} 아파트 매매 실거래 데이터`,
        url: pageUrl,
        creator: { "@type": "GovernmentOrganization", name: "국토교통부" },
        license: "https://www.data.go.kr",
        isAccessibleForFree: true,
      },
    ],
  };

  return (
    <Container className="py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 브레드크럼 */}
      <nav
        aria-label="현재 위치"
        className="flex items-center gap-1 text-sm text-content-secondary"
      >
        <Link href="/" className="hover:text-content">
          홈
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span>{sido}</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className={dong ? "" : "text-content"}>{gugun}</span>
        {dong ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-content">{dong}</span>
          </>
        ) : null}
      </nav>

      {/* 제목 */}
      <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">
        {gugun}
        {dong ? ` ${dong}` : ""} 아파트 실거래가
      </h1>

      {/* 기간 / 거래 유형 탭 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg bg-surface p-0.5">
          {PERIODS.map((p) => (
            <TabLink
              key={p.id}
              href={tabHref({ period: p.id })}
              active={p.id === period.id}
              label={p.label}
            />
          ))}
        </div>
        <div className="flex items-center rounded-lg bg-surface p-0.5">
          {DEAL_TYPES.map((t) => (
            <TabLink
              key={t.id}
              href={tabHref({ type: t.id })}
              active={t.id === dealType.id}
              label={t.label}
              muted={!t.ready}
            />
          ))}
        </div>

        {/* 최고가 순위 바로가기 */}
        <Link
          href={
            dong
              ? `${regionPath}/ranking?dong=${encodeURIComponent(dong)}`
              : `${regionPath}/ranking`
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Trophy className="h-4 w-4" aria-hidden />
          최고가 순위
        </Link>
      </div>

      {/* 배너 광고 */}
      <AdSlot type="banner" adSlot="1234567890" />

      {/* 데이터 영역 (period/type 변경 시 key 로 재-suspense → 스켈레톤 재노출) */}
      <Suspense
        key={`${period.id}-${dealType.id}-${dong}`}
        fallback={<RegionBodySkeleton />}
      >
        <RegionBody
          lawdCd={lawdCd}
          months={period.months}
          type={dealType.id}
          typeLabel={dealType.label}
          sido={sido}
          gugun={gugun}
          dong={dong}
        />
      </Suspense>

      {/* 푸터 광고 */}
      <AdSlot type="footer" adSlot="0987654321" />
    </Container>
  );
}

/* ───────────────────────── 데이터 영역 ───────────────────────── */

interface RegionBodyProps {
  lawdCd: string;
  months: number;
  /** 거래 유형 (매매/전세/월세) */
  type: DealTypeId;
  /** 거래 유형 라벨 */
  typeLabel: string;
  sido: string;
  gugun: string;
  /** 선택된 읍/면/동 (있으면 해당 동으로 필터) */
  dong: string;
}

/** 목록 + 사이드바 (async, Suspense 로 스트리밍) */
async function RegionBody({
  lawdCd,
  months,
  type,
  typeLabel,
  sido,
  gugun,
  dong,
}: RegionBodyProps): Promise<JSX.Element> {
  const all = await loadRegionByType(lawdCd, months, type);
  // 읍/면/동이 선택되면 해당 동의 거래만 표시
  const deals = dong ? all.filter((d) => d.dong === dong) : all;
  // 사이드바/공유에 쓸 지역 라벨
  const regionLabel = dong ? `${gugun} ${dong}` : gugun;
  const isRent = type !== "sale";

  const total = deals.length;
  const newHighCount = deals.filter((d) => d.isNewHigh).length;
  const avgAmount =
    total > 0 ? Math.round(deals.reduce((s, d) => s + d.amount, 0) / total) : 0;
  // 월세 평균(월세 거래만)
  const wolseDeals = deals.filter((d) => (d.monthlyRent ?? 0) > 0);
  const avgMonthly =
    wolseDeals.length > 0
      ? Math.round(
          wolseDeals.reduce((s, d) => s + (d.monthlyRent ?? 0), 0) /
            wolseDeals.length,
        )
      : 0;
  const avgPyeong =
    total > 0 ? Math.round(deals.reduce((s, d) => s + d.pyeong, 0) / total) : 0;

  // 거래 유형별 평균가 라벨/값
  const avgLabel = isRent ? "평균 보증금" : "평균 거래가";

  const nearby = getGugunList(sido)
    .filter((g) => g !== gugun)
    .slice(0, 6);

  return (
    <div className="mt-4 flex gap-8">
      {/* 좌측: 목록 + 공유 */}
      <div className="min-w-0 flex-1">
        <DealTable
          deals={deals}
          region={regionLabel}
          regionPath={`/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`}
          dealType={type}
        />
        {deals.length > 0 ? (
          <CopyButton
            deals={deals}
            region={regionLabel}
            typeLabel={typeLabel}
          />
        ) : null}
      </div>

      {/* 우측: 사이드바 (PC 전용) */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-20 space-y-4">
          <AdSlot type="sidebar" adSlot="1112223334" className="my-0" />

          <div className="rounded-xl border bg-card p-4 shadow-card">
            <h2 className="mb-3 font-heading font-bold">{typeLabel} 통계</h2>
            <dl className="space-y-2 text-sm">
              <StatRow label="총 거래" value={`${total.toLocaleString("ko-KR")}건`} />
              <StatRow label="신고가" value={`${newHighCount}건`} accent />
              <StatRow label={avgLabel} value={formatAmountKorean(avgAmount)} />
              {type === "wolse" && avgMonthly > 0 ? (
                <StatRow
                  label="평균 월세"
                  value={`${avgMonthly.toLocaleString("ko-KR")}만`}
                />
              ) : null}
              <StatRow label="평균 전용면적" value={`${avgPyeong}평`} />
            </dl>
          </div>

          {nearby.length > 0 ? (
            <nav
              aria-label="인근 지역"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <h2 className="mb-3 font-heading font-bold">인근 지역</h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {nearby.map((g) => (
                  <li key={g}>
                    <Link
                      href={`/${encodeURIComponent(sido)}/${encodeURIComponent(g)}`}
                      className="inline-block rounded-full border px-3 py-1.5 text-content-secondary outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {g}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/** RegionBody 스켈레톤 (스트리밍 fallback) */
function RegionBodySkeleton(): JSX.Element {
  return (
    <div className="mt-4 flex gap-8" aria-busy="true">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>
        <DealTableSkeleton />
      </div>
      <aside className="hidden w-72 shrink-0 lg:block">
        <Skeleton className="h-[250px] w-full rounded-xl" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </aside>
    </div>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

function TabLink({
  href,
  active,
  label,
  muted = false,
}: {
  href: string;
  active: boolean;
  label: string;
  muted?: boolean;
}): JSX.Element {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-card text-primary shadow-card"
          : muted
            ? "text-content-muted hover:text-content-secondary"
            : "text-content-secondary hover:text-content",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function StatRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-content-secondary">{label}</dt>
      <dd
        className={[
          "font-semibold tabular-nums",
          accent ? "text-accent" : "text-content",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
