"use client";

import { useState } from "react";
import Link from "next/link";
import { Home, Share2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { VisitorCounter } from "@/components/ui/VisitorCounter";
import { SearchBar } from "@/components/ui/SearchBar";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

/** 거래 유형 탭 식별자 */
type DealTab = "sale" | "rent";

interface HeaderProps {
  /**
   * 오늘 신고가 건수 (재방문 유도 뱃지에 표시).
   * - 실제 데이터 연동 전까지는 데모 기본값을 사용한다.
   */
  newHighCount?: number;
}

/** 우측 거래 유형 탭 목록 */
const DEAL_TABS: ReadonlyArray<{ id: DealTab; label: string }> = [
  { id: "sale", label: "매매" },
  { id: "rent", label: "전세/월세" },
];

/**
 * 전역 상단 헤더.
 * - 높이 60px, 흰색 배경 + 하단 border, 스크롤 시 sticky 고정 + 배경 blur
 * - 좌측 로고/뱃지 / 중앙 검색(SearchBar) / 우측 거래 유형 탭 + 카페 공유
 * - 검색은 SearchBar 가 PC 인라인 자동완성 + 모바일 전체화면 오버레이를 담당한다.
 */
export function Header({ newHighCount = 12 }: HeaderProps): JSX.Element {
  // 현재 선택된 거래 유형 탭
  const [activeTab, setActiveTab] = useState<DealTab>("sale");

  return (
    <header className="sticky top-0 z-50 h-[60px] border-b bg-card/80 backdrop-blur-sm">
      <Container className="flex h-full items-center justify-between gap-4">
        {/* ── 좌측: 로고 + 신고가 뱃지 + 방문자 ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label={`${SITE.name} 홈으로 이동`}
            className="flex items-center gap-1.5 rounded-md font-heading text-lg font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Home className="h-5 w-5" aria-hidden />
            <span>{SITE.name}</span>
          </Link>

          {/* 재방문 유도 뱃지: 오늘 신고가 N건 (빨간 점 깜빡임) */}
          {newHighCount > 0 ? (
            <Link
              href="/?filter=new-high"
              aria-label={`오늘 신고가 ${newHighCount}건 보기`}
              className="hidden items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium text-content-secondary outline-none transition-colors hover:text-content focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              오늘 신고가 <span className="num font-semibold text-accent">{newHighCount}</span>건
            </Link>
          ) : null}

          {/* 오늘 방문자 카운터 (신뢰도 구축) */}
          <VisitorCounter />
        </div>

        {/* ── 중앙: 단지 검색 (PC 인라인 / 모바일 오버레이) ── */}
        <SearchBar className="ml-auto flex-1 md:ml-0 md:max-w-md" />

        {/* ── 우측: 거래 유형 탭 + 카페 공유 ── */}
        <div className="flex items-center gap-2">
          {/* 거래 유형 탭 (PC 전용) */}
          <nav
            aria-label="거래 유형 선택"
            className="hidden items-center rounded-md bg-surface p-0.5 md:flex"
          >
            {DEAL_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-card text-primary shadow-card"
                      : "text-content-secondary hover:text-content",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* 카페 공유 버튼 (네이버 그린) — 모바일에서는 숨김 */}
          <a
            href="https://cafe.naver.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="네이버 카페에 공유하기"
            className="hidden items-center gap-1.5 rounded-md bg-[#03C75A] px-3 py-1.5 text-sm font-semibold text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#03C75A] focus-visible:ring-offset-2 sm:inline-flex"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            카페 공유
          </a>
        </div>
      </Container>
    </header>
  );
}
