/**
 * 서비스 전역에서 사용하는 상수 모음.
 * - 환경에 따라 바뀌지 않는 고정값만 둔다.
 */

import { publicConfig } from "@/lib/config";

/** 서비스 메타 정보 */
export const SITE = {
  name: "AptNow",
  title: "AptNow — 아파트 실거래가 조회",
  description: "국토교통부 실거래가 데이터를 빠르게 조회하는 서비스",
  /** 사이트 기본 URL (환경변수 NEXT_PUBLIC_SITE_URL) */
  url: publicConfig.siteUrl,
  /** 문의 이메일 (푸터 등에서 사용) */
  email: "contact@aptnow.kr",
} as const;

/** 푸터 중앙의 주요 지역 바로가기 링크 */
export const FOOTER_LINKS = [
  { label: "홈", href: "/" },
  { label: "서울", href: "/seoul" },
  { label: "경기", href: "/gyeonggi" },
  { label: "인천", href: "/incheon" },
] as const;

/** 헤더 내비게이션 항목 */
export const NAV_ITEMS = [
  { label: "홈", href: "/" },
  { label: "지역별 시세", href: "/seoul" },
] as const;

/** 페이지네이션 등에서 사용할 기본 페이지 크기 */
export const DEFAULT_PAGE_SIZE = 20 as const;
