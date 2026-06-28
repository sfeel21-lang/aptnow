"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Container } from "@/components/ui/Container";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 전역 에러 바운더리.
 * - 데이터 조회 실패(공공 API 점검/네트워크 등) 시 표시된다.
 */
export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps): JSX.Element {
  useEffect(() => {
    console.error("[error] 전역 에러:", error);
  }, [error]);

  return (
    <Container className="py-20">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <EmptyHouse />
        <h1 className="font-heading text-xl font-bold">
          데이터를 불러오지 못했어요
        </h1>
        <p className="text-sm text-content-secondary">
          국토교통부 실거래가 시스템 점검 중이거나 일시적인 오류일 수 있습니다.
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          다시 시도
        </button>
      </div>
    </Container>
  );
}

/** 귀여운 빈 집 일러스트 (SVG) */
function EmptyHouse(): JSX.Element {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="빈 집 일러스트"
    >
      {/* 지붕 */}
      <path
        d="M16 44 L48 20 L80 44"
        stroke="#1B4FD8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 벽 */}
      <rect
        x="24"
        y="44"
        width="48"
        height="34"
        rx="3"
        stroke="#94A3B8"
        strokeWidth="4"
        fill="#F8FAFC"
      />
      {/* 문 */}
      <rect x="42" y="58" width="12" height="20" rx="2" fill="#E2E8F0" />
      {/* 슬픈 눈/입 (창문) */}
      <circle cx="36" cy="54" r="2" fill="#94A3B8" />
      <circle cx="60" cy="54" r="2" fill="#94A3B8" />
    </svg>
  );
}
