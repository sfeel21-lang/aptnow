/**
 * PM2 프로세스 설정 (프로덕션 운영).
 * - Next.js 프로덕션 서버(next start)를 클러스터 모드로 구동한다.
 * - 포트는 PORT 환경변수(3000)로 지정한다.
 * - 1GB 인스턴스 기준 1 인스턴스(메모리 절약). RAM 여유 시 instances 를 늘려도 됨.
 *
 * 사용:
 *   pm2 start ecosystem.config.js   # 최초 기동
 *   pm2 reload aptnow               # 무중단 재기동(배포 시)
 *   pm2 logs aptnow                 # 로그 확인
 *   pm2 save && pm2 startup         # 서버 재부팅 시 자동 기동 등록
 */
module.exports = {
  apps: [
    {
      name: "aptnow",
      // Next.js CLI 바이너리를 직접 실행 (next start)
      script: "node_modules/.bin/next",
      args: "start",
      // 프로젝트 루트(이 파일 위치)에서 실행
      cwd: __dirname,

      // 1GB 인스턴스 기준 1 인스턴스 (클러스터 워커당 앱이 메모리에 올라가므로 절약)
      instances: 1,
      exec_mode: "cluster",

      // 메모리 누수 대비 자동 재기동 (400MB 초과 시)
      max_memory_restart: "400M",

      // 로그 (logs/ 디렉토리, .gitignore 대상)
      error_file: "logs/aptnow-error.log",
      out_file: "logs/aptnow-out.log",
      time: true,

      // 환경변수 (민감값은 .env.local 또는 시스템 환경변수로 주입)
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
