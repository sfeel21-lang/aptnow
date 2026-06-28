import { Container } from "@/components/ui/Container";

/**
 * 지역 페이지 로딩 스켈레톤.
 * - 서버 데이터 패칭 동안 표시된다.
 */
export default function RegionLoading(): JSX.Element {
  return (
    <Container className="py-8">
      {/* 제목/탭 자리 */}
      <div className="h-4 w-40 animate-pulse rounded bg-border" />
      <div className="mt-3 h-8 w-56 animate-pulse rounded bg-border" />
      <div className="mt-4 flex gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-border" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-border" />
      </div>

      {/* 목록 스켈레톤 */}
      <div className="mt-6 overflow-hidden rounded-lg border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 items-center gap-4 border-b px-4 last:border-b-0"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-border" />
            <div className="h-4 w-20 animate-pulse rounded bg-border" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    </Container>
  );
}
