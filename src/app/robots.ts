import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

/**
 * 크롤러 정책(robots.txt).
 * - 전체 허용하되 API/검색결과 페이지는 색인에서 제외한다.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/search"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
