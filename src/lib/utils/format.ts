/**
 * 가격/면적 포맷 유틸 (서버·클라이언트 공용, 외부 의존성 없음).
 * - molit API 파서와 화면/공유 텍스트 생성에서 함께 사용한다.
 */

/** ㎡ → 평 환산 계수 */
const PYEONG_DIVISOR = 3.3058;

/**
 * 화면 표시용 단지명 — 이름 뒤의 "동 목록" 괄호를 제거한다.
 * - 예) "현대1차(12,13...33동)" → "현대1차", "잠실파크리오(1동-7동)" → "잠실파크리오"
 * - 괄호 안이 숫자/구분기호와 "동"으로만 이루어진 경우에만 제거한다.
 *   (차수 등 의미 있는 괄호는 유지: "압구정현대(10,13,14차)" → 그대로)
 * - ⚠️ 표시 전용. 라우팅/매칭/평형 인덱스 키에는 원본 aptName 을 그대로 사용해야 한다.
 */
export function displayAptName(name: string): string {
  const stripped = name
    .replace(/\s*\([0-9,.\-~·\s동]*동\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || name;
}

/**
 * 거래금액 문자열을 만원 단위 숫자로 변환한다.
 * 예) "52,500" → 52500, " 525,000 " → 525000
 */
export function parseAmount(amountStr: string): number {
  const digits = amountStr.replace(/[^0-9]/g, "");
  const amount = Number.parseInt(digits, 10);
  return Number.isNaN(amount) ? 0 : amount;
}

/**
 * 만원 단위 금액을 한국식 표기 문자열로 변환한다.
 * 예) 525000 → "52억 5,000만", 30000 → "3억", 8500 → "8,500만"
 */
export function formatAmountKorean(amount: number): string {
  if (amount <= 0) return "0";
  const eok = Math.floor(amount / 10_000);
  const man = amount % 10_000;
  if (eok > 0 && man > 0) {
    return `${eok}억 ${man.toLocaleString("ko-KR")}만`;
  }
  if (eok > 0) {
    return `${eok}억`;
  }
  return `${man.toLocaleString("ko-KR")}만`;
}

/**
 * 전용면적(㎡) → 통용 평형(공급 기준) 변환용 앵커표.
 * - [전용면적㎡, 평형] 쌍을 전용면적 오름차순으로 둔다.
 * - 한국 아파트는 전용률(공급/전용)이 단지·평형마다 달라(보통 70~80%) 직선 하나로는
 *   주요 평형을 동시에 맞출 수 없다. (예: 전용 59→25, 84→34 를 한 직선으로 못 맞춤)
 * - 그래서 부동산 사이트들이 실제로 쓰는 표준 평형 대응값을 앵커로 잡고 "구간 보간"한다.
 *   (전용 59→25, 84→34, 33→14, 39.5→16, 49.96→21 등 실측에 맞춰 보정)
 */
const PYEONG_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [16.5, 7],
  [23, 10],
  [26, 11],
  [29, 12],
  [33, 14],
  [36, 15],
  [39, 16],
  [42, 17],
  [46, 18],
  [49, 20],
  [52, 22],
  [55, 23],
  [59, 25],
  [69, 28],
  [72, 29],
  [74, 30],
  [76, 31],
  [79, 32],
  [82, 33],
  [84, 34],
  [89, 36],
  [99, 40],
  [109, 43],
  [114, 45],
  [134, 53],
  [164, 64],
];

/**
 * 전용면적(㎡)을 "통용 평형(공급면적 기준)"으로 환산한다.
 * - 국토부 API 는 전용면적만 제공하지만, 네이버·부동산114 등은 공급면적 기준 평형으로 표기한다.
 * - PYEONG_ANCHORS(실측 기반 표준 대응값)를 구간 선형보간하여 근사한다.
 *   표 범위를 벗어난 값은 양 끝 구간의 기울기로 외삽한다.
 *   (예: 전용 33.18㎡ → 14평, 39.5㎡ → 16평, 49.96㎡ → 21평, 59㎡ → 25평, 84㎡ → 34평)
 */
export function calculatePyeong(area: number): number {
  if (!Number.isFinite(area) || area <= 0) return 0;

  const anchors = PYEONG_ANCHORS;
  const last = anchors.length - 1;

  // 보간/외삽: 두 앵커 (a0,p0)-(a1,p1) 사이를 선형 대응
  const lerp = (
    a0: number,
    p0: number,
    a1: number,
    p1: number,
  ): number => p0 + ((area - a0) * (p1 - p0)) / (a1 - a0);

  // 최소 앵커 이하 → 첫 구간 기울기로 외삽
  if (area <= anchors[0]![0]) {
    const [a0, p0] = anchors[0]!;
    const [a1, p1] = anchors[1]!;
    return Math.max(1, Math.round(lerp(a0, p0, a1, p1)));
  }
  // 최대 앵커 이상 → 마지막 구간 기울기로 외삽
  if (area >= anchors[last]![0]) {
    const [a0, p0] = anchors[last - 1]!;
    const [a1, p1] = anchors[last]!;
    return Math.round(lerp(a0, p0, a1, p1));
  }
  // 해당 구간 보간
  for (let i = 0; i < last; i += 1) {
    const [a0, p0] = anchors[i]!;
    const [a1, p1] = anchors[i + 1]!;
    if (area >= a0 && area <= a1) {
      return Math.round(lerp(a0, p0, a1, p1));
    }
  }
  // 안전망 (도달하지 않음)
  return Math.round(area * 0.392 + 1.06);
}

/**
 * 전용면적(㎡)을 평으로 환산한다(전용 평, 소수점 버림).
 * - 공급 기준이 아닌 "순수 전용 평"이 필요할 때 사용.
 */
export function calculateExclusivePyeong(area: number): number {
  if (!Number.isFinite(area) || area <= 0) return 0;
  return Math.floor(area / PYEONG_DIVISOR);
}
