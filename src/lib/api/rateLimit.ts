/**
 * data.go.kr 공용 호출 제한기 (429 Too Many Requests 방지).
 * - 동일 인증키로 매매·전월세·건축물대장 등 여러 서비스를 호출하므로,
 *   전역(프로세스 단위) 동시성과 호출 간격을 제한해 순간 폭주를 막는다.
 * - 메인 페이지가 여러 지역×여러 달을 한꺼번에 요청해도 이 게이트를 통과하며 직렬화된다.
 * - PM2 1 인스턴스(단일 프로세스) 기준으로 동작한다.
 */

/** 동시 요청 최대 수 */
const MAX_CONCURRENT = 2;
/** 요청 시작 간 최소 간격(ms) */
const MIN_INTERVAL_MS = 150;

let active = 0;
let lastStartAt = 0;
const waiters: Array<() => void> = [];

/** 호출 슬롯을 확보한다(동시성 + 최소 간격 보장) */
function acquire(): Promise<void> {
  return new Promise((resolve) => {
    const attempt = (): void => {
      if (active < MAX_CONCURRENT) {
        active += 1;
        const now = Date.now();
        const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastStartAt));
        lastStartAt = now + wait;
        if (wait > 0) setTimeout(resolve, wait);
        else resolve();
      } else {
        waiters.push(attempt);
      }
    };
    attempt();
  });
}

/** 호출 슬롯을 반납하고 대기 중인 다음 요청을 깨운다 */
function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

/**
 * data.go.kr 호출을 전역 제한기 안에서 실행한다.
 * @param fn 실제 네트워크 호출(예: axios.get)
 */
export async function withDataGoKrLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
