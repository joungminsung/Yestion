// prisma/templates-batch3.ts
// ENGINEERING (10) + DESIGN (10) template data

type SeedTemplate = {
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string;
  category: string;
  tags: string[];
  blocks: object[];
};

const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});

const h3 = (text: string) => ({
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text }],
});

const p = (text = "") =>
  text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };

const bullet = (...items: string[]) => ({
  type: "bulletList",
  content: items.map((t) => ({
    type: "listItem",
    content: [
      t
        ? { type: "paragraph", content: [{ type: "text", text: t }] }
        : { type: "paragraph" },
    ],
  })),
});

const tasks = (...items: string[]) => ({
  type: "taskList",
  content: items.map((t) => ({
    type: "taskItem",
    attrs: { checked: false },
    content: [
      t
        ? { type: "paragraph", content: [{ type: "text", text: t }] }
        : { type: "paragraph" },
    ],
  })),
});

const numbered = (...items: string[]) => ({
  type: "orderedList",
  content: items.map((t) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  })),
});

const quote = (text: string) => ({
  type: "blockquote",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const hr = () => ({ type: "horizontalRule" });

const callout = (text: string, icon = "💡") => ({
  type: "callout",
  attrs: { icon, color: "default" },
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

export const BATCH3_TEMPLATES: SeedTemplate[] = [
  // ──────────────── ENGINEERING (10) ────────────────

  // 1. API 문서
  {
    name: "API Documentation",
    nameKo: "API 문서",
    description: "REST API endpoint documentation with examples",
    descriptionKo: "REST API 엔드포인트 문서 및 요청/응답 예시",
    icon: "🔌",
    category: "engineering",
    tags: ["api", "rest", "documentation", "endpoint", "엔드포인트"],
    blocks: [
      h2("API 문서 / API Documentation"),
      callout("각 엔드포인트의 요청/응답 형식, 인증 방식, 에러 코드를 상세히 기록합니다.", "📘"),
      h2("기본 정보 / Base Info"),
      bullet(
        "Base URL: https://api.example.com/v1",
        "인증 방식: Bearer Token (Authorization 헤더)",
        "Content-Type: application/json",
        "Rate Limit: 1000 requests/min"
      ),
      hr(),
      h2("인증 / Authentication"),
      p("모든 요청에 Authorization 헤더를 포함해야 합니다."),
      p("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."),
      hr(),
      h2("엔드포인트 목록 / Endpoints"),
      h3("GET /users - 사용자 목록 조회"),
      p("페이지네이션을 지원하는 사용자 목록을 반환합니다."),
      bullet(
        "Query Params: page (default: 1), limit (default: 20), sort (created_at | name)",
        "성공 응답 (200): { data: User[], meta: { total: 150, page: 1, limit: 20 } }",
        "에러 응답 (401): { error: 'Unauthorized', message: '유효하지 않은 토큰' }"
      ),
      h3("POST /users - 사용자 생성"),
      p("새로운 사용자를 생성합니다. email은 고유해야 합니다."),
      bullet(
        "Request Body: { name: string, email: string, role: 'admin' | 'member' }",
        "성공 응답 (201): { data: User, message: '사용자가 생성되었습니다' }",
        "에러 응답 (409): { error: 'Conflict', message: '이미 등록된 이메일입니다' }",
        "에러 응답 (422): { error: 'Validation', fields: { email: '올바른 이메일 형식이 아닙니다' } }"
      ),
      h3("PUT /users/:id - 사용자 수정"),
      p("특정 사용자의 정보를 수정합니다. 부분 업데이트(patch)를 지원합니다."),
      bullet(
        "Path Params: id (UUID)",
        "Request Body: { name?: string, email?: string, role?: string }",
        "성공 응답 (200): { data: User }",
        "에러 응답 (404): { error: 'Not Found', message: '사용자를 찾을 수 없습니다' }"
      ),
      h3("DELETE /users/:id - 사용자 삭제"),
      bullet(
        "Path Params: id (UUID)",
        "성공 응답 (204): No Content",
        "에러 응답 (403): { error: 'Forbidden', message: '삭제 권한이 없습니다' }"
      ),
      hr(),
      h2("공통 에러 코드 / Error Codes"),
      bullet(
        "400 Bad Request - 잘못된 요청 형식",
        "401 Unauthorized - 인증 토큰 누락 또는 만료",
        "403 Forbidden - 권한 부족",
        "404 Not Found - 리소스를 찾을 수 없음",
        "429 Too Many Requests - Rate Limit 초과",
        "500 Internal Server Error - 서버 내부 오류"
      ),
      h2("데이터 모델 / Data Models"),
      p("User: { id: UUID, name: string, email: string, role: string, createdAt: ISO8601, updatedAt: ISO8601 }"),
      h2("변경 이력 / Changelog"),
      bullet(
        "v1.3.0 (2024-03-15) - rate limit 헤더 추가",
        "v1.2.0 (2024-02-01) - 사용자 역할(role) 필드 추가",
        "v1.1.0 (2024-01-10) - 페이지네이션 meta 정보 추가"
      ),
    ],
  },

  // 2. 시스템 아키텍처
  {
    name: "System Architecture",
    nameKo: "시스템 아키텍처",
    description: "System architecture documentation with components and data flow",
    descriptionKo: "시스템 구성 요소, 데이터 흐름, 인프라 아키텍처 문서",
    icon: "🏗️",
    category: "engineering",
    tags: ["architecture", "system", "infrastructure", "아키텍처", "인프라"],
    blocks: [
      h2("시스템 아키텍처 / System Architecture"),
      callout("시스템의 전체 구조와 각 구성 요소 간의 관계를 문서화합니다. 다이어그램 링크를 함께 첨부하세요.", "🏗️"),
      h2("시스템 개요 / Overview"),
      p("마이크로서비스 기반 e-commerce 플랫폼으로, 사용자 인증, 상품 관리, 주문 처리, 결제를 독립적인 서비스로 운영합니다."),
      bullet(
        "아키텍처 패턴: 마이크로서비스 + 이벤트 드리븐",
        "배포 환경: AWS EKS (Kubernetes)",
        "다이어그램: [Miro 링크 또는 이미지 첨부]"
      ),
      hr(),
      h2("핵심 서비스 / Core Services"),
      h3("API Gateway"),
      bullet(
        "기술 스택: Kong Gateway",
        "역할: 라우팅, 인증, Rate Limiting, 로깅",
        "포트: 443 (HTTPS), 내부 8000"
      ),
      h3("Auth Service (인증 서비스)"),
      bullet(
        "기술 스택: Node.js + Express + Redis",
        "역할: JWT 발급/검증, OAuth2.0, 세션 관리",
        "DB: PostgreSQL (users), Redis (sessions)"
      ),
      h3("Product Service (상품 서비스)"),
      bullet(
        "기술 스택: Java Spring Boot",
        "역할: 상품 CRUD, 카테고리 관리, 검색",
        "DB: PostgreSQL, Elasticsearch (검색)"
      ),
      h3("Order Service (주문 서비스)"),
      bullet(
        "기술 스택: Go + gRPC",
        "역할: 주문 생성/조회, 상태 관리, 재고 확인",
        "DB: PostgreSQL, 메시지 큐: Kafka"
      ),
      hr(),
      h2("데이터 흐름 / Data Flow"),
      numbered(
        "클라이언트 요청 → API Gateway (인증 확인)",
        "API Gateway → 해당 마이크로서비스로 라우팅",
        "서비스 간 동기 통신: gRPC, 비동기 통신: Kafka 이벤트",
        "주문 생성 시: Order Service → Kafka → Payment Service → Notification Service"
      ),
      h2("인프라 구성 / Infrastructure"),
      bullet(
        "컨테이너 오케스트레이션: AWS EKS (K8s 1.28)",
        "CI/CD: GitHub Actions → ArgoCD",
        "모니터링: Prometheus + Grafana",
        "로깅: ELK Stack (Elasticsearch + Logstash + Kibana)",
        "CDN: CloudFront",
        "DNS: Route 53"
      ),
      h2("보안 / Security"),
      bullet(
        "TLS 1.3 종단 간 암호화",
        "서비스 간 통신: mTLS (Istio Service Mesh)",
        "비밀 관리: AWS Secrets Manager",
        "WAF: AWS WAF + OWASP 규칙 세트"
      ),
      h2("확장성 / Scalability"),
      bullet(
        "수평 확장: HPA (Horizontal Pod Autoscaler) 적용",
        "DB 읽기 부하 분산: Read Replica 2대",
        "캐싱: Redis Cluster (상품 정보, 세션)",
        "예상 처리량: 10,000 RPS"
      ),
      h2("장애 대응 / Resilience"),
      bullet(
        "Circuit Breaker: Resilience4j 적용",
        "재시도 정책: 최대 3회, exponential backoff",
        "헬스체크: /health 엔드포인트, 30초 간격",
        "DR 전략: Multi-AZ 배포, RDS 자동 페일오버"
      ),
    ],
  },

  // 3. 코드 리뷰 체크리스트
  {
    name: "Code Review Checklist",
    nameKo: "코드 리뷰 체크리스트",
    description: "Systematic code review checklist for PR reviews",
    descriptionKo: "PR 코드 리뷰를 위한 체계적인 체크리스트",
    icon: "✅",
    category: "engineering",
    tags: ["code-review", "pr", "checklist", "코드리뷰", "풀리퀘스트"],
    blocks: [
      h2("코드 리뷰 체크리스트 / Code Review Checklist"),
      callout("PR 리뷰 시 아래 항목을 순서대로 확인합니다. 각 섹션별로 해당 사항이 없으면 N/A로 표기하세요.", "✅"),
      p("PR 제목: [PR 제목 입력]"),
      p("작성자: @username | 리뷰어: @reviewer | 날짜: 2024-03-15"),
      hr(),
      h2("1. 기능 요구사항 / Functional Requirements"),
      tasks(
        "요구사항에 맞게 기능이 구현되었는가",
        "엣지 케이스가 적절히 처리되었는가 (null, 빈 배열, 경계값 등)",
        "기존 기능에 대한 regression이 없는가",
        "사용자 입력에 대한 유효성 검증이 있는가"
      ),
      h2("2. 코드 품질 / Code Quality"),
      tasks(
        "변수/함수 네이밍이 명확하고 일관성 있는가",
        "함수가 단일 책임 원칙(SRP)을 따르는가",
        "중복 코드가 없는가 (DRY 원칙)",
        "매직 넘버 대신 상수/enum을 사용하는가",
        "불필요한 주석이나 console.log가 제거되었는가"
      ),
      h2("3. 에러 처리 / Error Handling"),
      tasks(
        "try-catch 블록이 적절히 사용되었는가",
        "에러 메시지가 사용자에게 의미 있는 정보를 제공하는가",
        "외부 API 호출에 타임아웃과 재시도 로직이 있는가",
        "예외 상황에서 리소스가 정리되는가 (DB 커넥션, 파일 핸들 등)"
      ),
      h2("4. 보안 / Security"),
      tasks(
        "SQL Injection, XSS 등 보안 취약점이 없는가",
        "인증/인가 로직이 올바르게 적용되었는가",
        "민감 정보(API 키, 비밀번호)가 하드코딩되지 않았는가",
        "사용자 입력이 적절히 sanitize 되었는가"
      ),
      h2("5. 성능 / Performance"),
      tasks(
        "불필요한 데이터베이스 쿼리가 없는가 (N+1 문제)",
        "적절한 인덱스를 사용하는가",
        "대량 데이터 처리 시 페이지네이션이 적용되었는가",
        "메모리 누수 가능성이 없는가"
      ),
      h2("6. 테스트 / Testing"),
      tasks(
        "단위 테스트가 추가/수정되었는가",
        "주요 로직의 테스트 커버리지가 80% 이상인가",
        "테스트가 독립적으로 실행 가능한가 (외부 의존성 Mock)",
        "경계값과 에러 케이스에 대한 테스트가 있는가"
      ),
      h2("7. 문서화 / Documentation"),
      tasks(
        "공개 API에 JSDoc/TSDoc 주석이 있는가",
        "README 또는 관련 문서가 업데이트되었는가",
        "복잡한 비즈니스 로직에 설명 주석이 있는가"
      ),
      hr(),
      h2("리뷰 코멘트 / Review Comments"),
      p("[리뷰 의견을 여기에 작성합니다]"),
      h2("최종 판정 / Decision"),
      bullet("Approve ✅ / Request Changes 🔄 / Comment 💬"),
    ],
  },

  // 4. 인시던트 보고서
  {
    name: "Incident Report",
    nameKo: "인시던트 보고서",
    description: "Post-incident report with timeline, root cause, and action items",
    descriptionKo: "장애 사후 보고서 - 타임라인, 근본 원인 분석, 재발 방지 대책",
    icon: "🚨",
    category: "engineering",
    tags: ["incident", "postmortem", "outage", "인시던트", "장애"],
    blocks: [
      h2("인시던트 보고서 / Incident Report"),
      callout("장애 발생 후 48시간 이내에 작성합니다. 비난 없는(blameless) 문화를 기반으로 사실에 집중합니다.", "🚨"),
      h2("인시던트 요약 / Summary"),
      bullet(
        "인시던트 ID: INC-2024-0042",
        "심각도: P1 (Critical)",
        "영향 범위: 전체 사용자의 결제 기능 불가",
        "발생 시각: 2024-03-15 14:32 KST",
        "감지 시각: 2024-03-15 14:35 KST (모니터링 알림)",
        "해결 시각: 2024-03-15 15:48 KST",
        "총 장애 시간: 1시간 16분",
        "담당자: @backend-team"
      ),
      hr(),
      h2("영향도 / Impact"),
      bullet(
        "영향받은 사용자 수: 약 12,000명",
        "실패한 트랜잭션: 3,847건",
        "매출 손실 추정: ₩45,000,000",
        "SLA 위반 여부: 99.9% SLA 위반 (월간 downtime 초과)"
      ),
      h2("타임라인 / Timeline"),
      numbered(
        "14:32 - Payment Service의 DB 커넥션 풀 고갈 시작",
        "14:35 - Grafana 알림 발생 (DB connection pool exhausted)",
        "14:38 - 온콜 엔지니어 확인 및 대응 시작",
        "14:45 - Payment Service 로그 분석, 슬로우 쿼리 식별",
        "14:55 - 원인 파악: 배포된 쿼리에 인덱스 누락",
        "15:10 - 핫픽스 브랜치 생성 및 인덱스 추가",
        "15:30 - 스테이징 환경에서 검증 완료",
        "15:42 - 프로덕션 배포 완료",
        "15:48 - 정상 복구 확인, 인시던트 종료 선언"
      ),
      h2("근본 원인 / Root Cause"),
      p("3월 15일 오전에 배포된 주문 조회 API에서 orders 테이블에 대한 full table scan이 발생했습니다. 해당 쿼리에 필요한 (user_id, created_at) 복합 인덱스가 누락되어 있었고, 트래픽 증가 시점에 DB 커넥션 풀이 고갈되었습니다."),
      h2("기여 요인 / Contributing Factors"),
      bullet(
        "코드 리뷰에서 쿼리 성능 검토가 누락됨",
        "스테이징 환경의 데이터 규모가 프로덕션 대비 1/100 수준으로, 성능 문제가 재현되지 않음",
        "DB 커넥션 풀 모니터링 임계값이 너무 높게 설정됨 (90% → 70%로 조정 필요)"
      ),
      h2("재발 방지 대책 / Action Items"),
      tasks(
        "[P0] 주문 관련 테이블에 누락된 인덱스 전수 조사 (@backend-lead, 3/20까지)",
        "[P1] PR 리뷰 체크리스트에 '쿼리 실행 계획(EXPLAIN) 확인' 항목 추가 (@tech-lead, 3/22까지)",
        "[P1] 스테이징 환경에 프로덕션 규모의 더미 데이터 생성 스크립트 작성 (@devops, 3/29까지)",
        "[P2] DB 커넥션 풀 모니터링 임계값 70%로 하향 조정 (@devops, 3/18까지)",
        "[P2] 슬로우 쿼리 자동 감지 알림 추가 (> 500ms) (@backend-team, 4/5까지)"
      ),
      h2("교훈 / Lessons Learned"),
      bullet(
        "잘된 점: 모니터링 알림이 3분 이내에 발생하여 빠른 감지가 가능했음",
        "개선할 점: 쿼리 성능 테스트를 배포 파이프라인에 포함해야 함",
        "개선할 점: 스테이징 환경의 데이터 규모를 프로덕션과 유사하게 유지해야 함"
      ),
    ],
  },

  // 5. 기술 부채 트래커
  {
    name: "Tech Debt Tracker",
    nameKo: "기술 부채 트래커",
    description: "Track and prioritize technical debt items",
    descriptionKo: "기술 부채 항목을 추적하고 우선순위를 관리",
    icon: "💳",
    category: "engineering",
    tags: ["tech-debt", "refactoring", "기술부채", "리팩토링"],
    blocks: [
      h2("기술 부채 트래커 / Tech Debt Tracker"),
      callout("기술 부채를 가시화하고 우선순위를 정해 점진적으로 해소합니다. 분기마다 리뷰하세요.", "💳"),
      p("마지막 업데이트: 2024-03-15 | 담당: @tech-lead"),
      hr(),
      h2("우선순위 기준 / Priority Criteria"),
      bullet(
        "P0 (Critical): 장애 발생 위험 또는 보안 취약점 — 즉시 해결",
        "P1 (High): 개발 생산성에 직접 영향 — 이번 분기 내 해결",
        "P2 (Medium): 유지보수 비용 증가 — 다음 분기 계획",
        "P3 (Low): 개선하면 좋은 항목 — 여유 시 해결"
      ),
      hr(),
      h2("P0 - Critical"),
      h3("Node.js 16 → 20 업그레이드"),
      bullet(
        "현황: Node 16은 2023-09에 EOL, 보안 패치 미제공",
        "영향: 보안 취약점 노출 위험",
        "예상 공수: 3 sprint points",
        "담당: @backend-team | 기한: 2024-03-31"
      ),
      h3("결제 모듈 하드코딩된 시크릿 키 제거"),
      bullet(
        "현황: payment.service.ts에 테스트 키가 하드코딩됨",
        "영향: 실수로 프로덕션에 테스트 키 노출 가능",
        "예상 공수: 1 sprint point",
        "담당: @security-team | 기한: 2024-03-20"
      ),
      h2("P1 - High"),
      h3("모놀리식 UserService 분리"),
      bullet(
        "현황: UserService가 2,800줄, 인증/프로필/알림 로직 혼재",
        "영향: 변경 시 사이드이펙트 빈번, 테스트 실행 시간 5분+",
        "예상 공수: 8 sprint points",
        "담당: @backend-team | 기한: 2024-Q2"
      ),
      h3("레거시 REST API → GraphQL 마이그레이션"),
      bullet(
        "현황: v1 API 32개 엔드포인트가 REST로 유지 중",
        "영향: 프론트엔드 over-fetching, 모바일 성능 저하",
        "예상 공수: 13 sprint points",
        "담당: @fullstack-team | 기한: 2024-Q2"
      ),
      h2("P2 - Medium"),
      h3("테스트 커버리지 45% → 80% 향상"),
      bullet(
        "현황: 핵심 비즈니스 로직의 테스트 커버리지 부족",
        "영향: 리팩토링 시 안전망 부재, 배포 자신감 저하",
        "예상 공수: 지속적 (스프린트당 2 points 할당)",
        "담당: @all-engineers"
      ),
      h2("P3 - Low"),
      h3("CSS-in-JS → Tailwind CSS 마이그레이션"),
      bullet(
        "현황: styled-components와 Tailwind가 혼재",
        "영향: 번들 사이즈 증가, 스타일링 컨벤션 불일치",
        "예상 공수: 21 sprint points",
        "담당: @frontend-team | 기한: 미정"
      ),
      hr(),
      h2("해결 완료 / Resolved"),
      bullet(
        "[2024-Q1] TypeScript strict mode 전환 완료 — 타입 안정성 향상",
        "[2024-Q1] CI 파이프라인 병렬화 — 빌드 시간 12분 → 4분 단축",
        "[2023-Q4] PostgreSQL 14 → 16 업그레이드 완료"
      ),
    ],
  },

  // 6. 온콜 런북
  {
    name: "On-Call Runbook",
    nameKo: "온콜 런북",
    description: "On-call engineer runbook for common alerts and responses",
    descriptionKo: "온콜 엔지니어를 위한 알림별 대응 매뉴얼",
    icon: "📟",
    category: "engineering",
    tags: ["oncall", "runbook", "alert", "온콜", "장애대응"],
    blocks: [
      h2("온콜 런북 / On-Call Runbook"),
      callout("온콜 당번이 알림 수신 시 참고하는 대응 매뉴얼입니다. 침착하게 순서대로 따라가세요.", "📟"),
      h2("온콜 기본 정보 / On-Call Info"),
      bullet(
        "온콜 스케줄: PagerDuty → #oncall-schedule 채널 확인",
        "에스컬레이션: 15분 내 미응답 시 자동 에스컬레이션",
        "커뮤니케이션 채널: Slack #incident-response",
        "상태 페이지: https://status.example.com"
      ),
      hr(),
      h2("알림 수신 시 첫 대응 / First Response"),
      numbered(
        "Slack #incident-response 채널에 '확인 중' 메시지 발송",
        "PagerDuty에서 알림 Acknowledge",
        "아래 시나리오별 런북 확인 후 대응 시작",
        "15분 단위로 상황 업데이트 공유"
      ),
      hr(),
      h2("시나리오 1: 높은 에러율 (Error Rate > 5%)"),
      h3("증상"),
      bullet("Grafana 알림: 'High Error Rate on API Gateway'", "사용자 신고: 500 에러 발생"),
      h3("진단 단계"),
      numbered(
        "Grafana 대시보드 확인: https://grafana.internal/d/api-overview",
        "에러 집중 서비스 식별: kubectl logs -l app=<service> --tail=100",
        "최근 배포 확인: argocd app list | grep -v Synced",
        "의존 서비스 상태 확인: DB, Redis, 외부 API"
      ),
      h3("해결 방법"),
      bullet(
        "최근 배포가 원인인 경우: argocd app rollback <app-name>",
        "DB 문제인 경우: DBA 팀 에스컬레이션 (@dba-oncall)",
        "외부 API 문제인 경우: Circuit Breaker 수동 활성화"
      ),
      h2("시나리오 2: 높은 레이턴시 (P99 > 3s)"),
      h3("증상"),
      bullet("Grafana 알림: 'High Latency Alert'", "사용자 신고: 페이지 로딩 느림"),
      h3("진단 단계"),
      numbered(
        "Grafana에서 레이턴시 급증 시점 확인",
        "슬로우 쿼리 로그 확인: SELECT * FROM pg_stat_activity WHERE state = 'active'",
        "Redis 히트율 확인: redis-cli info stats | grep hit",
        "Pod 리소스 사용량: kubectl top pods -n production"
      ),
      h3("해결 방법"),
      bullet(
        "DB 슬로우 쿼리: 문제 쿼리 KILL 후 인덱스 확인",
        "캐시 미스: Redis 상태 확인, 필요 시 캐시 워밍",
        "리소스 부족: kubectl scale deployment <name> --replicas=<N>"
      ),
      h2("시나리오 3: 서비스 다운 (Health Check Fail)"),
      h3("진단 단계"),
      numbered(
        "kubectl get pods -n production | grep -v Running",
        "kubectl describe pod <pod-name> 으로 이벤트 확인",
        "kubectl logs <pod-name> --previous 로 크래시 로그 확인"
      ),
      h3("해결 방법"),
      bullet(
        "OOMKilled: 메모리 limit 증가 후 재배포",
        "CrashLoopBackOff: 로그 확인 후 롤백 또는 핫픽스",
        "Pending 상태: 노드 리소스 확인, 필요 시 노드 추가"
      ),
      hr(),
      h2("에스컬레이션 매트릭스 / Escalation Matrix"),
      bullet(
        "P1 (서비스 전체 장애): 즉시 → Engineering Manager + CTO",
        "P2 (주요 기능 장애): 15분 내 → Tech Lead",
        "P3 (성능 저하): 30분 내 → 해당 팀 리드",
        "P4 (마이너 이슈): 다음 영업일 티켓 생성"
      ),
    ],
  },

  // 7. 배포 체크리스트
  {
    name: "Deployment Checklist",
    nameKo: "배포 체크리스트",
    description: "Pre/post deployment checklist for safe releases",
    descriptionKo: "안전한 릴리스를 위한 배포 전/후 체크리스트",
    icon: "🚀",
    category: "engineering",
    tags: ["deployment", "release", "checklist", "배포", "릴리스"],
    blocks: [
      h2("배포 체크리스트 / Deployment Checklist"),
      callout("배포 전/중/후 단계별로 확인해야 할 항목입니다. 모든 체크박스를 확인한 후 배포를 진행하세요.", "🚀"),
      p("배포 버전: v2.4.1 | 날짜: 2024-03-15 | 담당: @deployer"),
      p("배포 시간: 14:00 KST (트래픽 저점) | 예상 소요: 20분"),
      hr(),
      h2("1. 배포 전 / Pre-Deployment"),
      h3("코드 준비"),
      tasks(
        "모든 PR이 main 브랜치에 머지됨",
        "CI 파이프라인 전체 통과 (lint, test, build)",
        "릴리스 태그 생성 완료 (git tag v2.4.1)",
        "CHANGELOG.md 업데이트 완료"
      ),
      h3("환경 확인"),
      tasks(
        "스테이징 환경에서 전체 기능 테스트 완료",
        "DB 마이그레이션 스크립트 검증 (forward + rollback)",
        "환경 변수 변경 사항 확인 및 적용",
        "의존 서비스 상태 정상 확인 (DB, Redis, 외부 API)"
      ),
      h3("커뮤니케이션"),
      tasks(
        "팀 Slack 채널에 배포 예정 공지",
        "CS팀에 변경 사항 사전 안내",
        "필요 시 사용자 공지 (점검 안내) 게시"
      ),
      hr(),
      h2("2. 배포 중 / During Deployment"),
      tasks(
        "DB 마이그레이션 실행 (있는 경우)",
        "Canary 배포 시작 (10% 트래픽)",
        "Canary 단계 에러율/레이턴시 모니터링 (5분)",
        "이상 없으면 50% → 100% 트래픽 전환",
        "모든 Pod이 Running 상태인지 확인"
      ),
      hr(),
      h2("3. 배포 후 / Post-Deployment"),
      h3("검증"),
      tasks(
        "핵심 API 헬스체크 정상 확인",
        "주요 사용자 시나리오 수동 테스트 (로그인, 결제 등)",
        "에러율이 배포 전 수준인지 확인 (Grafana)",
        "응답 시간(P95)이 정상 범위인지 확인"
      ),
      h3("마무리"),
      tasks(
        "Slack에 배포 완료 공지",
        "릴리스 노트 발행",
        "모니터링 강화 기간 설정 (배포 후 2시간)",
        "배포 기록 문서 업데이트"
      ),
      hr(),
      h2("롤백 절차 / Rollback Plan"),
      numbered(
        "에러율 5% 초과 또는 주요 기능 장애 시 롤백 결정",
        "argocd app rollback <app-name> 실행",
        "DB 마이그레이션 롤백: npx prisma migrate rollback",
        "롤백 후 헬스체크 및 기능 검증",
        "인시던트 보고서 작성"
      ),
    ],
  },

  // 8. RFC 템플릿
  {
    name: "RFC Template",
    nameKo: "RFC 템플릿",
    description: "Request for Comments - technical proposal template",
    descriptionKo: "기술 제안서(RFC) 작성 템플릿",
    icon: "📜",
    category: "engineering",
    tags: ["rfc", "proposal", "제안서", "기술제안"],
    blocks: [
      h2("RFC: [제안 제목]"),
      callout("RFC는 주요 기술적 변경을 제안하고 팀의 합의를 이끌어내기 위한 문서입니다. 충분한 맥락과 대안을 제시해주세요.", "📜"),
      h2("메타 정보 / Metadata"),
      bullet(
        "RFC 번호: RFC-2024-007",
        "상태: Draft → Review → Accepted / Rejected",
        "작성자: @author-name",
        "리뷰어: @reviewer1, @reviewer2, @reviewer3",
        "최종 결정일: 2024-04-01",
        "구현 예정: 2024-Q2"
      ),
      hr(),
      h2("요약 / Summary"),
      p("현재 REST API를 GraphQL로 점진적 마이그레이션하여 프론트엔드 개발 생산성을 향상하고, 모바일 클라이언트의 네트워크 사용량을 50% 절감하는 것을 제안합니다."),
      h2("동기 / Motivation"),
      p("현재 시스템이 직면한 문제점과 이 RFC가 필요한 이유를 설명합니다."),
      bullet(
        "프론트엔드에서 하나의 화면을 구성하기 위해 평균 4.2개의 REST 호출 필요",
        "모바일 앱에서 불필요한 데이터 전송량이 월 평균 2.3GB (사용자당)",
        "새 필드 추가 시 API 버전 관리 부담 증가 (현재 v1, v2, v3 병행 운영)"
      ),
      h2("상세 설계 / Detailed Design"),
      p("제안하는 기술적 해결 방안을 구체적으로 설명합니다."),
      h3("아키텍처 변경"),
      numbered(
        "API Gateway 뒤에 GraphQL BFF(Backend For Frontend) 레이어 추가",
        "기존 REST 마이크로서비스를 GraphQL resolver에서 호출",
        "DataLoader 패턴으로 N+1 문제 방지",
        "Apollo Federation으로 서비스별 스키마 분리"
      ),
      h3("마이그레이션 전략"),
      numbered(
        "Phase 1: 읽기 전용 쿼리부터 GraphQL 전환 (4주)",
        "Phase 2: Mutation(쓰기) 전환 (6주)",
        "Phase 3: REST API deprecation 공지 및 전환 기간 (8주)",
        "Phase 4: 레거시 REST 엔드포인트 제거 (4주)"
      ),
      h2("대안 / Alternatives Considered"),
      h3("대안 1: REST API 유지 + BFF 패턴"),
      bullet("장점: 기존 코드 변경 최소화", "단점: over-fetching 문제 미해결, BFF 유지보수 부담"),
      h3("대안 2: tRPC 도입"),
      bullet("장점: TypeScript 네이티브, 스키마 자동 생성", "단점: 모바일(Swift/Kotlin) 클라이언트 미지원"),
      h2("리스크 / Risks"),
      bullet(
        "학습 곡선: 팀원 60%가 GraphQL 미경험 → 2주 교육 필요",
        "성능: 복잡한 쿼리의 실행 계획 최적화 필요 → 쿼리 복잡도 제한(depth limit) 적용",
        "모니터링: REST 대비 에러 추적이 어려움 → Apollo Studio 도입"
      ),
      h2("성공 지표 / Success Metrics"),
      bullet(
        "API 호출 수: 화면당 평균 4.2회 → 1회",
        "모바일 데이터 사용량: 50% 절감",
        "프론트엔드 개발 속도: 새 화면 구현 시간 30% 단축",
        "API 관련 버그 티켓: 월 15건 → 5건 이하"
      ),
      h2("미해결 질문 / Open Questions"),
      tasks(
        "파일 업로드는 GraphQL multipart로 처리할지 REST 유지할지?",
        "실시간 데이터는 GraphQL Subscription vs WebSocket?",
        "캐싱 전략: Apollo Client 캐시 vs CDN 캐시?"
      ),
      h2("피드백 / Feedback"),
      p("[리뷰어들의 피드백을 여기에 기록합니다]"),
    ],
  },

  // 9. 테스트 계획
  {
    name: "Test Plan",
    nameKo: "테스트 계획",
    description: "Comprehensive test plan with scope, cases, and criteria",
    descriptionKo: "테스트 범위, 케이스, 완료 기준을 포함한 테스트 계획서",
    icon: "🧪",
    category: "engineering",
    tags: ["test", "qa", "testing", "테스트", "품질"],
    blocks: [
      h2("테스트 계획서 / Test Plan"),
      callout("기능 릴리스 전 QA 테스트의 범위, 전략, 완료 기준을 정의합니다.", "🧪"),
      h2("테스트 개요 / Overview"),
      bullet(
        "대상 기능: 소셜 로그인 (Google, Kakao, Apple) 추가",
        "릴리스 버전: v2.5.0",
        "테스트 기간: 2024-03-18 ~ 2024-03-22 (5일)",
        "QA 담당: @qa-engineer",
        "개발 담당: @auth-team"
      ),
      hr(),
      h2("테스트 범위 / Scope"),
      h3("In Scope"),
      bullet(
        "Google OAuth 2.0 로그인/회원가입 플로우",
        "Kakao 로그인/회원가입 플로우",
        "Apple Sign In 플로우 (iOS, Web)",
        "기존 이메일 계정과 소셜 계정 연동",
        "소셜 로그인 후 프로필 정보 동기화"
      ),
      h3("Out of Scope"),
      bullet(
        "기존 이메일/비밀번호 로그인 (변경 없음)",
        "관리자 페이지 로그인",
        "2FA 관련 기능"
      ),
      hr(),
      h2("테스트 전략 / Strategy"),
      bullet(
        "단위 테스트: OAuth 토큰 검증 로직, 사용자 매핑 로직 (개발팀 작성)",
        "통합 테스트: OAuth Provider Mock 서버 기반 E2E 플로우",
        "수동 테스트: 실제 소셜 계정으로 크로스 브라우저/디바이스 테스트",
        "보안 테스트: CSRF, 토큰 탈취, redirect URI 변조 시나리오"
      ),
      h2("테스트 케이스 / Test Cases"),
      h3("TC-001: Google 로그인 성공"),
      bullet(
        "사전 조건: Google 계정 보유, 앱 미가입 상태",
        "단계: 로그인 페이지 → 'Google로 로그인' 클릭 → Google 인증 → 동의 → 리다이렉트",
        "기대 결과: 신규 사용자 생성, 프로필에 Google 이름/이메일 반영, 대시보드로 이동"
      ),
      h3("TC-002: 기존 계정 연동 충돌"),
      bullet(
        "사전 조건: 동일 이메일로 이메일 가입 상태",
        "단계: 'Kakao로 로그인' 클릭 → 동일 이메일 Kakao 계정 인증",
        "기대 결과: '이미 등록된 이메일' 안내 + 계정 연동 옵션 제공"
      ),
      h3("TC-003: 토큰 만료 시 자동 갱신"),
      bullet(
        "사전 조건: 소셜 로그인 상태, access_token 만료",
        "단계: 만료 후 API 요청 발생",
        "기대 결과: refresh_token으로 자동 갱신, 사용자 세션 유지"
      ),
      h3("TC-004: Apple 로그인 (이메일 숨김)"),
      bullet(
        "사전 조건: Apple 계정, 이메일 숨기기 선택",
        "단계: Apple Sign In → 이메일 숨기기 옵션 선택",
        "기대 결과: relay 이메일로 계정 생성, 정상 서비스 이용 가능"
      ),
      hr(),
      h2("테스트 환경 / Environment"),
      bullet(
        "브라우저: Chrome 122, Safari 17, Firefox 123, Edge 122",
        "모바일: iOS 17 (iPhone 15), Android 14 (Pixel 8)",
        "테스트 서버: https://staging.example.com",
        "테스트 계정: QA 전용 Google/Kakao/Apple 계정 사용"
      ),
      h2("완료 기준 / Exit Criteria"),
      tasks(
        "모든 P0/P1 테스트 케이스 통과",
        "미해결 P0 버그 0건",
        "미해결 P1 버그 2건 이하 (workaround 존재)",
        "자동화 테스트 커버리지 85% 이상",
        "보안 테스트 전체 통과"
      ),
    ],
  },

  // 10. 성능 벤치마크
  {
    name: "Performance Benchmark",
    nameKo: "성능 벤치마크",
    description: "Performance benchmark report with metrics and analysis",
    descriptionKo: "성능 벤치마크 측정 결과 및 분석 보고서",
    icon: "⚡",
    category: "engineering",
    tags: ["performance", "benchmark", "optimization", "성능", "최적화"],
    blocks: [
      h2("성능 벤치마크 / Performance Benchmark"),
      callout("성능 테스트 결과를 기록하고, 병목 지점을 분석하여 최적화 방향을 제시합니다.", "⚡"),
      h2("테스트 개요 / Overview"),
      bullet(
        "테스트 대상: 상품 목록 API (GET /api/v2/products)",
        "테스트 도구: k6 + Grafana",
        "테스트 일시: 2024-03-15 02:00 KST (새벽 저점)",
        "테스트 환경: Production 동일 스펙 (AWS EKS, 3 replicas)"
      ),
      hr(),
      h2("테스트 시나리오 / Scenarios"),
      h3("시나리오 1: 기본 부하 (Normal Load)"),
      bullet("동시 사용자: 100명", "요청 빈도: 10 RPS", "지속 시간: 10분"),
      h3("시나리오 2: 피크 부하 (Peak Load)"),
      bullet("동시 사용자: 500명", "요청 빈도: 50 RPS", "지속 시간: 10분"),
      h3("시나리오 3: 스트레스 테스트 (Stress Test)"),
      bullet("동시 사용자: 100 → 1000명 (점진 증가)", "요청 빈도: 10 → 100 RPS", "지속 시간: 20분"),
      hr(),
      h2("측정 결과 / Results"),
      h3("시나리오 1: 기본 부하"),
      bullet(
        "평균 응답 시간: 45ms",
        "P95: 78ms | P99: 120ms",
        "처리량: 10.0 RPS (100% 성공)",
        "에러율: 0%",
        "CPU 사용률: 15% | 메모리: 420MB"
      ),
      h3("시나리오 2: 피크 부하"),
      bullet(
        "평균 응답 시간: 128ms",
        "P95: 340ms | P99: 890ms",
        "처리량: 49.7 RPS (99.4% 성공)",
        "에러율: 0.6% (주로 DB 커넥션 타임아웃)",
        "CPU 사용률: 65% | 메모리: 780MB"
      ),
      h3("시나리오 3: 스트레스 테스트"),
      bullet(
        "한계점: 동시 사용자 700명 시점에서 성능 급격 저하",
        "700명 시점 P99: 2,400ms (SLA 초과)",
        "1000명 시점 에러율: 12.3%",
        "CPU 사용률: 95% (병목) | 메모리: 1.2GB"
      ),
      hr(),
      h2("병목 분석 / Bottleneck Analysis"),
      numbered(
        "DB 커넥션 풀 (pool_size: 20): 동시 500+ 요청 시 커넥션 부족 → pool_size: 50으로 증가 권장",
        "상품 목록 쿼리: JOIN 3개 테이블 + ORDER BY created_at → 복합 인덱스 추가 필요",
        "이미지 URL 생성: S3 presigned URL 생성이 요청당 5ms 추가 → CDN URL 캐싱 적용",
        "JSON 직렬화: 대량 데이터(100건) 직렬화 시 CPU 스파이크 → 스트리밍 응답 고려"
      ),
      h2("최적화 제안 / Recommendations"),
      tasks(
        "[P0] DB 커넥션 풀 사이즈 20 → 50 증가 (예상: P99 30% 개선)",
        "[P1] products 테이블 (category_id, created_at) 복합 인덱스 추가",
        "[P1] 상품 목록 응답에 Redis 캐시 적용 (TTL: 60초)",
        "[P2] S3 presigned URL → CloudFront URL로 전환",
        "[P2] 응답 페이지 사이즈 기본값 100 → 20으로 축소"
      ),
      h2("비교 / Before vs After (예상)"),
      bullet(
        "P99 응답 시간: 890ms → 200ms (피크 부하 기준)",
        "동시 사용자 한계: 700명 → 2,000명",
        "에러율 (피크): 0.6% → 0.1% 이하"
      ),
      h2("다음 단계 / Next Steps"),
      tasks(
        "최적화 적용 후 동일 시나리오 재측정 (2024-03-29 예정)",
        "프론트엔드 Core Web Vitals 벤치마크 별도 수행",
        "부하 테스트 자동화 파이프라인 구축 (CI/CD 통합)"
      ),
    ],
  },

  // ──────────────── DESIGN (10) ────────────────

  // 1. 디자인 시스템
  {
    name: "Design System",
    nameKo: "디자인 시스템",
    description: "Design system documentation with tokens, components, and guidelines",
    descriptionKo: "디자인 토큰, 컴포넌트, 가이드라인을 포함한 디자인 시스템 문서",
    icon: "🎨",
    category: "design",
    tags: ["design-system", "tokens", "components", "디자인시스템"],
    blocks: [
      h2("디자인 시스템 / Design System"),
      callout("일관된 사용자 경험을 위한 디자인 시스템 문서입니다. 모든 제품 팀이 이 가이드를 기준으로 디자인/개발합니다.", "🎨"),
      h2("디자인 원칙 / Design Principles"),
      numbered(
        "명확함 (Clarity): 사용자가 다음 행동을 즉시 알 수 있어야 한다",
        "일관성 (Consistency): 동일 패턴은 동일하게 동작해야 한다",
        "접근성 (Accessibility): 모든 사용자가 동등하게 이용할 수 있어야 한다",
        "효율성 (Efficiency): 최소한의 단계로 목표를 달성할 수 있어야 한다"
      ),
      hr(),
      h2("컬러 토큰 / Color Tokens"),
      h3("Primary"),
      bullet(
        "primary-50: #EEF2FF (배경, 호버)",
        "primary-100: #E0E7FF (선택 상태 배경)",
        "primary-500: #6366F1 (기본 액션, 링크)",
        "primary-600: #4F46E5 (호버 상태)",
        "primary-700: #4338CA (활성 상태)"
      ),
      h3("Semantic"),
      bullet(
        "success: #10B981 (성공, 완료)",
        "warning: #F59E0B (경고, 주의)",
        "error: #EF4444 (에러, 삭제)",
        "info: #3B82F6 (정보, 안내)"
      ),
      h3("Neutral"),
      bullet(
        "gray-50: #F9FAFB (페이지 배경)",
        "gray-200: #E5E7EB (보더, 구분선)",
        "gray-500: #6B7280 (보조 텍스트)",
        "gray-900: #111827 (본문 텍스트)"
      ),
      hr(),
      h2("타이포그래피 / Typography"),
      bullet(
        "Font Family: Pretendard (한글), Inter (영문)",
        "Display: 36px / Bold / line-height 1.2",
        "Heading 1: 30px / Semibold / line-height 1.3",
        "Heading 2: 24px / Semibold / line-height 1.35",
        "Body: 16px / Regular / line-height 1.6",
        "Caption: 12px / Regular / line-height 1.4"
      ),
      h2("간격 시스템 / Spacing"),
      bullet(
        "4px 단위 베이스 (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)",
        "컴포넌트 내부 패딩: 12px ~ 16px",
        "섹션 간 간격: 32px ~ 48px",
        "페이지 좌우 마진: 모바일 16px, 태블릿 24px, 데스크탑 32px"
      ),
      h2("아이콘 / Icons"),
      bullet(
        "라이브러리: Lucide Icons (24px 기본)",
        "스타일: Outlined, 1.5px stroke",
        "최소 터치 영역: 44px x 44px",
        "색상: 부모 컴포넌트의 텍스트 색상 상속"
      ),
      h2("컴포넌트 목록 / Component List"),
      bullet(
        "Button: Primary, Secondary, Ghost, Danger (sm/md/lg)",
        "Input: Text, Number, Email, Password, Textarea",
        "Select: Single, Multi, Searchable",
        "Modal: Dialog, Confirm, Alert",
        "Toast: Success, Error, Warning, Info",
        "Card: Basic, Interactive, Media"
      ),
    ],
  },

  // 2. 사용자 리서치
  {
    name: "User Research",
    nameKo: "사용자 리서치",
    description: "User research plan and findings documentation",
    descriptionKo: "사용자 리서치 계획 및 인사이트 정리 문서",
    icon: "🔬",
    category: "design",
    tags: ["user-research", "interview", "사용자리서치", "인터뷰"],
    blocks: [
      h2("사용자 리서치 / User Research"),
      callout("사용자를 깊이 이해하기 위한 리서치 계획과 결과를 정리합니다. 가설 → 검증 → 인사이트 순서로 기록하세요.", "🔬"),
      h2("리서치 개요 / Overview"),
      bullet(
        "프로젝트: 모바일 앱 온보딩 개선",
        "리서치 목표: 신규 사용자의 온보딩 이탈 원인 파악",
        "기간: 2024-03-11 ~ 2024-03-22 (2주)",
        "담당: @ux-researcher"
      ),
      hr(),
      h2("리서치 질문 / Research Questions"),
      numbered(
        "신규 사용자는 온보딩의 어느 단계에서 가장 많이 이탈하는가?",
        "온보딩 중 사용자가 혼란을 느끼는 요소는 무엇인가?",
        "경쟁 서비스 대비 우리 온보딩의 강점/약점은 무엇인가?"
      ),
      h2("가설 / Hypotheses"),
      bullet(
        "H1: 3단계 프로필 설정에서 입력 항목이 많아 이탈이 발생할 것이다",
        "H2: 권한 요청(알림, 위치) 시 충분한 설명이 없어 거부율이 높을 것이다",
        "H3: 튜토리얼이 너무 길어(5단계) 스킵하는 사용자가 많을 것이다"
      ),
      hr(),
      h2("연구 방법 / Methodology"),
      h3("1. 정량 분석 (Quantitative)"),
      bullet(
        "도구: Mixpanel 퍼널 분석",
        "대상: 최근 30일 신규 가입자 12,450명",
        "측정 항목: 단계별 전환율, 완료 시간, 이탈 지점"
      ),
      h3("2. 심층 인터뷰 (In-depth Interview)"),
      bullet(
        "대상: 온보딩 이탈자 5명, 완료자 5명 (총 10명)",
        "방식: 비대면 1:1 인터뷰 (45분, Zoom)",
        "보상: 스타벅스 기프티콘 15,000원"
      ),
      h3("3. 사용성 테스트 (Usability Test)"),
      bullet(
        "대상: 앱 미사용자 6명",
        "방식: Think-Aloud 프로토콜, 화면 녹화",
        "시나리오: 앱 설치부터 첫 핵심 기능 사용까지"
      ),
      hr(),
      h2("주요 발견 / Key Findings"),
      h3("Finding 1: 프로필 설정 이탈률 42%"),
      p("프로필 설정 3단계에서 '직업'과 '관심사 태그'를 선택하는 부분에서 42%가 이탈. 인터뷰 참가자 8/10명이 '왜 이 정보가 필요한지 모르겠다'고 응답."),
      quote("사용자 P3: '개인정보를 왜 이렇게 많이 물어보는지 의심이 들었어요. 그냥 껐어요.'"),
      h3("Finding 2: 권한 요청 거부율 67%"),
      p("알림 권한 요청이 온보딩 2단계에서 갑자기 나타남. 사용자가 앱의 가치를 경험하기 전에 권한을 요청하여 거부율이 높음."),
      h3("Finding 3: 튜토리얼 스킵률 78%"),
      p("5단계 튜토리얼 중 2단계 이후 78%가 '건너뛰기' 선택. 인터랙티브 요소 없이 설명만 있어 지루하다는 반응."),
      hr(),
      h2("인사이트 및 제안 / Insights & Recommendations"),
      numbered(
        "프로필 설정을 최소화하고 나머지는 '나중에 설정' 옵션 제공 — 필수 항목: 이름, 프로필 사진만",
        "권한 요청을 관련 기능 첫 사용 시점으로 지연 (just-in-time permission)",
        "튜토리얼을 인터랙티브 가이드로 변경 — 실제 기능을 사용하며 배우는 방식",
        "온보딩 단계를 5단계 → 3단계로 축소"
      ),
      h2("다음 단계 / Next Steps"),
      tasks(
        "개선된 온보딩 프로토타입 제작 (2024-03-25)",
        "프로토타입 사용성 테스트 5명 진행 (2024-04-01)",
        "A/B 테스트 계획 수립 (기존 vs 개선 온보딩)"
      ),
    ],
  },

  // 3. 페르소나
  {
    name: "Persona",
    nameKo: "페르소나",
    description: "User persona template based on research data",
    descriptionKo: "리서치 데이터 기반 사용자 페르소나 문서",
    icon: "👤",
    category: "design",
    tags: ["persona", "user", "페르소나", "사용자"],
    blocks: [
      h2("사용자 페르소나 / User Persona"),
      callout("실제 리서치 데이터를 기반으로 작성된 대표 사용자 프로필입니다. 디자인 의사결정 시 이 페르소나를 기준으로 판단합니다.", "👤"),
      hr(),
      h2("페르소나 1: 김지현 (Primary)"),
      h3("기본 정보"),
      bullet(
        "나이: 29세 | 성별: 여성",
        "직업: 스타트업 프로덕트 매니저",
        "거주지: 서울 강남구",
        "기술 숙련도: 상 (Early Adopter)",
        "사용 디바이스: iPhone 15 Pro, MacBook Pro"
      ),
      h3("목표 / Goals"),
      numbered(
        "업무 생산성을 극대화할 수 있는 도구를 찾고 싶다",
        "팀원들과 실시간으로 협업하고 진행 상황을 한눈에 보고 싶다",
        "반복 작업을 자동화하여 전략적 업무에 집중하고 싶다"
      ),
      h3("불만 / Pain Points"),
      bullet(
        "여러 도구(Slack, Jira, Notion, Google Docs)를 오가며 컨텍스트 스위칭이 잦다",
        "회의록 작성, 주간 보고서 등 반복 업무에 시간을 많이 뺏긴다",
        "모바일에서 문서 편집이 불편하여 항상 노트북을 가지고 다녀야 한다"
      ),
      h3("행동 패턴 / Behaviors"),
      bullet(
        "출퇴근 시간에 모바일로 업무 확인 및 간단한 응답",
        "새로운 생산성 도구를 적극적으로 탐색하고 팀에 추천",
        "무료 버전으로 충분히 테스트한 후 유료 결제 결정"
      ),
      quote("'하나의 앱에서 모든 걸 해결할 수 있다면 기꺼이 돈을 내겠어요.'"),
      hr(),
      h2("페르소나 2: 박성호 (Secondary)"),
      h3("기본 정보"),
      bullet(
        "나이: 45세 | 성별: 남성",
        "직업: 중소기업 대표 (직원 30명)",
        "거주지: 경기도 판교",
        "기술 숙련도: 중 (Mainstream)",
        "사용 디바이스: Galaxy S24, Windows 노트북"
      ),
      h3("목표 / Goals"),
      numbered(
        "직원들의 업무 현황을 실시간으로 파악하고 싶다",
        "복잡한 도구 없이 간단하게 프로젝트를 관리하고 싶다",
        "도입 비용이 합리적인 올인원 업무 도구를 찾고 싶다"
      ),
      h3("불만 / Pain Points"),
      bullet(
        "IT 전문가가 없어 복잡한 도구 도입이 어렵다",
        "직원마다 다른 도구를 사용해 정보가 분산되어 있다",
        "영어로만 제공되는 도구는 직원 교육에 시간이 많이 걸린다"
      ),
      h3("행동 패턴 / Behaviors"),
      bullet(
        "동종 업계 대표 모임에서 추천받은 도구를 우선 검토",
        "무료 체험 후 직원 3~5명과 파일럿 운영 후 전사 도입 결정",
        "한국어 지원과 고객 서비스를 중요하게 생각"
      ),
      quote("'복잡한 건 싫어요. 직원들이 5분 안에 배울 수 있어야 합니다.'"),
      hr(),
      h2("페르소나 활용 가이드 / How to Use"),
      bullet(
        "기능 우선순위 결정 시: Primary 페르소나의 니즈를 먼저 충족",
        "UX Writing 톤앤매너: 김지현에게는 효율적, 박성호에게는 쉽고 친절하게",
        "온보딩 설계: 박성호도 5분 안에 핵심 기능을 이해할 수 있어야 함"
      ),
    ],
  },

  // 4. 사용자 여정 맵
  {
    name: "User Journey Map",
    nameKo: "사용자 여정 맵",
    description: "End-to-end user journey map with touchpoints and emotions",
    descriptionKo: "사용자의 전체 경험 여정을 터치포인트별로 시각화",
    icon: "🗺️",
    category: "design",
    tags: ["journey-map", "ux", "experience", "여정맵", "경험"],
    blocks: [
      h2("사용자 여정 맵 / User Journey Map"),
      callout("사용자가 서비스를 인지하고 사용하기까지의 전체 경험을 단계별로 기록합니다. 각 단계의 감정, 터치포인트, 기회 영역을 포함합니다.", "🗺️"),
      h2("여정 개요 / Overview"),
      bullet(
        "페르소나: 김지현 (29세, PM)",
        "시나리오: 프로젝트 관리 도구를 탐색하고 팀에 도입하기까지",
        "기간: 약 2주 (인지 → 도입 결정)"
      ),
      hr(),
      h2("1단계: 인지 (Awareness)"),
      h3("상황"),
      p("팀 프로젝트가 늘어나면서 기존 도구(스프레드시트)로 관리가 어려워짐. 동료의 추천과 블로그 리뷰를 통해 서비스를 알게 됨."),
      h3("터치포인트"),
      bullet("동료 추천 (Slack 메시지)", "블로그 리뷰 기사", "Google 검색 결과"),
      h3("행동"),
      bullet("서비스 홈페이지 방문", "기능 소개 페이지 훑어보기", "가격 페이지 확인"),
      h3("감정"),
      p("🟡 기대 반 의심 반 — '또 다른 도구를 배워야 하나...'"),
      h3("기회 영역"),
      bullet("랜딩 페이지에서 기존 도구 대비 차별점을 명확히 전달", "사용 후기/케이스 스터디를 눈에 띄게 배치"),
      hr(),
      h2("2단계: 고려 (Consideration)"),
      h3("상황"),
      p("무료 체험을 시작하고 기존 데이터를 옮길 수 있는지 확인. 경쟁 서비스와 기능을 비교."),
      h3("터치포인트"),
      bullet("회원가입 및 온보딩", "무료 체험 대시보드", "도움말 센터"),
      h3("행동"),
      bullet("샘플 프로젝트 생성", "Jira 데이터 import 시도", "팀원 1명 초대하여 함께 테스트"),
      h3("감정"),
      p("🟢 긍정적 — '직관적이고 빠르다! 데이터 import도 쉽네'"),
      h3("기회 영역"),
      bullet("온보딩에서 import 기능을 먼저 안내", "경쟁 서비스 비교 가이드 제공"),
      hr(),
      h2("3단계: 결정 (Decision)"),
      h3("상황"),
      p("팀 리드에게 도구 도입을 제안하고 승인을 받기 위해 비용 대비 효과를 정리."),
      h3("터치포인트"),
      bullet("가격 플랜 페이지", "팀 플랜 비교표", "고객 지원 채팅"),
      h3("행동"),
      bullet("팀 플랜 가격 확인 및 ROI 계산", "고객 지원에 엔터프라이즈 기능 문의", "내부 제안서 작성"),
      h3("감정"),
      p("🟡 약간의 불안 — '팀원들이 잘 적응할까? 비용이 합리적인가?'"),
      h3("기회 영역"),
      bullet("도입 제안서 템플릿 제공", "30일 무료 팀 체험 확장 옵션"),
      hr(),
      h2("4단계: 도입 (Adoption)"),
      h3("상황"),
      p("팀 전체(8명)가 서비스를 사용하기 시작. 기존 워크플로우를 새 도구로 전환."),
      h3("터치포인트"),
      bullet("팀 온보딩 세션", "템플릿 갤러리", "Slack 연동 설정"),
      h3("행동"),
      bullet("팀 워크스페이스 설정", "프로젝트 템플릿 적용", "기존 데이터 전체 마이그레이션"),
      h3("감정"),
      p("🟢 만족 — '팀원들도 금방 적응했고, 프로젝트 현황이 한눈에 보여!'"),
      h3("기회 영역"),
      bullet("팀 관리자를 위한 베스트 프랙티스 가이드", "도입 1주차 자동 체크인 이메일"),
      hr(),
      h2("핵심 인사이트 / Key Insights"),
      numbered(
        "인지 단계에서 '기존 도구와의 차별점'이 가장 중요한 설득 포인트",
        "데이터 import 기능의 편의성이 고려 단계의 핵심 전환 요소",
        "팀 도입 시 관리자에게 ROI 자료와 제안서 템플릿을 제공하면 전환 가속",
        "도입 후 첫 1주가 습관 형성의 골든 타임"
      ),
    ],
  },

  // 5. 디자인 스프린트
  {
    name: "Design Sprint",
    nameKo: "디자인 스프린트",
    description: "5-day design sprint plan with activities and outputs",
    descriptionKo: "5일간의 디자인 스프린트 계획 및 활동 가이드",
    icon: "🏃",
    category: "design",
    tags: ["design-sprint", "workshop", "디자인스프린트", "워크숍"],
    blocks: [
      h2("디자인 스프린트 / Design Sprint"),
      callout("Google Ventures 방식의 5일 디자인 스프린트입니다. 팀이 함께 문제를 정의하고 프로토타입을 만들어 사용자에게 검증합니다.", "🏃"),
      h2("스프린트 개요 / Overview"),
      bullet(
        "주제: 신규 사용자 첫 구매 전환율 개선",
        "기간: 2024-03-18 (월) ~ 2024-03-22 (금)",
        "참여자: PM, 디자이너 2명, 개발자 2명, 마케터 1명, 데이터 분석가 1명",
        "퍼실리테이터: @design-lead",
        "장소: 5층 워크숍 룸 (화이트보드 3개, 포스트잇, 마커 준비)"
      ),
      hr(),
      h2("Day 1 (월) — 이해하기 / Map"),
      p("목표: 문제를 명확히 정의하고 스프린트 목표를 설정한다."),
      bullet(
        "09:30~10:00 — 스프린트 목표 공유 및 룰 설정",
        "10:00~11:30 — 전문가 인터뷰: CS팀 리드, 데이터 분석가 (각 20분)",
        "11:30~12:00 — How Might We(HMW) 메모 작성",
        "13:00~14:30 — 사용자 여정 맵 작성 (현재 상태)",
        "14:30~15:30 — 스프린트 타겟 선정: 여정 중 가장 큰 기회 영역",
        "산출물: 사용자 여정 맵, HMW 목록, 스프린트 타겟"
      ),
      h2("Day 2 (화) — 아이디어 / Sketch"),
      p("목표: 가능한 많은 솔루션을 탐색하고 구체화한다."),
      bullet(
        "09:30~10:30 — Lightning Demos: 경쟁사 및 영감 사례 공유 (각 3분)",
        "10:30~12:00 — 개인 스케치: 4단계 스케치 (노트 → 아이디어 → Crazy 8's → 솔루션 스케치)",
        "13:00~14:00 — 솔루션 스케치 마무리 (3패널 스토리보드)",
        "14:00~15:00 — 스케치 갤러리 전시 및 묵독",
        "산출물: 개인별 솔루션 스케치 7장"
      ),
      h2("Day 3 (수) — 결정 / Decide"),
      p("목표: 최종 솔루션을 선택하고 프로토타입 스토리보드를 만든다."),
      bullet(
        "09:30~10:30 — 투표: 히트맵 스티커 → 슈퍼보트 (결정권자)",
        "10:30~11:30 — Rumble or All-in-One: 최종 방향 결정",
        "11:30~12:00 — 사용자 테스트 플로우 작성",
        "13:00~15:00 — 프로토타입 스토리보드 작성 (8~12컷)",
        "산출물: 최종 솔루션 선정, 프로토타입 스토리보드"
      ),
      h2("Day 4 (목) — 프로토타입 / Prototype"),
      p("목표: 테스트 가능한 고충실도 프로토타입을 완성한다."),
      bullet(
        "09:30~12:00 — Figma 프로토타입 제작 (디자이너 2명 분업)",
        "12:00~13:00 — 인터랙션 및 전환 효과 추가",
        "14:00~15:30 — 프로토타입 내부 리뷰 및 수정",
        "15:30~16:00 — 인터뷰 대본 및 시나리오 최종 확인",
        "산출물: Figma 프로토타입, 인터뷰 대본"
      ),
      h2("Day 5 (금) — 테스트 / Test"),
      p("목표: 실제 사용자 5명과 프로토타입 테스트, 인사이트 도출."),
      bullet(
        "09:30~15:00 — 사용자 인터뷰 5명 (각 45분, 쉬는 시간 포함)",
        "인터뷰어: 1명, 노트 테이커: 2명, 관찰실: 나머지 팀원",
        "15:00~16:00 — 인터뷰 결과 종합 (패턴 분석)",
        "16:00~17:00 — 스프린트 회고 및 다음 단계 결정",
        "산출물: 테스트 결과 보고서, 다음 단계 액션 아이템"
      ),
      hr(),
      h2("스프린트 후 / After Sprint"),
      tasks(
        "테스트 결과 보고서 작성 및 공유 (월요일까지)",
        "검증된 솔루션 기반 디자인 상세 작업 시작",
        "개발 스프린트 백로그에 구현 태스크 추가"
      ),
    ],
  },

  // 6. 와이어프레임 노트
  {
    name: "Wireframe Notes",
    nameKo: "와이어프레임 노트",
    description: "Wireframe annotations and design decisions",
    descriptionKo: "와이어프레임 주석 및 디자인 의사결정 기록",
    icon: "📐",
    category: "design",
    tags: ["wireframe", "layout", "와이어프레임", "레이아웃"],
    blocks: [
      h2("와이어프레임 노트 / Wireframe Notes"),
      callout("와이어프레임의 각 화면에 대한 설명, 인터랙션, 디자인 결정 사항을 기록합니다. Figma 링크와 함께 관리하세요.", "📐"),
      h2("프로젝트 정보 / Project Info"),
      bullet(
        "프로젝트: 프로필 설정 페이지 리디자인",
        "Figma 링크: [Figma 파일 URL]",
        "버전: v2 (2024-03-15)",
        "디자이너: @designer-name"
      ),
      hr(),
      h2("화면 1: 프로필 메인 / Profile Main"),
      h3("레이아웃 설명"),
      p("상단에 프로필 사진과 기본 정보(이름, 이메일), 하단에 설정 메뉴 리스트. 프로필 사진은 중앙 정렬, 편집 버튼은 사진 우하단 오버레이."),
      h3("구성 요소"),
      bullet(
        "프로필 사진: 80px 원형, 편집 아이콘 오버레이 (카메라 아이콘)",
        "이름: Heading 2, 한 줄 노출, 20자 초과 시 말줄임",
        "이메일: Body 텍스트, gray-500 색상",
        "설정 메뉴 리스트: Icon + Label + 화살표, 44px 높이, 터치 영역 전체 row"
      ),
      h3("인터랙션"),
      bullet(
        "프로필 사진 탭 → 바텀시트 (카메라 촬영 / 앨범에서 선택 / 기본 이미지로 변경)",
        "메뉴 항목 탭 → 해당 설정 페이지로 이동 (push navigation)",
        "스크롤: 프로필 영역이 상단에 고정(sticky), 메뉴 리스트만 스크롤"
      ),
      h3("디자인 결정"),
      bullet(
        "결정: 프로필 사진 편집을 바텀시트로 처리 (모달 대신)",
        "이유: 모바일에서 바텀시트가 더 자연스럽고 한 손 조작에 유리",
        "대안: 별도 편집 페이지 → 과도한 화면 전환으로 판단하여 기각"
      ),
      hr(),
      h2("화면 2: 이름 편집 / Edit Name"),
      h3("레이아웃 설명"),
      p("단일 입력 필드와 저장 버튼으로 구성된 간단한 폼. 네비게이션 바에 '뒤로' 버튼과 '저장' 버튼 배치."),
      h3("구성 요소"),
      bullet(
        "입력 필드: 기존 이름이 pre-filled, 최대 20자, 실시간 글자수 카운터",
        "안내 문구: '다른 사용자에게 표시되는 이름입니다' (gray-500, Caption)",
        "저장 버튼: Primary Button (네비바 우측 또는 하단 고정)"
      ),
      h3("인터랙션"),
      bullet(
        "입력 필드 포커스 시 키보드 자동 올라옴",
        "20자 초과 입력 시도 시 입력 차단 + 필드 테두리 error 색상",
        "변경 없이 뒤로가기 시 바로 이동 (confirm 없음)",
        "변경 후 뒤로가기 시 '변경 사항을 저장하시겠습니까?' 다이얼로그"
      ),
      h3("엣지 케이스"),
      bullet(
        "빈 이름 저장 시도: '이름을 입력해주세요' 에러 메시지",
        "특수문자만 입력: 허용 (이모지 포함)",
        "네트워크 오류 시: '저장에 실패했습니다. 다시 시도해주세요' 토스트"
      ),
      hr(),
      h2("공통 사항 / Common Notes"),
      bullet(
        "모든 화면은 Safe Area 준수 (노치, 홈 인디케이터)",
        "다크 모드: gray-900 배경, 텍스트 white으로 반전",
        "접근성: 모든 인터랙티브 요소에 접근성 레이블 필수",
        "로딩 상태: Skeleton UI 적용 (shimmer 효과)"
      ),
    ],
  },

  // 7. 디자인 피드백
  {
    name: "Design Feedback",
    nameKo: "디자인 피드백",
    description: "Structured design feedback and critique template",
    descriptionKo: "구조화된 디자인 피드백 및 크리틱 템플릿",
    icon: "💬",
    category: "design",
    tags: ["feedback", "critique", "review", "피드백", "크리틱"],
    blocks: [
      h2("디자인 피드백 / Design Feedback"),
      callout("건설적인 피드백을 위한 구조화된 양식입니다. '좋은 점 → 개선점 → 질문' 순서로 작성하면 효과적입니다.", "💬"),
      h2("피드백 대상 / Subject"),
      bullet(
        "디자인: 결제 플로우 리디자인 v3",
        "Figma 링크: [Figma URL]",
        "디자이너: @designer-name",
        "피드백 요청일: 2024-03-15",
        "피드백 마감일: 2024-03-18"
      ),
      h2("피드백 요청 사항 / Focus Areas"),
      p("디자이너가 특별히 피드백을 원하는 영역을 명시합니다."),
      bullet(
        "결제 수단 선택 UI의 직관성",
        "3단계 프로세스 흐름의 자연스러움",
        "에러 상태 처리의 적절성"
      ),
      hr(),
      h2("피드백 1: @reviewer-A (PM)"),
      h3("잘된 점 / What Works Well"),
      bullet(
        "결제 수단 선택 화면의 카드형 UI가 직관적이고 각 수단의 구분이 명확하다",
        "결제 진행 중 프로그레스 바가 현재 위치를 잘 보여준다",
        "최종 확인 화면에서 주문 요약이 깔끔하게 정리되어 있다"
      ),
      h3("개선 제안 / Suggestions"),
      bullet(
        "1단계 배송지 입력에서 '최근 배송지' 옵션이 눈에 잘 안 띈다 → 상단으로 올리거나 강조 처리 권장",
        "결제 버튼의 색상이 주변 요소와 비슷해 시각적 위계가 약하다 → CTA 버튼 대비를 더 강하게",
        "에러 상태에서 '다시 시도' 버튼만 있고 대안 안내가 없다 → '다른 결제 수단 사용' 옵션 추가"
      ),
      h3("질문 / Questions"),
      bullet(
        "할인 쿠폰 적용 UI는 어디에 들어갈 예정인가요?",
        "결제 실패 시 3회 초과 실패 케이스는 어떻게 처리하나요?"
      ),
      hr(),
      h2("피드백 2: @reviewer-B (개발자)"),
      h3("잘된 점 / What Works Well"),
      bullet(
        "로딩 상태와 트랜지션이 자연스럽고 구현하기 편한 구조다",
        "컴포넌트 재사용이 잘 고려되어 있어 개발 효율적"
      ),
      h3("개선 제안 / Suggestions"),
      bullet(
        "카드 결제 입력 시 카드 번호 자동 포맷팅(4자리씩 끊기)이 명시되면 좋겠다",
        "결제 완료 후 주문번호가 복사 가능하도록 인터랙션 추가 권장"
      ),
      h3("기술적 고려사항 / Technical Notes"),
      bullet(
        "PG사 결제창 연동 시 iframe 형태로 삽입되어 스타일 커스텀 제한 있음",
        "Apple Pay / Google Pay 버튼은 각 플랫폼 가이드라인 디자인 필수"
      ),
      hr(),
      h2("액션 아이템 / Action Items"),
      tasks(
        "최근 배송지 선택 영역 상단 배치 및 강조 처리 (@designer, 3/20)",
        "CTA 버튼 대비 강화 — 색상 대안 2가지 준비 (@designer, 3/20)",
        "결제 실패 시 대안 안내 플로우 추가 (@designer, 3/22)",
        "카드 번호 자동 포맷팅 인터랙션 명세 추가 (@designer, 3/20)",
        "PG사 iframe 제약 사항 정리하여 공유 (@developer, 3/19)"
      ),
    ],
  },

  // 8. 접근성 체크리스트
  {
    name: "Accessibility Checklist",
    nameKo: "접근성 체크리스트",
    description: "Web accessibility (WCAG) compliance checklist",
    descriptionKo: "웹 접근성(WCAG) 준수를 위한 체크리스트",
    icon: "♿",
    category: "design",
    tags: ["accessibility", "a11y", "wcag", "접근성"],
    blocks: [
      h2("접근성 체크리스트 / Accessibility Checklist"),
      callout("WCAG 2.1 AA 기준의 접근성 체크리스트입니다. 디자인 단계와 개발 단계에서 모두 확인해야 합니다.", "♿"),
      h2("대상 / Scope"),
      bullet(
        "프로젝트: 메인 서비스 웹사이트",
        "기준: WCAG 2.1 Level AA",
        "검수일: 2024-03-15",
        "담당: @accessibility-lead"
      ),
      hr(),
      h2("1. 인식의 용이성 / Perceivable"),
      h3("텍스트 대체"),
      tasks(
        "모든 이미지에 의미 있는 alt 텍스트가 있다 (장식용 이미지는 alt='')",
        "아이콘 버튼에 aria-label 또는 visually hidden 텍스트가 있다",
        "비디오에 자막(CC) 또는 대체 텍스트가 제공된다",
        "복잡한 이미지(차트, 인포그래픽)에 상세 설명이 있다"
      ),
      h3("색상 및 대비"),
      tasks(
        "본문 텍스트 대비율 4.5:1 이상 (AA 기준)",
        "큰 텍스트(18px bold+) 대비율 3:1 이상",
        "색상만으로 정보를 전달하지 않는다 (예: 에러 표시에 색상 + 아이콘 병행)",
        "포커스 인디케이터가 충분한 대비로 보인다"
      ),
      hr(),
      h2("2. 운용의 용이성 / Operable"),
      h3("키보드 접근성"),
      tasks(
        "모든 인터랙티브 요소에 키보드로 접근 가능하다 (Tab, Enter, Space, Arrow)",
        "포커스 순서가 논리적이다 (좌→우, 위→아래)",
        "키보드 트랩이 없다 (모달에서 Esc로 탈출 가능)",
        "건너뛰기 링크(Skip to content)가 페이지 최상단에 있다"
      ),
      h3("충분한 시간"),
      tasks(
        "자동 회전 콘텐츠(캐러셀)에 일시정지 버튼이 있다",
        "세션 타임아웃 전 경고를 제공한다",
        "시간 제한이 있는 작업에 연장 옵션을 제공한다"
      ),
      h3("터치 및 포인터"),
      tasks(
        "터치 타겟 최소 44x44px 이상이다",
        "드래그 앤 드롭에 대체 키보드 조작 방법이 있다",
        "호버에서만 노출되는 콘텐츠가 없다 (모바일 대응)"
      ),
      hr(),
      h2("3. 이해의 용이성 / Understandable"),
      h3("가독성"),
      tasks(
        "페이지 언어가 html lang 속성으로 명시되어 있다 (lang='ko')",
        "약어나 전문 용어에 설명이 제공된다",
        "문장이 간결하고 이해하기 쉬운 언어로 작성되었다"
      ),
      h3("입력 지원"),
      tasks(
        "모든 폼 필드에 연결된 label이 있다",
        "필수 필드에 시각적 표시와 aria-required가 있다",
        "에러 메시지가 구체적이고 해결 방법을 안내한다 (예: '이메일 형식이 올바르지 않습니다')",
        "자동완성 속성(autocomplete)이 적절히 사용된다"
      ),
      hr(),
      h2("4. 견고성 / Robust"),
      tasks(
        "유효한 HTML 마크업을 사용한다 (W3C Validator 통과)",
        "ARIA 역할(role)과 속성이 올바르게 사용된다",
        "동적 콘텐츠 변경 시 aria-live로 스크린리더에 알린다",
        "커스텀 컴포넌트가 WAI-ARIA 패턴을 따른다"
      ),
      hr(),
      h2("테스트 도구 / Testing Tools"),
      bullet(
        "자동화: axe DevTools, Lighthouse Accessibility",
        "스크린리더: VoiceOver (macOS), NVDA (Windows)",
        "키보드: 마우스 없이 전체 시나리오 수행",
        "대비 검사: WebAIM Contrast Checker"
      ),
      h2("참고 자료 / References"),
      bullet(
        "WCAG 2.1 가이드라인: https://www.w3.org/TR/WCAG21/",
        "WAI-ARIA 패턴: https://www.w3.org/WAI/ARIA/apg/",
        "한국 웹 접근성 인증: https://www.wa.or.kr/"
      ),
    ],
  },

  // 9. 브랜드 가이드
  {
    name: "Brand Guide",
    nameKo: "브랜드 가이드",
    description: "Brand identity guide with logo, colors, typography, and tone",
    descriptionKo: "로고, 색상, 타이포그래피, 톤앤매너를 포함한 브랜드 가이드",
    icon: "✨",
    category: "design",
    tags: ["brand", "identity", "guideline", "브랜드", "아이덴티티"],
    blocks: [
      h2("브랜드 가이드 / Brand Guide"),
      callout("브랜드의 시각적 정체성과 커뮤니케이션 원칙을 정의합니다. 모든 외부 커뮤니케이션은 이 가이드를 따릅니다.", "✨"),
      h2("브랜드 미션 / Mission"),
      quote("복잡한 업무를 단순하게, 단순한 협업을 강력하게."),
      p("우리는 모든 팀이 쉽고 효율적으로 협업할 수 있는 도구를 만듭니다. 기술의 복잡함은 우리가 해결하고, 사용자에게는 직관적인 경험만 전달합니다."),
      hr(),
      h2("로고 / Logo"),
      h3("로고 사용 규칙"),
      bullet(
        "기본 로고: 심볼 + 워드마크 조합 (가로형)",
        "최소 크기: 디지털 96px, 인쇄 25mm",
        "여백(Clear space): 심볼 높이의 50% 이상 확보",
        "금지 사항: 비율 변경, 색상 임의 변경, 회전, 그림자/효과 추가"
      ),
      h3("로고 컬러 변형"),
      bullet(
        "풀 컬러: 밝은 배경에서 사용 (Primary)",
        "화이트: 어두운 배경에서 사용",
        "블랙: 단색 인쇄물에서 사용"
      ),
      hr(),
      h2("컬러 팔레트 / Color Palette"),
      h3("Primary Color"),
      bullet(
        "Indigo 600: #4F46E5 — 주요 CTA, 브랜드 대표 색상",
        "사용 비율: 전체 디자인의 60%"
      ),
      h3("Secondary Color"),
      bullet(
        "Teal 500: #14B8A6 — 보조 액션, 성공 상태, 보조 강조",
        "사용 비율: 전체 디자인의 20%"
      ),
      h3("Accent & Neutral"),
      bullet(
        "Amber 400: #FBBF24 — 알림, 하이라이트, 뱃지",
        "Gray 계열: UI 배경, 텍스트, 보더에 사용",
        "사용 비율: 전체 디자인의 20%"
      ),
      hr(),
      h2("타이포그래피 / Typography"),
      bullet(
        "한글: Pretendard — 깔끔하고 현대적인 산세리프",
        "영문: Inter — 가독성 높은 UI 서체",
        "코드: JetBrains Mono — 개발자 관련 콘텐츠",
        "제목: Semibold ~ Bold, 본문: Regular, 강조: Medium"
      ),
      h2("톤 앤 보이스 / Tone & Voice"),
      h3("브랜드 성격"),
      bullet(
        "전문적이지만 친근한 (Professional yet Friendly)",
        "자신감 있지만 겸손한 (Confident yet Humble)",
        "효율적이지만 따뜻한 (Efficient yet Warm)"
      ),
      h3("작문 원칙"),
      numbered(
        "짧고 명확하게: 한 문장에 하나의 메시지만 전달",
        "사용자 중심 언어: '기능을 추가했습니다' → '이제 ~ 할 수 있습니다'",
        "긍정적 프레이밍: '실패했습니다' → '다시 시도해 주세요'",
        "존댓말 사용: 해요체 기본 (습니다체는 공식 문서에서만)"
      ),
      h3("톤 예시"),
      bullet(
        "에러 메시지: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.' (O)",
        "에러 메시지: 'Error 500: Internal Server Error' (X)",
        "완료 메시지: '저장이 완료되었어요! 🎉' (O)",
        "빈 상태: '아직 프로젝트가 없어요. 첫 프로젝트를 만들어 볼까요?' (O)"
      ),
      hr(),
      h2("이미지 스타일 / Photography"),
      bullet(
        "자연스러운 업무 환경: 실제 사무실, 카페, 재택근무 모습",
        "밝고 따뜻한 톤: 자연광 위주, 과도한 필터 지양",
        "다양성: 다양한 연령, 성별, 배경의 인물 포함",
        "금지: 과도한 스톡 포토 느낌, 어색한 포즈"
      ),
    ],
  },

  // 10. UI 컴포넌트 목록
  {
    name: "UI Component Inventory",
    nameKo: "UI 컴포넌트 목록",
    description: "UI component inventory with specs, states, and usage guidelines",
    descriptionKo: "UI 컴포넌트 인벤토리 - 스펙, 상태, 사용 가이드라인",
    icon: "🧩",
    category: "design",
    tags: ["component", "ui", "inventory", "컴포넌트", "인벤토리"],
    blocks: [
      h2("UI 컴포넌트 목록 / Component Inventory"),
      callout("서비스에서 사용하는 모든 UI 컴포넌트의 스펙, 상태, 사용 규칙을 정리합니다. Figma 컴포넌트 라이브러리와 1:1 매핑됩니다.", "🧩"),
      h2("컴포넌트 개요 / Overview"),
      bullet(
        "총 컴포넌트 수: 42개",
        "Figma 라이브러리: [Figma Library URL]",
        "코드 Storybook: [Storybook URL]",
        "마지막 업데이트: 2024-03-15"
      ),
      hr(),
      h2("Button / 버튼"),
      h3("Variants"),
      bullet(
        "Primary: 주요 액션 (저장, 확인, 결제) — Indigo 600 배경, 흰색 텍스트",
        "Secondary: 보조 액션 (취소, 뒤로가기) — 흰색 배경, Indigo 600 텍스트, 보더",
        "Ghost: 낮은 강조 (더보기, 옵션) — 투명 배경, 호버 시 gray-100 배경",
        "Danger: 위험 액션 (삭제, 해제) — Red 600 배경, 흰색 텍스트"
      ),
      h3("Sizes"),
      bullet(
        "Small (sm): 높이 32px, 패딩 8px 12px, 텍스트 14px",
        "Medium (md): 높이 40px, 패딩 10px 16px, 텍스트 14px — 기본값",
        "Large (lg): 높이 48px, 패딩 12px 24px, 텍스트 16px"
      ),
      h3("States"),
      bullet(
        "Default → Hover (밝기 -10%) → Active (밝기 -20%) → Disabled (opacity 50%)",
        "Loading: 텍스트 대신 스피너 표시, 클릭 비활성화",
        "Focus: 2px offset Indigo 300 outline"
      ),
      h3("사용 규칙"),
      bullet(
        "한 화면에 Primary 버튼은 1개만 사용",
        "버튼 텍스트는 동사로 시작 (예: '저장하기', '다음으로')",
        "아이콘 + 텍스트 조합 시 아이콘은 텍스트 왼쪽에 배치"
      ),
      hr(),
      h2("Input / 입력 필드"),
      h3("Types"),
      bullet(
        "Text Input: 일반 텍스트 입력",
        "Password Input: 비밀번호, 표시/숨김 토글 포함",
        "Search Input: 검색 아이콘 + 지우기 버튼",
        "Textarea: 여러 줄 입력, 리사이즈 핸들"
      ),
      h3("States"),
      bullet(
        "Default: gray-200 보더",
        "Focus: Indigo 500 보더, 2px, 외부 ring",
        "Error: Red 500 보더, 에러 메시지 하단 표시",
        "Disabled: gray-100 배경, 커서 not-allowed"
      ),
      h3("구성 요소"),
      bullet(
        "Label: 필드 상단, 14px Medium",
        "Placeholder: gray-400, 입력 예시 표시",
        "Helper text: 필드 하단, 12px, gray-500",
        "Error message: 필드 하단, 12px, Red 500, 에러 아이콘 포함"
      ),
      hr(),
      h2("Modal / 모달"),
      h3("Types"),
      bullet(
        "Dialog: 제목 + 본문 + 액션 버튼 (일반적인 안내/확인)",
        "Confirm: 파괴적 액션 확인 (삭제, 해제 등)",
        "Form: 인라인 폼을 포함하는 모달",
        "Full-screen: 모바일에서 전체 화면 (데스크탑에서는 일반 모달)"
      ),
      h3("스펙"),
      bullet(
        "너비: 최소 320px, 최대 560px (데스크탑)",
        "패딩: 24px",
        "배경 Overlay: rgba(0, 0, 0, 0.5)",
        "애니메이션: fade-in + scale (200ms ease-out)"
      ),
      h3("사용 규칙"),
      bullet(
        "모달 위에 모달을 띄우지 않는다 (최대 1겹)",
        "닫기 방법: X 버튼, Overlay 클릭, Esc 키 (3가지 모두 지원)",
        "Confirm 모달에서 파괴적 버튼은 Danger 스타일 사용",
        "모바일에서 작은 모달은 Bottom Sheet로 대체"
      ),
      hr(),
      h2("Toast / 토스트"),
      h3("Types"),
      bullet(
        "Success: 초록색 아이콘, 성공 메시지",
        "Error: 빨간색 아이콘, 에러 메시지 + 재시도 액션",
        "Warning: 노란색 아이콘, 주의 메시지",
        "Info: 파란색 아이콘, 안내 메시지"
      ),
      h3("스펙 및 동작"),
      bullet(
        "위치: 화면 하단 중앙 (모바일), 우상단 (데스크탑)",
        "자동 닫힘: 5초 (에러는 수동 닫기만 가능)",
        "최대 동시 표시: 3개, 새 토스트는 기존 것 위에 스택",
        "애니메이션: slide-up + fade-in (300ms)"
      ),
      hr(),
      h2("컴포넌트 추가 요청 / New Component Request"),
      p("새로운 컴포넌트가 필요한 경우 아래 양식으로 요청해주세요."),
      tasks(
        "컴포넌트 이름과 용도 설명 작성",
        "사용 화면 및 시나리오 첨부",
        "기존 컴포넌트로 대체 불가능한 이유 명시",
        "디자인 시스템 팀 리뷰 예약 (@design-system-team)"
      ),
    ],
  },
];
