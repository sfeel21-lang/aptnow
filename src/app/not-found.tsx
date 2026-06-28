import Link from "next/link";
import { MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";

/** 인기 지역 바로가기 (404 안내용) */
const POPULAR_REGIONS = [
  { sido: "서울특별시", gugun: "강남구", label: "강남구" },
  { sido: "서울특별시", gugun: "서초구", label: "서초구" },
  { sido: "서울특별시", gugun: "송파구", label: "송파구" },
  { sido: "서울특별시", gugun: "마포구", label: "마포구" },
  { sido: "서울특별시", gugun: "용산구", label: "용산구" },
  { sido: "경기도", gugun: "성남시 분당구", label: "분당구" },
] as const;

/** 404 페이지 — 찾을 수 없는 지역/경로 */
export default function NotFound(): JSX.Element {
  return (
    <Container className="py-20">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <span className="font-heading text-5xl font-bold text-primary">404</span>
        <h1 className="mt-3 font-heading text-xl font-bold">
          찾을 수 없는 지역이에요
        </h1>
        <p className="mt-2 text-sm text-content-secondary">
          주소가 바뀌었거나 존재하지 않는 지역입니다. 아래 인기 지역에서 바로
          확인해 보세요.
        </p>

        {/* 인기 지역 바로가기 */}
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {POPULAR_REGIONS.map((region) => (
            <li key={`${region.sido}-${region.gugun}`}>
              <Link
                href={`/${encodeURIComponent(region.sido)}/${encodeURIComponent(region.gugun)}`}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
                {region.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          홈으로 가기
        </Link>
      </div>
    </Container>
  );
}
