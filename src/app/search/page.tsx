import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, MapPin, SearchX } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  enrichWithRecentDeal,
  searchApartments,
  POPULAR_APARTMENTS,
  type EnrichedEntry,
} from "@/lib/data/apartments";
import { displayAptName } from "@/lib/utils/format";
import { SITE } from "@/lib/constants";

/** 결과 페이지 최대 표시 수 */
const RESULT_LIMIT = 12;

interface SearchPageProps {
  searchParams: { q?: string };
}

/** 동적 메타데이터 */
export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const q = (searchParams.q ?? "").trim();
  return {
    title: q ? `'${q}' 검색결과 | ${SITE.name}` : `단지 검색 | ${SITE.name}`,
    description: q
      ? `'${q}' 아파트 단지 실거래가 검색 결과`
      : "아파트 단지명으로 실거래가를 검색하세요.",
    robots: { index: false }, // 검색 결과 페이지는 색인 제외
  };
}

/** 단지 검색 결과 페이지 (서버 컴포넌트) */
export default async function SearchPage({
  searchParams,
}: SearchPageProps): Promise<JSX.Element> {
  const query = (searchParams.q ?? "").trim();
  const entries = query ? searchApartments(query, undefined, RESULT_LIMIT) : [];
  const results = entries.length > 0 ? await enrichWithRecentDeal(entries) : [];

  return (
    <Container className="py-8">
      {/* 검색바 */}
      <div className="mx-auto max-w-xl">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBar className="w-full max-w-none md:block" />
        </Suspense>
      </div>

      {/* 본문 */}
      <div className="mx-auto mt-8 max-w-3xl">
        {!query ? (
          // 검색어 없음 → 인기 단지 추천
          <PopularSection title="인기 단지" />
        ) : results.length === 0 ? (
          // 결과 없음 → 안내 + 인기 단지
          <>
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SearchX className="h-8 w-8 text-content-muted" aria-hidden />
              <p className="font-semibold">
                &lsquo;{query}&rsquo; 검색 결과가 없습니다
              </p>
              <p className="text-sm text-content-secondary">
                단지명을 다시 확인하거나 아래 인기 단지를 확인해 보세요.
              </p>
            </div>
            <PopularSection title="이런 단지는 어때요?" />
          </>
        ) : (
          // 결과 목록
          <>
            <h1 className="mb-4 font-heading text-xl font-bold">
              &lsquo;{query}&rsquo; 검색 결과{" "}
              <span className="text-content-secondary">{results.length}건</span>
            </h1>
            <ul className="space-y-3">
              {results.map((entry) => (
                <li key={`${entry.aptName}-${entry.lawdCd}`}>
                  <ResultCard entry={entry} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Container>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

/** 검색 결과 카드 */
function ResultCard({ entry }: { entry: EnrichedEntry }): JSX.Element {
  // 단지 상세 페이지로 이동 (동명이인 분리를 위해 동 포함)
  const href = `/${encodeURIComponent(entry.sido)}/${encodeURIComponent(entry.gugun)}/${encodeURIComponent(entry.aptName)}${entry.dong ? `?dong=${encodeURIComponent(entry.dong)}` : ""}`;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-heading font-semibold">
          <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{displayAptName(entry.aptName)}</span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm text-content-secondary">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {entry.address}
        </p>
      </div>
      {/* 최근 거래가 + 변동률 */}
      <div className="shrink-0 text-right">
        {entry.recentDeal ? (
          <>
            <p className="flex items-center justify-end gap-1.5">
              <span className="font-bold tabular-nums">
                {entry.recentDeal.amountText}
              </span>
              <ChangeBadge changeRate={entry.recentDeal.changeRate} />
            </p>
            <p className="text-xs tabular-nums text-content-muted">
              {entry.recentDeal.dealDate}
            </p>
          </>
        ) : (
          <p className="text-xs text-content-muted">최근 거래 없음</p>
        )}
      </div>
    </Link>
  );
}

/** 변동률 배지 (전고가 대비 ▲빨강 / ▼파랑) */
function ChangeBadge({
  changeRate,
}: {
  changeRate?: number;
}): JSX.Element | null {
  if (changeRate === undefined) return null;
  const up = changeRate >= 0;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${up ? "text-up" : "text-down"}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(changeRate).toFixed(1)}%
    </span>
  );
}

/** 인기 단지 섹션 */
function PopularSection({ title }: { title: string }): JSX.Element {
  return (
    <section>
      <h2 className="mb-3 font-heading font-bold">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {POPULAR_APARTMENTS.map((entry) => (
          <li key={`${entry.aptName}-${entry.lawdCd}`}>
            <Link
              href={`/${encodeURIComponent(entry.sido)}/${encodeURIComponent(entry.gugun)}/${encodeURIComponent(entry.aptName)}${entry.dong ? `?dong=${encodeURIComponent(entry.dong)}` : ""}`}
              className="flex items-center gap-2 rounded-xl border bg-card p-4 outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {displayAptName(entry.aptName)}
                </span>
                <span className="block text-xs text-content-muted">
                  {entry.address}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
