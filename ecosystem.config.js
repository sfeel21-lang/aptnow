/**
 * PM2 프로세스 설정 (프로덕션 운영).
 * - Next.js 프로덕션 서버(next start)를 클러스터 모드 2 인스턴스로 구동한다.
 * - 포트는 PORT 환경변수(3000)로 지정한다.
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

      // 클러스터 모드 2 인스턴스 (CPU 코어 활용 + 무중단 reload)
      instances: 2,
      exec_mode: "cluster",

      // 메모리 누수 대비 자동 재기동 (512MB 초과 시)
      max_memory_restart: "512M",

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
