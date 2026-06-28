"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Container } from "@/components/ui/Container";

interface RegionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 지역 페이지 에러 바운더리.
 * - 데이터 조회 실패(API 키 미설정/네트워크 등) 시 표시된다.
 */
export default function RegionError({
  error,
  reset,
}: RegionErrorProps): JSX.Element {
  useEffect(() => {
    // 에러 로깅 (운영에서는 모니터링 전송)
    console.error("[region] 페이지 에러:", error);
  }, [error]);

  return (
    <Container className="py-20">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-accent" aria-hidden />
        <h1 className="font-heading text-xl font-bold">
          거래 정보를 불러오지 못했습니다
        </h1>
        <p className="text-sm text-content-secondary">
          일시적인 오류이거나 데이터 제공처(국토교통부) 응답에 문제가 있을 수
          있습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          다시 시도
        </button>
      </div>
    </Container>
  );
}
