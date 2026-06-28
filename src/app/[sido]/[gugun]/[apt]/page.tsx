import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { AdSlot } from "@/components/ui/AdSlot";
import { Skeleton } from "@/components/ui/Skeleton";
import { AptHistoryView } from "@/components/deals/AptHistoryView";
import { fetchAptDealsMultiMonth } from "@/lib/api/molit";
import {
  fetchAptRentsMultiMonth,
  filterByRentKind,
} from "@/lib/api/molitRent";
import { fetchAptMeta, type AptMeta } from "@/lib/api/kapt";
import { computeNewHighFlags } from "@/lib/deals/analysis";
import { displayAptName } from "@/lib/utils/format";
import { getLawdCd } from "@/lib/constants/regionCodes";
import { SITE } from "@/lib/constants";
import type { AptDeal } from "@/types";

/** 단지 이력 조회 기간(개월) */
const HISTORY_MONTHS = 12;

/** 거래 유형 탭 정의 */
const DEAL_TYPES = [
  { id: "sale", label: "매매" },
  { id: "jeonse", label: "전세" },
  { id: "wolse", label: "월세" },
] as const;
type DealTypeId = (typeof DEAL_TYPES)[number]["id"];

function resolveType(value: string | undefined): (typeof DEAL_TYPES)[number] {
  return DEAL_TYPES.find((t) => t.id === value) ?? DEAL_TYPES[0];
}

interface AptPageProps {
  params: { sido: string; gugun: string; apt: string };
  searchParams: { dong?: string; type?: string };
}

/**
 * 특정 단지의 최근 실거래 이력을 거래 유형(매매/전세/월세)별로 조회한다(신고가 계산 포함, 최신순).
 * - dong 이 주어지면 같은 구 내 동명이인 단지를 동까지 맞춰 분리한다.
 * - 전월세는 종류별로 분리한 뒤 신고가/변동률을 계산해 보증금 비교가 섞이지 않게 한다.
 */
async function loadAptHistory(
  lawdCd: string,
  aptName: string,
  type: DealTypeId,
  dong?: string,
): Promise<AptDeal[]> {
  const matchApt = (d: AptDeal): boolean =>
    d.aptName === aptName && (!dong || d.dong === dong);

  if (type === "sale") {
    const all = await fetchAptDealsMultiMonth(lawdCd, HISTORY_MONTHS);
    return computeNewHighFlags(all.filter(matchApt));
  }

  const kind = type === "jeonse" ? "jeonse" : "wolse";
  const all = await fetchAptRentsMultiMonth(lawdCd, HISTORY_MONTHS);
  const matched = filterByRentKind(all, kind).filter(matchApt);
  return computeNewHighFlags(matched);
}

/** 동적 메타데이터 (SEO) */
export function generateMetadata({
  params,
  searchParams,
}: AptPageProps): Metadata {
  const gugun = decodeURIComponent(params.gugun);
  const apt = displayAptName(decodeURIComponent(params.apt));
  const dong = searchParams.dong ? decodeURIComponent(searchParams.dong) : "";
  const typeLabel = resolveType(searchParams.type).label;
  const place = dong ? `${gugun} ${dong}` : gugun;
  const dongQuery = dong ? `?dong=${encodeURIComponent(dong)}` : "";
  return {
    title: { absolute: `${apt} ${typeLabel} 실거래가 (${place}) | ${SITE.name}` },
    description: `${place} ${apt}의 ${typeLabel} 실거래가와 과거 거래 이력을 국토교통부 공식 데이터로 확인하세요.`,
    alternates: {
      canonical: `/${encodeURIComponent(params.sido)}/${encodeURIComponent(params.gugun)}/${encodeURIComponent(params.apt)}${dongQuery}`,
    },
  };
}

/**
 * 단지 상세 페이지.
 * - 특정 아파트의 매매 실거래 이력(최신/과거)을 한 페이지로 보여준다.
 * - 셸(브레드크럼/제목)은 즉시 렌더, 이력은 Suspense 로 스트리밍.
 */
export default function AptPage({
  params,
  searchParams,
}: AptPageProps): JSX.Element {
  const sido = decodeURIComponent(params.sido);
  const gugun = decodeURIComponent(params.gugun);
  const apt = decodeURIComponent(params.apt);
  // 화면 표시용(동 목록 괄호 제거) — 매칭/링크에는 원본 apt 사용
  const aptDisplay = displayAptName(apt);
  const dong = searchParams.dong ? decodeURIComponent(searchParams.dong) : "";
  const dealType = resolveType(searchParams.type);
  const lawdCd = getLawdCd(sido, gugun);
  if (!lawdCd) notFound();

  const regionPath = `/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`;
  // 같은 동의 목록(+거래유형)으로 돌아가도록 필터를 유지
  const backQuery = [
    dong ? `dong=${encodeURIComponent(dong)}` : "",
    dealType.id !== "sale" ? `type=${dealType.id}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const backPath = backQuery ? `${regionPath}?${backQuery}` : regionPath;

  // 상세 페이지 내 거래유형 탭 링크 (동 필터 유지)
  const aptPath = `${regionPath}/${encodeURIComponent(apt)}`;
  const typeHref = (type: DealTypeId): string => {
    const q = [
      dong ? `dong=${encodeURIComponent(dong)}` : "",
      type !== "sale" ? `type=${type}` : "",
    ]
      .filter(Boolean)
      .join("&");
    return q ? `${aptPath}?${q}` : aptPath;
  };

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
        {dong ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <Link href={backPath} className="hover:text-content">
              {dong}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-content">{aptDisplay}</span>
      </nav>

      {/* 제목 */}
      <h1 className="mt-2 flex items-center gap-2 font-heading text-2xl font-bold sm:text-3xl">
        <Building2 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        {aptDisplay}
      </h1>
      {dong ? (
        <p className="mt-1 text-sm text-content-secondary">
          {gugun} {dong}
        </p>
      ) : null}

      {/* 목록으로 돌아가기 */}
      <Link
        href={backPath}
        className="mt-2 inline-flex items-center gap-1 text-sm text-content-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {dong ? `${gugun} ${dong}` : gugun} 실거래가 목록으로
      </Link>

      {/* 단지 정보 (K-apt, 스트리밍 — 이력과 독립) */}
      <Suspense fallback={<AptMetaSkeleton />}>
        <AptMetaBody lawdCd={lawdCd} aptName={apt} dong={dong} />
      </Suspense>

      {/* 배너 광고 */}
      <AdSlot type="banner" adSlot="1234567890" />

      {/* 거래 유형 탭 (매매/전세/월세) */}
      <div className="mt-6 flex w-fit items-center rounded-lg bg-surface p-0.5">
        {DEAL_TYPES.map((t) => (
          <Link
            key={t.id}
            href={typeHref(t.id)}
            aria-current={t.id === dealType.id ? "page" : undefined}
            className={[
              "rounded-md px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              t.id === dealType.id
                ? "bg-card text-primary shadow-card"
                : "text-content-secondary hover:text-content",
            ].join(" ")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 이력 (스트리밍) — 유형 변경 시 재-suspense */}
      <Suspense key={`${dealType.id}-${dong}`} fallback={<AptHistorySkeleton />}>
        <AptHistoryBody
          lawdCd={lawdCd}
          aptName={apt}
          gugun={gugun}
          dong={dong}
          type={dealType.id}
          typeLabel={dealType.label}
        />
      </Suspense>

      {/* 푸터 광고 */}
      <AdSlot type="footer" adSlot="0987654321" />
    </Container>
  );
}

/* ───────────────────────── 데이터 영역 ───────────────────────── */

interface AptHistoryBodyProps {
  lawdCd: string;
  aptName: string;
  gugun: string;
  dong?: string;
  /** 거래 유형 */
  type: DealTypeId;
  /** 거래 유형 라벨 */
  typeLabel: string;
}

/** 단지 이력 본문 (async, Suspense 로 스트리밍 → 평형 필터는 클라이언트에서) */
async function AptHistoryBody({
  lawdCd,
  aptName,
  gugun,
  dong,
  type,
  typeLabel,
}: AptHistoryBodyProps): Promise<JSX.Element> {
  const deals = await loadAptHistory(lawdCd, aptName, type, dong);

  if (deals.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed py-16 text-center text-sm text-content-muted">
        최근 {HISTORY_MONTHS}개월간 {displayAptName(aptName)}의 {typeLabel} 실거래
        내역이 없습니다.
      </div>
    );
  }

  return (
    <AptHistoryView
      deals={deals}
      gugun={gugun}
      months={HISTORY_MONTHS}
      dealTypeLabel={typeLabel}
    />
  );
}

/* ───────────────────────── 단지 정보(K-apt) ───────────────────────── */

interface AptMetaBodyProps {
  lawdCd: string;
  aptName: string;
  dong?: string;
}

/** 단지 기본정보 본문 (async, 스트리밍) — 없으면 아무것도 렌더하지 않음 */
async function AptMetaBody({
  lawdCd,
  aptName,
  dong,
}: AptMetaBodyProps): Promise<JSX.Element | null> {
  const meta = await fetchAptMeta(lawdCd, aptName, dong || undefined);
  if (!meta) return null;
  return <AptMetaCard meta={meta} />;
}

/** 단지 정보 카드 (세대수/동수/준공 등, 값이 있는 항목만 표시) */
function AptMetaCard({ meta }: { meta: AptMeta }): JSX.Element | null {
  const stats: { label: string; value: string }[] = [];
  if (meta.householdCount > 0)
    stats.push({
      label: "세대수",
      value: `${meta.householdCount.toLocaleString("ko-KR")}세대`,
    });
  if (meta.dongCount > 0)
    stats.push({ label: "동수", value: `${meta.dongCount}개동` });
  if (meta.buildYear > 0)
    stats.push({ label: "준공", value: `${meta.buildYear}년` });
  if (meta.topFloor > 0)
    stats.push({ label: "최고층", value: `${meta.topFloor}층` });
  if (meta.aptType) stats.push({ label: "유형", value: meta.aptType });
  if (meta.heatType) stats.push({ label: "난방", value: meta.heatType });
  if (meta.hallType) stats.push({ label: "복도", value: meta.hallType });

  // 표시할 정보가 전혀 없으면 카드 자체를 생략
  if (stats.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-content-secondary">단지 정보</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-content-muted">{s.label}</dt>
            <dd className="mt-0.5 font-heading font-semibold tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {meta.roadAddress ? (
        <p className="mt-3 text-xs text-content-secondary">{meta.roadAddress}</p>
      ) : null}
      <p className="mt-2 text-right text-xs text-content-muted">
        출처: 공동주택관리정보시스템(K-apt)
      </p>
    </section>
  );
}

/** 단지 정보 스켈레톤 (스트리밍 fallback) */
function AptMetaSkeleton(): JSX.Element {
  return (
    <div className="mt-6 rounded-xl border p-4 sm:p-5" aria-busy="true">
      <Skeleton className="h-4 w-20" />
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-10" />
            <Skeleton className="mt-1 h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

/** 이력 스켈레톤 (스트리밍 fallback) */
function AptHistorySkeleton(): JSX.Element {
  return (
    <div className="mt-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-4 w-48" />
      <Skeleton className="mt-3 h-64 rounded-lg" />
    </div>
  );
}
