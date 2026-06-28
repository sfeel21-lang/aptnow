import type { MetadataRoute } from "next";
import { REGION_CODES } from "@/lib/constants/regionCodes";
import { SITE } from "@/lib/constants";

/**
 * 동적 사이트맵.
 * - 홈 + 전국 시도/시군구 지역 페이지 URL 을 자동 생성한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");

  // 홈
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  // 전국 시도/시군구 지역 페이지
  for (const [sido, sidoData] of Object.entries(REGION_CODES)) {
    for (const gugun of Object.keys(sidoData.districts)) {
      entries.push({
        url: `${base}/${encodeURIComponent(sido)}/${encodeURIComponent(gugun)}`,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  return entries;
}
