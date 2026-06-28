import Link from "next/link";
import { Home } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { FOOTER_LINKS, SITE } from "@/lib/constants";

/**
 * 전역 하단 푸터.
 * - 다크 배경(#0F172A) + 흐린 텍스트(#94A3B8) 로 본문과 시각적으로 구분한다.
 * - [영업적 관점] 데이터 출처(국토교통부) 명시로 신뢰도를 높이고,
 *   면책조항을 표기해 AdSense 등 광고 정책 준수 근거를 마련한다.
 */
export function Footer(): JSX.Element {
  // 저작권 연도는 렌더링 시점 기준으로 자동 표기 (서버 컴포넌트)
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-content text-content-muted">
      <Container className="py-10">
        {/* ── 상단 3분할: 로고/설명 · 링크 · 면책조항 ── */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* 좌측: 로고 + 서비스 설명 */}
          <div>
            <Link
              href="/"
              aria-label={`${SITE.name} 홈으로 이동`}
              className="inline-flex items-center gap-1.5 font-heading text-lg font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-content"
            >
              <Home className="h-5 w-5" aria-hidden />
              <span>{SITE.name}</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed">
              국토교통부 실거래가 공개시스템 데이터를 기반으로 합니다.
            </p>
          </div>

          {/* 중앙: 주요 지역 링크 */}
          <nav aria-label="지역 바로가기">
            <h2 className="text-sm font-semibold text-white">바로가기</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-content"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 우측: 면책조항 */}
          <div>
            <h2 className="text-sm font-semibold text-white">면책조항</h2>
            <p className="mt-3 text-sm leading-relaxed">
              본 서비스의 정보는 참고용이며, 실제 거래 시 반드시 공인중개사와
              확인하시기 바랍니다.
            </p>
          </div>
        </div>

        {/* ── 하단: 저작권 + 데이터 출처 + 이메일 문의 ── */}
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            Copyright © {year} {SITE.name} ·{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="rounded underline-offset-2 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-content"
            >
              이메일 문의
            </a>
          </p>
          {/* [영업적 관점] 데이터 출처 명시 → 신뢰도 상승 */}
          <p>데이터 출처: 국토교통부 실거래가 공개시스템</p>
        </div>
      </Container>
    </footer>
  );
}
