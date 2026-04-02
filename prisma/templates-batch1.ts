// templates-batch1.ts — DOCUMENTS (10) + PERSONAL (10) template data

const h2 = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const h3 = (text: string) => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
const p = (text = "") => text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const bullet = (...items: string[]) => ({ type: "bulletList", content: items.map(t => ({ type: "listItem", content: [t ? { type: "paragraph", content: [{ type: "text", text: t }] } : { type: "paragraph" }] })) });
const tasks = (...items: string[]) => ({ type: "taskList", content: items.map(t => ({ type: "taskItem", attrs: { checked: false }, content: [t ? { type: "paragraph", content: [{ type: "text", text: t }] } : { type: "paragraph" }] })) });
const numbered = (...items: string[]) => ({ type: "orderedList", content: items.map(t => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })) });
const quote = (text: string) => ({ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const hr = () => ({ type: "horizontalRule" });
const callout = (text: string, icon = "💡") => ({ type: "callout", attrs: { icon, color: "default" }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

export const BATCH1_TEMPLATES = [
  // ============================================================
  // DOCUMENTS (10)
  // ============================================================

  // 1. 회의록 (Meeting Notes)
  {
    name: "회의록",
    description: "팀 회의, 스탠드업, 브레인스토밍 등 다양한 회의를 체계적으로 기록하는 템플릿입니다.",
    category: "DOCUMENTS",
    icon: "📝",
    content: [
      h2("회의록 — Meeting Notes"),
      callout("회의 전에 안건을 미리 작성하고, 회의 중 실시간으로 기록하세요. 회의 후 액션 아이템을 반드시 배정하세요.", "📝"),
      hr(),
      h3("기본 정보 Basic Info"),
      bullet(
        "일시: 2026-04-02 (목) 14:00–15:00",
        "장소: 회의실 A / Zoom 링크",
        "참석자: 김민수(PM), 이지은(디자인), 박준호(백엔드), 최수진(프론트엔드)",
        "기록자: 최수진",
        "회의 유형: 주간 스프린트 리뷰"
      ),
      hr(),
      h3("안건 Agenda"),
      numbered(
        "지난 스프린트 회고 (10분)",
        "이번 스프린트 목표 논의 (20분)",
        "디자인 시안 리뷰 (15분)",
        "기술 이슈 공유 (10분)",
        "Q&A (5분)"
      ),
      hr(),
      h3("논의 내용 Discussion"),
      h3("1. 지난 스프린트 회고"),
      bullet(
        "로그인 기능 구현 완료 — QA 통과, 프로덕션 배포 완료",
        "대시보드 차트 성능 개선 — Lighthouse 점수 72→89 향상",
        "알림 기능은 API 설계 변경으로 1일 지연됨"
      ),
      h3("2. 이번 스프린트 목표"),
      bullet(
        "사용자 프로필 페이지 v1 완성",
        "결제 모듈 Stripe 연동 시작",
        "E2E 테스트 커버리지 60% 달성"
      ),
      h3("3. 디자인 시안 리뷰"),
      p("이지은 님이 프로필 페이지 Figma 시안을 공유함. 모바일 반응형 레이아웃에 대해 추가 논의 필요."),
      quote("모바일에서 프로필 사진과 기본 정보가 한 화면에 보여야 한다 — 김민수"),
      hr(),
      h3("결정 사항 Decisions"),
      bullet(
        "프로필 페이지 모바일 우선(Mobile-first)으로 구현",
        "Stripe 연동은 sandbox 환경에서 먼저 테스트",
        "다음 회의: 2026-04-09 (목) 14:00"
      ),
      hr(),
      h3("액션 아이템 Action Items"),
      tasks(
        "[박준호] Stripe sandbox API 키 발급 및 환경 설정 — 4/4까지",
        "[최수진] 프로필 페이지 모바일 레이아웃 구현 — 4/7까지",
        "[이지은] 결제 플로우 와이어프레임 작성 — 4/5까지",
        "[김민수] 스프린트 백로그 Jira 업데이트 — 4/3까지"
      ),
      hr(),
      h3("메모 Notes"),
      p("다음 회의에서 결제 플로우 전체 흐름을 리뷰할 예정. QA팀에 프로필 페이지 테스트 요청 필요."),
    ],
  },

  // 2. 설계 문서 (Design Document)
  {
    name: "설계 문서",
    description: "시스템 아키텍처, 기능 설계, 데이터 모델 등 기술 설계를 문서화하는 템플릿입니다.",
    category: "DOCUMENTS",
    icon: "📐",
    content: [
      h2("설계 문서 — Design Document"),
      callout("설계 문서는 구현 전에 팀원들의 리뷰를 받고, 주요 결정 사항을 명확히 기록하세요.", "📐"),
      hr(),
      h3("메타 정보 Meta"),
      bullet(
        "작성자: 박준호 (백엔드 엔지니어)",
        "작성일: 2026-04-02",
        "상태: Draft → Review → Approved",
        "리뷰어: 김민수, 최수진",
        "관련 PRD: 결제 시스템 PRD v1.2"
      ),
      hr(),
      h3("개요 Overview"),
      p("본 문서는 Stripe 기반 결제 시스템의 서버 아키텍처를 설계합니다. 정기 구독(subscription)과 일회성 결제(one-time payment)를 모두 지원하며, PCI DSS 규정을 준수합니다."),
      hr(),
      h3("배경 및 동기 Background"),
      p("현재 무료 플랜만 제공 중이며, 유료 전환율 목표 15%를 달성하기 위해 Pro/Enterprise 플랜을 도입합니다. 월간 결제와 연간 결제를 모두 지원해야 합니다."),
      hr(),
      h3("목표 Goals"),
      bullet(
        "Stripe Checkout Session을 통한 안전한 결제 처리",
        "웹훅 기반 실시간 결제 상태 동기화",
        "구독 관리(업그레이드, 다운그레이드, 취소) 지원",
        "결제 실패 시 자동 재시도 및 알림"
      ),
      h3("비목표 Non-Goals"),
      bullet(
        "암호화폐 결제 지원 (향후 검토)",
        "다국가 세금 계산 자동화 (v2에서 대응)"
      ),
      hr(),
      h3("시스템 아키텍처 Architecture"),
      p("Client → Next.js API Route → Stripe SDK → Stripe API"),
      p("Stripe Webhook → /api/webhooks/stripe → DB 업데이트 → 이메일 알림"),
      bullet(
        "Next.js API Routes: 결제 세션 생성, 구독 관리",
        "Stripe Webhook Handler: checkout.session.completed, invoice.payment_failed 등 이벤트 처리",
        "PostgreSQL: subscriptions, payments, invoices 테이블",
        "Redis: 결제 상태 캐싱 및 중복 요청 방지(idempotency key)"
      ),
      hr(),
      h3("데이터 모델 Data Model"),
      p("subscriptions 테이블: id, userId, stripeSubscriptionId, plan, status, currentPeriodEnd"),
      p("payments 테이블: id, userId, stripePaymentIntentId, amount, currency, status, createdAt"),
      hr(),
      h3("API 설계 API Design"),
      bullet(
        "POST /api/checkout — 결제 세션 생성",
        "POST /api/webhooks/stripe — Stripe 이벤트 수신",
        "GET /api/subscription — 현재 구독 상태 조회",
        "POST /api/subscription/cancel — 구독 취소"
      ),
      hr(),
      h3("보안 고려사항 Security"),
      bullet(
        "Stripe 웹훅 서명 검증(whsec_xxx) 필수",
        "카드 정보는 서버에 절대 저장하지 않음 (Stripe Elements 사용)",
        "CSRF 토큰 + rate limiting 적용"
      ),
      hr(),
      h3("대안 검토 Alternatives Considered"),
      bullet(
        "Paddle: 세금 처리 장점이 있으나 한국 정산 지원 미비",
        "자체 PG 연동: PCI DSS 인증 비용 과다 (연 $50K+)"
      ),
      hr(),
      h3("마일스톤 Milestones"),
      tasks(
        "Phase 1: Stripe 연동 기본 설정 및 Checkout (1주)",
        "Phase 2: 웹훅 핸들러 및 구독 관리 (1주)",
        "Phase 3: 결제 대시보드 UI (1주)",
        "Phase 4: QA 및 프로덕션 배포 (3일)"
      ),
    ],
  },

  // 3. PRD (Product Requirements Document)
  {
    name: "PRD",
    description: "제품 요구사항 정의서입니다. 기능의 목적, 사용자 스토리, 성공 지표를 정의합니다.",
    category: "DOCUMENTS",
    icon: "📋",
    content: [
      h2("PRD — Product Requirements Document"),
      callout("PRD는 '왜 이 기능을 만드는가'에 초점을 맞추세요. 기술적 구현 방법은 설계 문서에 기록합니다.", "📋"),
      hr(),
      h3("문서 정보 Document Info"),
      bullet(
        "제품명: TaskFlow 프로젝트 관리 도구",
        "기능명: 실시간 협업 편집 (Real-time Collaboration)",
        "작성자: 김민수 (Product Manager)",
        "버전: v1.0 | 작성일: 2026-04-02",
        "상태: 검토 중 (Under Review)"
      ),
      hr(),
      h3("문제 정의 Problem Statement"),
      p("현재 사용자들은 동일 문서를 동시에 편집할 수 없어 '마지막 저장 우선(Last Write Wins)' 방식으로 데이터 손실이 발생합니다. 월평균 120건의 CS 문의가 이 문제와 관련되어 있습니다."),
      hr(),
      h3("목표 Objectives"),
      bullet(
        "동시 편집 시 데이터 충돌 0건 달성",
        "문서 편집 관련 CS 문의 80% 감소",
        "사용자 체류 시간 25% 증가"
      ),
      hr(),
      h3("사용자 스토리 User Stories"),
      numbered(
        "팀 리더로서, 회의 중 팀원들과 동시에 회의록을 작성하고 싶다 — 모두가 실시간으로 기여할 수 있도록",
        "디자이너로서, 동료가 편집 중인 섹션을 확인하고 싶다 — 같은 부분을 동시에 수정하는 충돌을 피하기 위해",
        "원격 근무자로서, 오프라인에서 편집한 내용이 온라인 복귀 시 자동 동기화되길 원한다"
      ),
      hr(),
      h3("기능 요구사항 Functional Requirements"),
      h3("P0 — Must Have"),
      tasks(
        "동시 편집: 최대 10명이 동일 문서를 실시간 편집",
        "커서 표시: 다른 사용자의 커서 위치와 이름 표시",
        "충돌 해결: CRDT 기반 자동 충돌 병합"
      ),
      h3("P1 — Should Have"),
      tasks(
        "편집 히스토리: 30일간 버전 기록 보존",
        "댓글 기능: 특정 텍스트에 인라인 댓글",
        "알림: 멘션(@) 시 실시간 알림"
      ),
      h3("P2 — Nice to Have"),
      tasks(
        "오프라인 모드: 로컬 저장 후 온라인 복귀 시 자동 동기화",
        "음성 커서: 편집 중 음성 채팅 연동"
      ),
      hr(),
      h3("성공 지표 Success Metrics"),
      bullet(
        "KPI 1: 동시 편집 세션 수 — 출시 후 30일 내 월 5,000회 이상",
        "KPI 2: 편집 충돌 CS 문의 — 월 120건 → 25건 이하",
        "KPI 3: 문서 편집 체류 시간 — 평균 8분 → 10분 이상"
      ),
      hr(),
      h3("범위 밖 Out of Scope"),
      bullet(
        "스프레드시트 실시간 편집 (별도 프로젝트)",
        "외부 사용자(게스트) 협업 (v2 예정)"
      ),
      hr(),
      h3("타임라인 Timeline"),
      bullet(
        "설계 리뷰: 2026-04-14",
        "개발 시작: 2026-04-21",
        "알파 테스트: 2026-05-19",
        "베타 출시: 2026-06-02",
        "GA 출시: 2026-06-16"
      ),
      hr(),
      h3("리스크 Risks"),
      bullet(
        "WebSocket 서버 스케일링 비용 증가 가능 — 로드 테스트로 사전 검증",
        "CRDT 라이브러리(Yjs) 버전 호환성 이슈 — 고정 버전 사용"
      ),
    ],
  },

  // 4. 기술 스펙 (Technical Spec)
  {
    name: "기술 스펙",
    description: "기능 구현의 기술적 세부사항을 명세하는 문서입니다. 구현 방법, 인터페이스, 테스트 계획을 포함합니다.",
    category: "DOCUMENTS",
    icon: "⚙️",
    content: [
      h2("기술 스펙 — Technical Specification"),
      callout("기술 스펙은 구현자가 이 문서만 보고 개발할 수 있을 정도로 구체적이어야 합니다.", "⚙️"),
      hr(),
      h3("문서 정보 Document Info"),
      bullet(
        "기능: 실시간 알림 시스템 (Real-time Notification System)",
        "작성자: 최수진 (프론트엔드 엔지니어)",
        "리뷰어: 박준호, 김민수",
        "작성일: 2026-04-02 | 상태: Approved"
      ),
      hr(),
      h3("기술 요약 Technical Summary"),
      p("Server-Sent Events(SSE)를 기반으로 실시간 알림을 전달합니다. WebSocket 대비 서버 리소스 사용량이 적고, HTTP/2 환경에서 다중 스트림을 효율적으로 처리할 수 있습니다."),
      hr(),
      h3("기술 스택 Tech Stack"),
      bullet(
        "프론트엔드: React 19 + EventSource API + Zustand (알림 상태 관리)",
        "백엔드: Next.js API Route (SSE endpoint)",
        "데이터베이스: PostgreSQL (notifications 테이블) + Redis Pub/Sub (멀티 인스턴스 브로드캐스트)",
        "인프라: Vercel Edge Functions + Upstash Redis"
      ),
      hr(),
      h3("인터페이스 설계 Interface Design"),
      p("GET /api/notifications/stream — SSE 엔드포인트"),
      bullet(
        "Headers: Accept: text/event-stream, Authorization: Bearer {token}",
        "Response: event: notification, data: {id, type, title, body, createdAt}",
        "Heartbeat: 30초마다 event: ping 전송 (연결 유지)"
      ),
      p("POST /api/notifications/read — 읽음 처리"),
      bullet(
        "Body: { notificationIds: string[] }",
        "Response: { updatedCount: number }"
      ),
      hr(),
      h3("데이터 모델 Data Model"),
      p("notifications 테이블:"),
      bullet(
        "id: UUID (PK)",
        "userId: UUID (FK → users.id, INDEX)",
        "type: ENUM('mention', 'comment', 'assign', 'deadline', 'system')",
        "title: VARCHAR(200)",
        "body: TEXT",
        "isRead: BOOLEAN DEFAULT false",
        "metadata: JSONB (유연한 추가 데이터)",
        "createdAt: TIMESTAMP WITH TIME ZONE"
      ),
      hr(),
      h3("구현 상세 Implementation Details"),
      numbered(
        "SSE 연결: 클라이언트가 페이지 로드 시 EventSource로 연결, 토큰 인증",
        "알림 발행: 비즈니스 로직에서 Redis Pub/Sub로 알림 이벤트 발행",
        "브로드캐스트: SSE 핸들러가 Redis 구독 → 해당 userId의 연결에 push",
        "재연결: EventSource 자동 재연결 + 마지막 수신 ID(Last-Event-ID) 기반 누락 알림 복구",
        "정리: 30일 이상 된 읽은 알림은 배치로 soft-delete"
      ),
      hr(),
      h3("에러 처리 Error Handling"),
      bullet(
        "SSE 연결 실패 시 지수 백오프(exponential backoff)로 재연결 (최대 5회, 최대 대기 30초)",
        "Redis 연결 실패 시 폴링 폴백(30초 간격 GET /api/notifications)",
        "알림 발행 실패 시 Dead Letter Queue에 저장 후 재시도"
      ),
      hr(),
      h3("성능 요구사항 Performance"),
      bullet(
        "알림 전달 지연: < 500ms (발행 → 수신)",
        "동시 SSE 연결: 서버 인스턴스당 최대 10,000",
        "알림 조회 응답 시간: < 100ms (최근 50건)"
      ),
      hr(),
      h3("테스트 계획 Test Plan"),
      tasks(
        "단위 테스트: 알림 생성, 읽음 처리, SSE 직렬화",
        "통합 테스트: Redis Pub/Sub → SSE 전달 E2E",
        "부하 테스트: k6로 5,000 동시 SSE 연결 시 메모리/CPU 모니터링",
        "장애 테스트: Redis 다운 시 폴링 폴백 동작 확인"
      ),
    ],
  },

  // 5. 의사결정 기록 ADR (Architecture Decision Record)
  {
    name: "의사결정 기록 (ADR)",
    description: "중요한 아키텍처 및 기술 결정의 맥락, 선택지, 근거를 기록하는 템플릿입니다.",
    category: "DOCUMENTS",
    icon: "⚖️",
    content: [
      h2("ADR — Architecture Decision Record"),
      callout("ADR은 '왜 이 결정을 했는가'를 미래의 팀원이 이해할 수 있도록 기록하는 것이 핵심입니다. 결정이 번복되더라도 기존 ADR은 삭제하지 말고 상태를 'Superseded'로 변경하세요.", "⚖️"),
      hr(),
      h3("ADR-007: 상태 관리 라이브러리 선택"),
      bullet(
        "상태: Accepted",
        "작성자: 최수진",
        "작성일: 2026-04-02",
        "관련 ADR: ADR-003 (프론트엔드 프레임워크 선택: React)"
      ),
      hr(),
      h3("맥락 Context"),
      p("프론트엔드 애플리케이션이 복잡해지면서 전역 상태 관리가 필요해졌습니다. 현재 React Context + useState로 관리 중이나, 리렌더링 성능 이슈와 상태 로직 분산 문제가 발생하고 있습니다."),
      bullet(
        "대시보드 페이지에서 불필요한 리렌더링으로 FPS 15까지 저하",
        "7개의 Context Provider가 중첩되어 디버깅 난이도 증가",
        "비동기 상태(서버 데이터)와 클라이언트 상태 혼재"
      ),
      hr(),
      h3("결정 Decision"),
      p("Zustand를 클라이언트 상태 관리에, TanStack Query(React Query)를 서버 상태 관리에 채택합니다."),
      hr(),
      h3("선택지 Options Considered"),
      h3("Option A: Redux Toolkit"),
      bullet(
        "장점: 대규모 팀에 검증된 패턴, 강력한 DevTools, 풍부한 미들웨어 생태계",
        "단점: 보일러플레이트 많음, 러닝 커브 높음, 번들 사이즈 +12KB (gzip)"
      ),
      h3("Option B: Zustand + TanStack Query (선택됨)"),
      bullet(
        "장점: 최소 보일러플레이트, 번들 사이즈 +2KB, 서버/클라이언트 상태 명확 분리, TypeScript 친화적",
        "단점: 대규모 상태에서 구조화 패턴 부재 — 스토어 분리 컨벤션으로 해결 가능"
      ),
      h3("Option C: Jotai"),
      bullet(
        "장점: 원자(atom) 단위 상태 관리로 세밀한 리렌더링 제어",
        "단점: atom이 많아지면 의존성 추적이 복잡, 팀 내 경험 없음"
      ),
      hr(),
      h3("근거 Rationale"),
      numbered(
        "Zustand는 팀원 3/4명이 이미 사용 경험이 있어 온보딩 비용이 가장 낮음",
        "서버 상태(API 캐싱, 낙관적 업데이트)는 TanStack Query가 전문적으로 처리하여 역할 분리가 명확함",
        "번들 사이즈가 가장 작아 Core Web Vitals 영향 최소화",
        "점진적 마이그레이션 가능 — Context를 하나씩 Zustand 스토어로 전환"
      ),
      hr(),
      h3("결과 Consequences"),
      bullet(
        "긍정적: 대시보드 리렌더링 70% 감소 예상, 코드 라인 수 30% 감소",
        "부정적: Redux DevTools 대비 디버깅 도구 기능이 제한적",
        "위험: TanStack Query 캐시 무효화(invalidation) 전략 실수 시 stale data 표시 가능"
      ),
      hr(),
      h3("마이그레이션 계획 Migration Plan"),
      tasks(
        "Phase 1: 인증 상태(auth store)를 Zustand로 이전 — 1일",
        "Phase 2: 대시보드 API 호출을 TanStack Query로 전환 — 3일",
        "Phase 3: 나머지 Context 점진적 이전 — 1주",
        "Phase 4: 기존 Context Provider 제거 및 정리 — 1일"
      ),
    ],
  },

  // 6. 런북 (Runbook)
  {
    name: "런북",
    description: "시스템 운영, 장애 대응, 배포 절차 등을 단계별로 기록하는 운영 매뉴얼입니다.",
    category: "DOCUMENTS",
    icon: "🔧",
    content: [
      h2("런북 — Runbook"),
      callout("런북은 새벽 3시에 장애 대응하는 온콜 엔지니어가 따라할 수 있도록 명확하고 구체적으로 작성하세요. 가정하지 말고 모든 단계를 기술하세요.", "🔧"),
      hr(),
      h3("런북 정보 Runbook Info"),
      bullet(
        "런북명: 데이터베이스 연결 풀 고갈 대응",
        "심각도: P1 (Critical)",
        "최종 업데이트: 2026-04-02",
        "담당팀: SRE팀 / 백엔드팀",
        "예상 소요 시간: 15–30분"
      ),
      hr(),
      h3("증상 Symptoms"),
      bullet(
        "애플리케이션 로그에 'Connection pool exhausted' 에러 다수 발생",
        "API 응답 시간 5초 이상으로 증가 (정상: < 200ms)",
        "Grafana 대시보드에서 DB 연결 수가 max_connections(100)에 도달",
        "사용자에게 500 Internal Server Error 표시"
      ),
      hr(),
      h3("영향 범위 Impact"),
      p("전체 서비스 장애. 모든 API 요청이 실패하며, 프론트엔드에 에러 페이지 표시됨."),
      hr(),
      h3("사전 조건 Prerequisites"),
      bullet(
        "AWS 콘솔 접근 권한 (Production 계정)",
        "kubectl 설정 완료 (production cluster context)",
        "PagerDuty 알림 확인 및 인시던트 생성"
      ),
      hr(),
      h3("대응 절차 Steps"),
      numbered(
        "즉시 상태 확인: kubectl exec -it postgres-0 -- psql -c \"SELECT count(*) FROM pg_stat_activity;\"",
        "유휴 연결 강제 종료: psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < NOW() - INTERVAL '5 minutes';\"",
        "연결 풀 설정 확인: 애플리케이션의 DATABASE_POOL_SIZE 환경 변수 확인 (기본값: 20)",
        "Pod 재시작 (필요 시): kubectl rollout restart deployment/api-server -n production",
        "연결 수 모니터링: Grafana → DB Connections 패널에서 연결 수가 정상 범위(20–40)로 복귀하는지 확인",
        "슬로우 쿼리 확인: psql -c \"SELECT pid, now()-query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;\"",
        "장시간 실행 쿼리 종료 (5분 초과): psql -c \"SELECT pg_cancel_backend(pid);\" — 해당 pid 지정"
      ),
      hr(),
      h3("확인 사항 Verification"),
      tasks(
        "API 응답 시간이 200ms 이하로 복귀",
        "DB 연결 수가 정상 범위(20–40)로 안정화",
        "에러 로그 발생이 중단됨",
        "Statuspage 업데이트 완료"
      ),
      hr(),
      h3("에스컬레이션 Escalation"),
      bullet(
        "15분 내 해결 안 될 경우: 백엔드 테크리드 (박준호) 호출",
        "30분 내 해결 안 될 경우: CTO 보고 및 사용자 공지 발송",
        "연락처: #incident-response 슬랙 채널"
      ),
      hr(),
      h3("근본 원인 분석 Root Cause (사후 작성)"),
      p("장애 해결 후 이 섹션에 근본 원인을 기록하세요. 포스트모템 문서와 연결합니다."),
      bullet(
        "원인: (작성 필요)",
        "재발 방지 조치: (작성 필요)",
        "관련 포스트모템: (링크 추가)"
      ),
    ],
  },

  // 7. 릴리스 노트 (Release Notes)
  {
    name: "릴리스 노트",
    description: "새 버전 출시 시 변경 사항, 신규 기능, 버그 수정, 마이그레이션 가이드를 정리하는 템플릿입니다.",
    category: "DOCUMENTS",
    icon: "🚀",
    content: [
      h2("릴리스 노트 — Release Notes"),
      callout("릴리스 노트는 사용자와 개발자 모두가 읽습니다. 사용자 관점의 변경 사항을 먼저 작성하고, 기술적 세부사항은 아래에 추가하세요.", "🚀"),
      hr(),
      h3("릴리스 정보 Release Info"),
      bullet(
        "버전: v2.4.0",
        "릴리스일: 2026-04-02",
        "코드네임: Aurora",
        "Git Tag: v2.4.0",
        "이전 버전: v2.3.2"
      ),
      hr(),
      h3("하이라이트 Highlights"),
      p("실시간 협업 편집 기능이 추가되었습니다! 최대 10명이 동시에 문서를 편집할 수 있으며, 다른 사용자의 커서 위치가 실시간으로 표시됩니다."),
      hr(),
      h3("신규 기능 New Features"),
      bullet(
        "실시간 협업 편집: 동일 문서를 최대 10명이 동시 편집 가능 (#1234)",
        "멀티 커서 표시: 편집 중인 사용자의 커서와 이름이 실시간으로 보임 (#1235)",
        "인라인 댓글: 텍스트를 선택하고 댓글을 남길 수 있는 기능 추가 (#1180)",
        "키보드 단축키 가이드: Ctrl+/ 로 단축키 목록 표시 (#1201)"
      ),
      hr(),
      h3("개선 사항 Improvements"),
      bullet(
        "대시보드 로딩 속도 40% 개선 — React.lazy + 코드 스플리팅 적용 (#1210)",
        "검색 결과 정확도 향상 — 한국어 형태소 분석 Nori 플러그인 도입 (#1195)",
        "다크 모드에서 코드 블록 가독성 개선 (#1222)"
      ),
      hr(),
      h3("버그 수정 Bug Fixes"),
      bullet(
        "Safari에서 드래그 앤 드롭이 동작하지 않던 문제 수정 (#1198)",
        "긴 제목이 사이드바에서 잘리지 않고 레이아웃을 깨뜨리던 문제 수정 (#1205)",
        "비밀번호 재설정 이메일이 간헐적으로 발송되지 않던 문제 수정 (#1211)",
        "모바일에서 테이블이 가로 스크롤되지 않던 문제 수정 (#1215)"
      ),
      hr(),
      h3("Breaking Changes"),
      callout("이 릴리스에는 API 변경 사항이 있습니다. 아래 마이그레이션 가이드를 반드시 확인하세요.", "⚠️"),
      bullet(
        "API 응답 형식 변경: /api/documents 의 응답에서 data 래핑 추가 — { data: [...], meta: { total, page } }",
        "환경 변수명 변경: NEXT_PUBLIC_WS_URL → NEXT_PUBLIC_REALTIME_URL"
      ),
      hr(),
      h3("마이그레이션 가이드 Migration Guide"),
      numbered(
        "환경 변수 업데이트: .env에서 NEXT_PUBLIC_WS_URL을 NEXT_PUBLIC_REALTIME_URL로 변경",
        "API 응답 처리 변경: response.data 대신 response.data.data로 접근",
        "데이터베이스 마이그레이션: npx prisma migrate deploy 실행 (새 테이블 2개 추가)",
        "캐시 무효화: Redis FLUSHDB 또는 배포 후 자동 무효화 대기 (5분)"
      ),
      hr(),
      h3("알려진 이슈 Known Issues"),
      bullet(
        "Firefox에서 실시간 커서가 0.5초 지연되는 현상 — v2.4.1에서 수정 예정",
        "10명 초과 시 연결 끊김 — 현재 10명 제한 유지, v2.5.0에서 확장 예정"
      ),
      hr(),
      h3("기여자 Contributors"),
      p("박준호, 최수진, 이지은, 김민수, 정다영 — 감사합니다! 🎉"),
    ],
  },

  // 8. 리서치 노트 (Research Notes)
  {
    name: "리서치 노트",
    description: "기술 조사, 사용자 리서치, 경쟁사 분석 등 조사 결과를 정리하는 템플릿입니다.",
    category: "DOCUMENTS",
    icon: "🔬",
    content: [
      h2("리서치 노트 — Research Notes"),
      callout("리서치 노트는 조사 과정과 결과를 모두 기록하세요. 나중에 '왜 이 결론에 도달했는지' 추적할 수 있어야 합니다.", "🔬"),
      hr(),
      h3("리서치 개요 Overview"),
      bullet(
        "주제: Next.js vs Remix — 프레임워크 마이그레이션 타당성 조사",
        "조사자: 최수진 (프론트엔드 엔지니어)",
        "기간: 2026-03-25 ~ 2026-04-02",
        "목적: 현재 Next.js 13 기반 프로젝트를 최신 프레임워크로 업그레이드/마이그레이션할지 결정"
      ),
      hr(),
      h3("배경 Background"),
      p("현재 Next.js 13 (Pages Router)를 사용 중이며, App Router 전환 또는 Remix 마이그레이션을 검토합니다. 주요 고려 사항은 서버 컴포넌트 지원, 데이터 페칭 패턴, 배포 유연성입니다."),
      hr(),
      h3("조사 방법 Methodology"),
      bullet(
        "공식 문서 및 GitHub 이슈 분석",
        "PoC(Proof of Concept) 구현: 동일 기능을 Next.js App Router, Remix로 각각 구현",
        "커뮤니티 사례 조사: Reddit, X(Twitter), 기술 블로그 50개+ 리뷰",
        "번들 사이즈 및 성능 벤치마크 (Lighthouse, Web Vitals)"
      ),
      hr(),
      h3("조사 결과 Findings"),
      h3("Next.js 15 (App Router)"),
      bullet(
        "서버 컴포넌트 기본 지원 — 클라이언트 번들 30% 감소",
        "Turbopack 안정화 — 개발 서버 HMR 속도 4배 향상",
        "캐싱 전략이 복잡함 — fetch cache, Data Cache, Full Route Cache 등 레이어가 많음",
        "Vercel 종속성 우려 — 셀프 호스팅 시 일부 기능 제약 (ISR, Image Optimization)"
      ),
      h3("Remix v3"),
      bullet(
        "중첩 라우팅(Nested Routes) + 로더(Loader) 패턴으로 데이터 페칭 직관적",
        "프레임워크 불가지론적(agnostic) — Cloudflare Workers, Deno, Node.js 어디서든 배포",
        "서버 컴포넌트 미지원 — 전통적인 SSR 모델 유지",
        "생태계 크기: npm 주간 다운로드 Next.js 대비 1/15 수준"
      ),
      hr(),
      h3("벤치마크 결과 Benchmark"),
      bullet(
        "초기 로드 (LCP): Next.js App Router 1.2s / Remix 1.4s",
        "페이지 전환 (FCP): Next.js 0.3s / Remix 0.5s",
        "빌드 시간: Next.js 45s (Turbopack) / Remix 38s",
        "번들 사이즈 (gzip): Next.js 87KB / Remix 65KB"
      ),
      hr(),
      h3("핵심 인사이트 Key Insights"),
      numbered(
        "Next.js App Router가 성능에서 우위이나, 캐싱 복잡도가 팀 생산성을 저하시킬 수 있음",
        "Remix는 웹 표준(Web Fetch API)에 더 가까워 학습 커브가 낮지만, 서버 컴포넌트 미지원이 장기적 단점",
        "현재 프로젝트 규모(50개 페이지)에서는 Next.js Pages → App Router 점진적 전환이 가장 리스크가 낮음"
      ),
      hr(),
      h3("결론 및 권장사항 Conclusion"),
      quote("Next.js App Router로 점진적 마이그레이션을 권장합니다. 프레임워크 전환(Remix)은 현 시점에서 비용 대비 효과가 낮습니다."),
      bullet(
        "1단계: 신규 페이지를 App Router로 작성 (2주)",
        "2단계: 핵심 페이지 10개를 App Router로 전환 (4주)",
        "3단계: 나머지 페이지 전환 및 Pages Router 제거 (4주)"
      ),
      hr(),
      h3("참고 자료 References"),
      bullet(
        "Next.js 공식 문서: https://nextjs.org/docs",
        "Remix 공식 문서: https://remix.run/docs",
        "Vercel vs Self-hosting 비교: https://example.com/nextjs-hosting-comparison",
        "팀 PoC 저장소: https://github.com/team/framework-poc"
      ),
      hr(),
      h3("후속 작업 Follow-up"),
      tasks(
        "App Router 마이그레이션 설계 문서 작성",
        "팀 기술 공유 세션 진행 (App Router 핵심 개념)",
        "마이그레이션 일정 스프린트 반영"
      ),
    ],
  },

  // 9. SOP (Standard Operating Procedure)
  {
    name: "SOP",
    description: "표준 운영 절차서입니다. 반복 업무의 일관된 수행을 위한 단계별 가이드를 제공합니다.",
    category: "DOCUMENTS",
    icon: "📑",
    content: [
      h2("SOP — Standard Operating Procedure"),
      callout("SOP는 해당 업무를 처음 수행하는 사람도 따라할 수 있어야 합니다. 모든 단계를 빠짐없이 기록하고, 스크린샷이나 예시를 첨부하세요.", "📑"),
      hr(),
      h3("문서 정보 Document Info"),
      bullet(
        "SOP 제목: 프로덕션 배포 절차 (Production Deployment Process)",
        "문서 번호: SOP-DEV-003",
        "버전: v2.1",
        "최종 업데이트: 2026-04-02",
        "승인자: CTO 이정훈",
        "대상: 백엔드 엔지니어, SRE 엔지니어"
      ),
      hr(),
      h3("목적 Purpose"),
      p("프로덕션 환경에 코드를 안전하게 배포하기 위한 표준 절차를 정의합니다. 이 절차를 준수하여 배포 장애를 예방하고, 문제 발생 시 신속한 롤백을 보장합니다."),
      hr(),
      h3("적용 범위 Scope"),
      bullet(
        "대상 서비스: API 서버, 웹 프론트엔드, 워커 서비스",
        "배포 환경: AWS EKS (Kubernetes)",
        "배포 주기: 매주 화요일, 목요일 14:00 (긴급 핫픽스 제외)"
      ),
      hr(),
      h3("사전 조건 Prerequisites"),
      tasks(
        "배포할 PR이 main 브랜치에 머지 완료",
        "CI/CD 파이프라인(GitHub Actions)이 모두 통과 (green)",
        "QA팀의 배포 승인 확인 (Jira 티켓 상태: Ready for Deploy)",
        "배포 공지를 #deploy-notice 슬랙 채널에 게시"
      ),
      hr(),
      h3("절차 Procedure"),
      h3("Step 1: 배포 전 확인"),
      numbered(
        "GitHub Actions에서 최신 빌드 상태 확인 — 모든 체크가 통과인지 확인",
        "스테이징 환경에서 최종 스모크 테스트 수행 (로그인, 핵심 기능 3개 확인)",
        "데이터베이스 마이그레이션 유무 확인 — 마이그레이션이 있다면 Step 2A 진행"
      ),
      h3("Step 2: 배포 실행"),
      numbered(
        "ArgoCD 대시보드 접속 → 해당 서비스 선택 → Sync 버튼 클릭",
        "롤링 업데이트 진행 상태 모니터링: kubectl rollout status deployment/api-server -n production",
        "새 Pod가 모두 Ready 상태인지 확인: kubectl get pods -n production -l app=api-server"
      ),
      h3("Step 2A: DB 마이그레이션 (해당 시)"),
      numbered(
        "마이그레이션 잡 실행: kubectl apply -f k8s/migration-job.yaml",
        "잡 완료 확인: kubectl wait --for=condition=complete job/db-migrate -n production --timeout=300s",
        "마이그레이션 결과 검증: 테이블 스키마 변경 사항 확인"
      ),
      hr(),
      h3("Step 3: 배포 후 확인"),
      tasks(
        "헬스체크 엔드포인트 확인: curl https://api.example.com/health",
        "핵심 API 3개 정상 동작 확인 (로그인, 문서 조회, 문서 생성)",
        "Grafana 대시보드에서 에러율 확인 — 0.1% 이하 유지",
        "Sentry에서 새로운 에러 발생 여부 확인",
        "배포 완료를 #deploy-notice에 게시"
      ),
      hr(),
      h3("롤백 절차 Rollback"),
      p("배포 후 문제가 발생하면 즉시 롤백합니다:"),
      numbered(
        "ArgoCD에서 이전 버전으로 Rollback 실행",
        "또는 CLI: kubectl rollout undo deployment/api-server -n production",
        "롤백 후 헬스체크 및 핵심 API 재확인",
        "인시던트 채널에 롤백 사유 공유"
      ),
      hr(),
      h3("비상 연락처 Emergency Contacts"),
      bullet(
        "배포 담당: 박준호 (010-1234-5678)",
        "SRE 온콜: PagerDuty 통해 자동 연결",
        "CTO: 이정훈 (심각 장애 시만 연락)"
      ),
    ],
  },

  // 10. 포스트모템 (Postmortem)
  {
    name: "포스트모템",
    description: "장애 발생 후 원인 분석, 타임라인, 재발 방지 대책을 기록하는 사후 분석 보고서입니다.",
    category: "DOCUMENTS",
    icon: "🔍",
    content: [
      h2("포스트모템 — Postmortem Report"),
      callout("포스트모템은 비난(blame)이 아닌 학습(learning)을 위한 문서입니다. 개인을 지목하지 말고, 시스템과 프로세스의 개선점에 집중하세요.", "🔍"),
      hr(),
      h3("인시던트 개요 Incident Summary"),
      bullet(
        "인시던트 ID: INC-2026-042",
        "제목: 결제 API 전체 장애 (Payment API Total Outage)",
        "심각도: P1 (Critical) — 매출 직접 영향",
        "발생 시간: 2026-03-28 09:15 KST",
        "복구 시간: 2026-03-28 10:42 KST",
        "총 장애 시간: 1시간 27분",
        "영향 범위: 전체 결제 기능 불가, 약 2,300명 영향"
      ),
      hr(),
      h3("영향 Impact"),
      bullet(
        "실패한 결제 시도: 847건",
        "추정 매출 손실: ₩12,500,000",
        "CS 문의 접수: 156건",
        "SLA 위반: 99.9% → 99.7% (월간)"
      ),
      hr(),
      h3("타임라인 Timeline"),
      bullet(
        "09:15 — Stripe 웹훅 처리 서버에서 OOM(Out of Memory) 발생, Pod 재시작 시작",
        "09:18 — PagerDuty 알림 발생, 온콜 엔지니어(박준호) 확인",
        "09:22 — 결제 실패율 100% 확인, 인시던트 선언",
        "09:30 — 원인 조사 시작: 메모리 사용량 급증 원인 분석",
        "09:45 — 원인 파악: 전날 배포된 코드에서 Stripe 이벤트 로그를 메모리에 무한 축적하는 버그 발견",
        "10:00 — 핫픽스 PR 작성 및 코드 리뷰",
        "10:20 — 핫픽스 스테이징 배포 및 테스트 완료",
        "10:35 — 프로덕션 핫픽스 배포",
        "10:42 — 결제 기능 정상 복구 확인, 인시던트 종료"
      ),
      hr(),
      h3("근본 원인 Root Cause"),
      p("2026-03-27 배포된 PR #1456에서 Stripe 웹훅 이벤트를 디버깅 목적으로 인메모리 배열에 저장하는 코드가 포함되었습니다. 이 배열은 서버 재시작 전까지 계속 증가하여, 야간 동안 축적된 약 50만 건의 이벤트로 Pod 메모리(512MB)가 고갈되었습니다."),
      p("문제 코드:"),
      p("const eventLog: StripeEvent[] = []; // 모듈 스코프 — 서버 생존 기간 동안 계속 증가"),
      hr(),
      h3("발견 및 해결 Detection & Resolution"),
      bullet(
        "발견: PagerDuty 알림 (메모리 사용률 > 90% 임계값)",
        "해결: 인메모리 이벤트 로그 제거, 디버깅 로그는 CloudWatch로 전환"
      ),
      hr(),
      h3("잘한 점 What Went Well"),
      bullet(
        "PagerDuty 알림이 3분 이내 도착하여 빠른 인지 가능",
        "온콜 엔지니어가 15분 내 원인 파악",
        "핫픽스 배포까지 전체 팀 협력이 원활했음"
      ),
      hr(),
      h3("개선할 점 What Could Be Improved"),
      bullet(
        "디버깅용 코드가 코드 리뷰에서 발견되지 않음",
        "메모리 사용량 모니터링 임계값이 90%로 높아 늦게 알림됨",
        "스테이징에서 장시간 부하 테스트를 수행하지 않아 메모리 릭이 사전에 발견되지 않음"
      ),
      hr(),
      h3("재발 방지 대책 Action Items"),
      tasks(
        "[P0] ESLint 규칙 추가: 모듈 스코프 가변 배열 선언 경고 — 박준호, 4/5까지",
        "[P0] 메모리 알림 임계값 80%로 하향 조정 — SRE팀, 4/3까지",
        "[P1] 스테이징 환경에 장시간(24h) 부하 테스트 자동화 — SRE팀, 4/12까지",
        "[P1] 코드 리뷰 체크리스트에 '디버깅용 코드 잔존 여부' 항목 추가 — 김민수, 4/5까지",
        "[P2] Pod 메모리 제한 512MB → 1GB 상향 검토 — SRE팀, 4/10까지"
      ),
      hr(),
      h3("교훈 Lessons Learned"),
      quote("디버깅용 코드는 반드시 제거하거나, 환경 변수로 분기 처리해야 한다. 프로덕션 코드에 개발용 로직이 절대 포함되어서는 안 된다."),
    ],
  },

  // ============================================================
  // PERSONAL (10)
  // ============================================================

  // 11. 할 일 목록 (To-Do List)
  {
    name: "할 일 목록",
    description: "우선순위별로 할 일을 관리하는 심플하면서도 효과적인 투두 리스트입니다.",
    category: "PERSONAL",
    icon: "✅",
    content: [
      h2("할 일 목록 — To-Do List"),
      callout("매일 아침 3가지 핵심 할 일(Most Important Tasks)을 먼저 정하세요. 나머지는 여유가 있을 때 처리합니다. 완료하면 체크하고, 매주 금요일에 리뷰하세요.", "✅"),
      hr(),
      h3("오늘의 핵심 MIT (Most Important Tasks)"),
      p("가장 중요한 3가지를 먼저 끝내세요."),
      tasks(
        "프로젝트 제안서 최종본 제출 (오후 2시 마감)",
        "팀 스프린트 리뷰 미팅 준비 자료 작성",
        "고객 피드백 분석 보고서 정리"
      ),
      hr(),
      h3("🔴 긴급 + 중요 (Do First)"),
      tasks(
        "서버 보안 패치 적용 — CVE-2026-1234 대응",
        "결제 오류 고객 3명에게 개별 연락",
        "내일 프레젠테이션 슬라이드 최종 검토"
      ),
      hr(),
      h3("🟡 중요하지만 긴급하지 않음 (Schedule)"),
      tasks(
        "분기별 OKR 중간 점검 문서 작성 — 4/7까지",
        "신규 인턴 온보딩 자료 업데이트 — 4/10까지",
        "기술 블로그 포스트 초안 완성 — 4/14까지",
        "AWS 비용 최적화 리뷰 — 4/15까지"
      ),
      hr(),
      h3("🟢 긴급하지만 중요하지 않음 (Delegate)"),
      tasks(
        "회의실 예약 시스템 오류 → 관리팀에 전달",
        "디자인 에셋 정리 → 인턴에게 위임",
        "슬랙 채널 알림 설정 정리"
      ),
      hr(),
      h3("⚪ 나중에 (Someday / Maybe)"),
      bullet(
        "TypeScript 5.5 새 기능 학습",
        "사이드 프로젝트 아이디어 정리",
        "컨퍼런스 발표 제안서 작성",
        "홈 오피스 모니터 암 교체"
      ),
      hr(),
      h3("완료 Done ✨"),
      p("완료한 항목을 여기로 이동하면 성취감을 느낄 수 있습니다."),
      bullet(
        "✅ 3/31 — CI/CD 파이프라인 GitHub Actions 마이그레이션",
        "✅ 4/1 — 팀 워크숍 장소 예약 확정",
        "✅ 4/1 — 월간 리포트 제출"
      ),
      hr(),
      h3("주간 리뷰 Weekly Review"),
      p("매주 금요일 오후, 이번 주를 돌아보세요."),
      bullet(
        "이번 주 완료한 핵심 성과:",
        "다음 주로 이월할 항목:",
        "배운 점 / 개선할 점:"
      ),
    ],
  },

  // 12. 주간 계획 (Weekly Plan)
  {
    name: "주간 계획",
    description: "한 주의 목표, 일정, 우선순위를 정리하여 생산적인 한 주를 설계하는 템플릿입니다.",
    category: "PERSONAL",
    icon: "📅",
    content: [
      h2("주간 계획 — Weekly Plan"),
      callout("일요일 저녁이나 월요일 아침에 한 주를 미리 설계하세요. 주간 목표를 3개 이내로 정하고, 매일 집중 시간(Deep Work)을 확보하세요.", "📅"),
      hr(),
      h3("이번 주 정보"),
      bullet(
        "기간: 2026-03-30 (월) ~ 2026-04-03 (금)",
        "주간 테마: 결제 시스템 기반 완성"
      ),
      hr(),
      h3("주간 목표 Weekly Goals (최대 3개)"),
      tasks(
        "Stripe 결제 연동 PoC 완성 및 팀 데모",
        "프로필 페이지 반응형 구현 완료",
        "기술 블로그 1편 발행"
      ),
      hr(),
      h3("월요일 Monday"),
      bullet(
        "09:00–10:00 팀 스탠드업 + 주간 계획 공유",
        "10:00–12:00 🔒 Deep Work: Stripe Checkout 세션 구현",
        "13:00–14:00 디자인 리뷰 미팅 (프로필 페이지)",
        "14:00–17:00 Stripe 웹훅 핸들러 개발"
      ),
      h3("화요일 Tuesday"),
      bullet(
        "09:00–12:00 🔒 Deep Work: 웹훅 이벤트 처리 로직 완성",
        "13:00–14:00 1:1 미팅 (PM과 스프린트 진행 상황)",
        "14:00–16:00 프로필 페이지 모바일 레이아웃 구현",
        "16:00–17:00 코드 리뷰"
      ),
      h3("수요일 Wednesday"),
      bullet(
        "09:00–11:00 🔒 Deep Work: 결제 플로우 통합 테스트 작성",
        "11:00–12:00 기술 공유 세션 (React Server Components)",
        "13:00–17:00 프로필 페이지 QA 및 버그 수정"
      ),
      h3("목요일 Thursday"),
      bullet(
        "09:00–10:00 스프린트 리뷰 미팅",
        "10:00–12:00 🔒 Deep Work: 기술 블로그 초안 작성",
        "13:00–15:00 결제 PoC 데모 준비",
        "15:00–16:00 팀 데모 + 피드백",
        "16:00–17:00 다음 스프린트 백로그 정리"
      ),
      h3("금요일 Friday"),
      bullet(
        "09:00–11:00 기술 블로그 편집 및 발행",
        "11:00–12:00 주간 회고 + 다음 주 계획",
        "13:00–15:00 기술 부채 해소 (테스트 커버리지 향상)",
        "15:00–17:00 학습 시간 (Zustand 공식 문서 정독)"
      ),
      hr(),
      h3("주간 회고 Weekly Retrospective"),
      p("금요일에 작성하세요."),
      bullet(
        "이번 주 가장 큰 성과:",
        "아쉬웠던 점:",
        "다음 주에 다르게 할 것:",
        "에너지 레벨 (1-5): /5"
      ),
    ],
  },

  // 13. 일일 저널 (Daily Journal)
  {
    name: "일일 저널",
    description: "하루를 되돌아보며 감사한 일, 배운 점, 감정을 기록하는 개인 저널입니다.",
    category: "PERSONAL",
    icon: "📔",
    content: [
      h2("일일 저널 — Daily Journal"),
      callout("매일 5-10분만 투자하세요. 완벽하게 쓸 필요 없습니다. 솔직하게, 있는 그대로 기록하는 것이 중요합니다.", "📔"),
      hr(),
      h3("오늘 날짜"),
      p("2026년 4월 2일 (목) | 날씨: 맑음 ☀️ | 기분: 😊 활기참"),
      hr(),
      h3("아침 — Morning Intention"),
      p("오늘의 의도(intention)를 한 문장으로:"),
      quote("오늘은 집중력을 유지하고, 가장 중요한 일 하나를 반드시 끝낸다."),
      hr(),
      h3("감사한 일 Gratitude (3가지)"),
      numbered(
        "팀원 수진이가 내 PR을 꼼꼼히 리뷰해줘서 버그를 사전에 잡을 수 있었다",
        "점심에 좋아하는 카레를 먹었다. 소소하지만 행복했다",
        "오랜만에 운동을 했더니 오후에 집중력이 좋았다"
      ),
      hr(),
      h3("오늘 한 일 What I Did"),
      bullet(
        "Stripe 결제 연동 코드 작성 — 80% 완료",
        "팀 스프린트 리뷰 미팅 참석 및 데모",
        "기술 블로그 개요 작성",
        "저녁 30분 러닝 (5km)"
      ),
      hr(),
      h3("배운 점 What I Learned"),
      p("Stripe의 idempotency key를 사용하면 중복 결제를 방지할 수 있다는 것을 알게 되었다. 네트워크 재시도 시에도 같은 키를 보내면 Stripe가 중복 처리를 막아준다."),
      hr(),
      h3("도전과 극복 Challenges"),
      p("오후에 웹훅 테스트가 계속 실패해서 1시간을 헤맸다. ngrok을 사용해서 로컬에서 웹훅을 받는 방법을 찾아 해결했다. 막힐 때 빨리 도움을 요청하거나 다른 접근법을 시도해야 한다는 걸 다시 느꼈다."),
      hr(),
      h3("감정 체크 Mood Check"),
      bullet(
        "에너지 레벨: ⭐⭐⭐⭐☆ (4/5)",
        "스트레스: ⭐⭐☆☆☆ (2/5)",
        "만족감: ⭐⭐⭐⭐☆ (4/5)",
        "수면 질: ⭐⭐⭐☆☆ (3/5) — 12시에 잤는데 좀 더 일찍 자야겠다"
      ),
      hr(),
      h3("내일 계획 Tomorrow"),
      tasks(
        "Stripe 웹훅 핸들러 완성",
        "코드 리뷰 2건 처리",
        "11시 반 치과 예약"
      ),
      hr(),
      h3("자유 메모 Free Writing"),
      p("요즘 사이드 프로젝트 아이디어가 떠올랐다. 개발자들이 TIL(Today I Learned)을 쉽게 기록하고 공유할 수 있는 서비스. 주말에 간단하게 와이어프레임을 그려봐야겠다."),
    ],
  },

  // 14. 독서 노트 (Book Notes)
  {
    name: "독서 노트",
    description: "읽은 책의 핵심 내용, 인상 깊은 구절, 실천 항목을 정리하는 독서 기록 템플릿입니다.",
    category: "PERSONAL",
    icon: "📚",
    content: [
      h2("독서 노트 — Book Notes"),
      callout("책을 읽으면서 인상 깊은 부분에 밑줄을 긋고, 읽은 후 24시간 이내에 이 노트를 작성하세요. 단순 요약보다 '나에게 어떤 의미인지'를 기록하는 것이 중요합니다.", "📚"),
      hr(),
      h3("책 정보 Book Info"),
      bullet(
        "제목: 함께 자라기 — 애자일로 가는 길",
        "저자: 김창준",
        "출판: 인사이트, 2018",
        "분야: 소프트웨어 개발 / 자기계발",
        "읽은 기간: 2026-03-20 ~ 2026-04-01",
        "평점: ⭐⭐⭐⭐⭐ (5/5)"
      ),
      hr(),
      h3("한 줄 요약 One-Line Summary"),
      p("소프트웨어 개발에서 개인의 성장과 팀의 성장은 분리될 수 없으며, '함께 자라는' 환경을 의도적으로 설계해야 한다."),
      hr(),
      h3("핵심 내용 Key Ideas"),
      h3("1. 학습의 본질"),
      p("학습은 '의도적 수련(Deliberate Practice)'을 통해서만 전문성으로 이어진다. 단순 반복은 학습이 아니다."),
      bullet(
        "현재 능력보다 약간 어려운 과제를 선택할 것",
        "즉각적 피드백이 있는 환경을 만들 것",
        "10,000시간 법칙의 핵심은 시간이 아니라 '의도적 수련의 질'"
      ),
      h3("2. 협력의 기술"),
      p("페어 프로그래밍과 코드 리뷰는 단순한 품질 관리가 아니라, 팀의 집단 지성을 높이는 학습 도구이다."),
      h3("3. 애자일의 본질"),
      p("애자일은 프로세스나 도구가 아니라 '불확실성을 빨리 학습하는 방식'이다."),
      hr(),
      h3("인상 깊은 구절 Highlights"),
      quote("전문가는 자신이 무엇을 모르는지 아는 사람이다. 초보자는 자신이 무엇을 모르는지조차 모른다."),
      p("→ 나에게 의미: 코드 리뷰에서 '모르겠다'고 말하는 것이 부끄러운 게 아니라는 것을 깨달았다."),
      quote("학습에서 가장 중요한 것은 '안전한 환경'이다. 실패해도 괜찮은 환경에서만 도전적인 학습이 가능하다."),
      p("→ 나에게 의미: 팀에서 심리적 안전감을 만드는 것이 리더의 가장 중요한 역할이라는 것."),
      hr(),
      h3("실천 항목 Action Items"),
      tasks(
        "주 1회 페어 프로그래밍 세션 도입 제안하기",
        "코드 리뷰 시 질문 형태로 피드백 주기 (지적 → 질문 전환)",
        "매일 15분 의도적 수련 시간 확보 (알고리즘 문제 1개)",
        "팀 회고에서 '안전한 환경' 주제로 논의 제안"
      ),
      hr(),
      h3("관련 책 추천 Related Books"),
      bullet(
        "피플웨어 — 톰 드마르코",
        "실용주의 프로그래머 — 앤드류 헌트",
        "소프트 스킬 — 존 손메즈"
      ),
    ],
  },

  // 15. 습관 추적기 (Habit Tracker)
  {
    name: "습관 추적기",
    description: "매일 실천할 습관을 정의하고, 달성 여부를 추적하는 습관 형성 도구입니다.",
    category: "PERSONAL",
    icon: "🔄",
    content: [
      h2("습관 추적기 — Habit Tracker"),
      callout("작게 시작하세요! '매일 1시간 운동' 대신 '운동복 입기'부터 시작하세요. 습관이 쌓이면 자연스럽게 확장됩니다. 66일 연속 달성이 목표입니다.", "🔄"),
      hr(),
      h3("이번 달: 2026년 4월"),
      p("월간 목표: 건강한 루틴 정착 + 학습 습관 강화"),
      hr(),
      h3("추적할 습관 Habits"),
      h3("🏃 건강 Health"),
      bullet(
        "기상 시간 7:00 이전 — 미니 습관: 알람 울리면 바로 이불 밖으로",
        "운동 30분 이상 — 러닝, 홈트, 산책 모두 포함",
        "물 8잔 (2L) 마시기 — 데스크에 물병 항상 비치",
        "수면 11시 이전 — 10:30부터 스마트폰 다운"
      ),
      h3("📖 학습 Learning"),
      bullet(
        "독서 20분 — 점심 후 또는 취침 전",
        "알고리즘 문제 1개 — LeetCode Easy/Medium",
        "TIL(Today I Learned) 기록 — 한 줄이라도 OK"
      ),
      h3("🧘 마음 Mind"),
      bullet(
        "명상 5분 — 기상 직후 앱으로",
        "감사 일기 3줄 — 일일 저널에 작성"
      ),
      hr(),
      h3("1주차 (4/1 ~ 4/7) Week 1"),
      p("각 습관의 달성 여부를 매일 체크하세요."),
      tasks(
        "월 4/1: 기상 ✓ | 운동 ✓ | 물 ✓ | 수면 ✗ | 독서 ✓ | 알고리즘 ✓ | TIL ✓ | 명상 ✓ | 감사 ✓",
        "화 4/2: 기상 ✓ | 운동 ✗ | 물 ✓ | 수면 ✓ | 독서 ✓ | 알고리즘 ✓ | TIL ✓ | 명상 ✓ | 감사 ✓",
        "수 4/3: (오늘 기록하세요)",
        "목 4/4:",
        "금 4/5:",
        "토 4/6:",
        "일 4/7:"
      ),
      hr(),
      h3("2주차 (4/8 ~ 4/14) Week 2"),
      tasks(
        "월 4/8:", "화 4/9:", "수 4/10:", "목 4/11:", "금 4/12:", "토 4/13:", "일 4/14:"
      ),
      hr(),
      h3("주간 통계 Weekly Stats"),
      p("매주 일요일에 달성률을 계산하세요."),
      bullet(
        "1주차: 기상 /7 | 운동 /7 | 물 /7 | 수면 /7 | 독서 /7 | 알고리즘 /7 | TIL /7 | 명상 /7 | 감사 /7",
        "2주차:",
        "3주차:",
        "4주차:"
      ),
      hr(),
      h3("보상 Rewards"),
      bullet(
        "1주 연속 달성: 좋아하는 카페 음료 ☕",
        "2주 연속 달성: 넷플릭스 영화 한 편 🎬",
        "한 달 전체 달성: 원하던 키보드 구매 ⌨️"
      ),
      hr(),
      h3("월말 회고 Monthly Review"),
      p("달의 마지막 날에 작성하세요."),
      bullet(
        "가장 잘 지킨 습관:",
        "가장 어려웠던 습관:",
        "다음 달에 추가/제거할 습관:",
        "전체 달성률: %"
      ),
    ],
  },

  // 16. 목표 설정 OKR (Objectives & Key Results)
  {
    name: "목표 설정 (OKR)",
    description: "분기별 목표와 핵심 결과를 설정하고 추적하는 OKR 템플릿입니다.",
    category: "PERSONAL",
    icon: "🎯",
    content: [
      h2("목표 설정 — OKR (Objectives & Key Results)"),
      callout("OKR은 도전적인 목표를 설정하세요. 70% 달성이 이상적입니다. 100% 달성했다면 목표가 너무 쉬웠을 수 있습니다. 매주 진행률을 업데이트하세요.", "🎯"),
      hr(),
      h3("OKR 정보"),
      bullet(
        "기간: 2026년 Q2 (4월 ~ 6월)",
        "작성자: 최수진",
        "마지막 업데이트: 2026-04-02",
        "중간 점검: 5월 1일 / 최종 평가: 7월 1일"
      ),
      hr(),
      h3("Objective 1: 프론트엔드 기술 역량 한 단계 업"),
      p("현재 중급 수준에서 시니어 레벨의 기술 역량을 갖추고, 팀 내 기술 리더십을 발휘한다."),
      h3("Key Results"),
      bullet(
        "KR1: 오픈소스 프로젝트에 PR 3개 이상 머지 — 현재 0/3 (0%)",
        "KR2: 기술 블로그 포스트 6편 발행 — 현재 1/6 (17%)",
        "KR3: 팀 기술 공유 세션 4회 진행 — 현재 1/4 (25%)",
        "KR4: TypeScript Advanced 패턴 스터디 완료 — 현재 진행 중 (30%)"
      ),
      hr(),
      h3("Objective 2: 프로덕트 임팩트 극대화"),
      p("담당 기능의 사용자 경험을 개선하여 핵심 지표를 향상시킨다."),
      h3("Key Results"),
      bullet(
        "KR1: 대시보드 페이지 LCP를 2.5초 → 1.5초 이하로 개선 — 현재 2.1초 (40%)",
        "KR2: 실시간 협업 편집 기능 출시 및 DAU 1,000명 달성 — 현재 개발 중 (20%)",
        "KR3: 프론트엔드 E2E 테스트 커버리지 40% → 70% — 현재 52% (40%)"
      ),
      hr(),
      h3("Objective 3: 건강한 워라밸 유지"),
      p("지속 가능한 생산성을 위해 건강과 개인 생활의 균형을 유지한다."),
      h3("Key Results"),
      bullet(
        "KR1: 주 3회 이상 운동 — 현재 주 2회 (65%)",
        "KR2: 하루 평균 근무 8시간 이내 유지 — 현재 평균 8.5시간 (50%)",
        "KR3: 분기 내 1회 이상 여행 — 5월 제주도 여행 예정 (예약 완료, 30%)"
      ),
      hr(),
      h3("주간 체크인 Weekly Check-in"),
      p("매주 금요일, 진행률을 간단히 업데이트하세요."),
      bullet(
        "Week 1 (4/1): O1-KR2 블로그 초안 작성 시작, O2-KR1 코드 스플리팅 적용 (LCP 2.1초)",
        "Week 2 (4/7):",
        "Week 3 (4/14):",
        "Week 4 (4/21):"
      ),
      hr(),
      h3("장애물 Blockers"),
      bullet(
        "O2-KR2: 실시간 편집에 CRDT 라이브러리 선택이 아직 확정되지 않음 → ADR 작성 중",
        "O3-KR2: 최근 긴급 배포가 많아 야근 발생 → PM과 스프린트 범위 조정 논의 필요"
      ),
      hr(),
      h3("분기말 평가 Quarterly Review"),
      p("분기 종료 후 각 KR의 최종 달성률을 기록하고, 다음 분기 OKR에 반영하세요."),
      bullet(
        "O1 최종 달성률: /100% — 자기 평가:",
        "O2 최종 달성률: /100% — 자기 평가:",
        "O3 최종 달성률: /100% — 자기 평가:",
        "다음 분기에 이어갈 목표:",
        "새로 추가할 목표:"
      ),
    ],
  },

  // 17. 여행 계획 (Travel Plan)
  {
    name: "여행 계획",
    description: "여행 일정, 예산, 숙소, 관광지, 짐 목록을 한 곳에서 관리하는 여행 플래너입니다.",
    category: "PERSONAL",
    icon: "✈️",
    content: [
      h2("여행 계획 — Travel Plan"),
      callout("여행 2주 전에 이 템플릿을 작성하세요. 예약 확인서, 주요 연락처, 비상 정보를 모두 한 곳에 모아두면 여행이 훨씬 편합니다.", "✈️"),
      hr(),
      h3("여행 개요 Trip Overview"),
      bullet(
        "여행지: 일본 오사카 + 교토",
        "기간: 2026-05-01 (금) ~ 2026-05-05 (화) / 4박 5일",
        "여행자: 최수진, 김민수 (2명)",
        "테마: 맛집 탐방 + 사찰 & 정원 투어",
        "예산: 1인 ₩1,200,000 (총 ₩2,400,000)"
      ),
      hr(),
      h3("예약 정보 Reservations"),
      h3("항공권 Flight"),
      bullet(
        "가는 편: 대한항공 KE723 | 인천 08:30 → 간사이 10:40 | 확인번호: ABC123",
        "오는 편: 대한항공 KE724 | 간사이 18:00 → 인천 20:10 | 확인번호: ABC124"
      ),
      h3("숙소 Accommodation"),
      bullet(
        "5/1~5/3 (2박): 호텔 닛코 오사카 — 난바역 도보 3분 | 확인번호: HN20260501 | ₩180,000/박",
        "5/3~5/5 (2박): 교토 게스트하우스 사쿠라 — 기온 지역 | 확인번호: GS20260503 | ₩120,000/박"
      ),
      hr(),
      h3("일정 Itinerary"),
      h3("Day 1 — 5/1 (금) 오사카 도착"),
      bullet(
        "10:40 간사이 공항 도착 → 난카이 라피트로 난바역 이동 (40분)",
        "12:00 호텔 체크인 & 짐 정리",
        "13:00 점심: 이치란 라멘 도톤보리점 🍜",
        "14:30 도톤보리 & 신사이바시 거리 탐방",
        "18:00 저녁: 쿠루몬 시장에서 스시 & 꼬치",
        "20:00 글리코 간판 야경 + 산책"
      ),
      h3("Day 2 — 5/2 (토) 오사카 풀데이"),
      bullet(
        "09:00 오사카성 관람 (텐슈카쿠 전망대 포함)",
        "11:30 점심: 타코야키 먹어보기 (와나카 or 쿠쿠루)",
        "13:00 우메다 스카이빌딩 공중정원 전망대",
        "15:00 덴덴타운 (전자상가 쇼핑)",
        "18:30 저녁: 오코노미야키 치보 본점",
        "20:30 아메리카무라 카페 거리 산책"
      ),
      h3("Day 3 — 5/3 (일) 오사카 → 교토"),
      bullet(
        "09:00 호텔 체크아웃 → JR로 교토 이동 (30분)",
        "10:30 교토 숙소 짐 맡기기",
        "11:00 후시미 이나리 신사 (센본 도리이)",
        "13:00 점심: 니시키 시장 먹거리 투어",
        "15:00 기요미즈데라 (청수사) 관람",
        "17:30 히가시야마 거리 산책 + 녹차 디저트",
        "19:00 저녁: 교토역 라멘 거리"
      ),
      h3("Day 4 — 5/4 (월) 교토 풀데이"),
      bullet(
        "08:00 아라시야마 대나무 숲 (이른 아침 방문 권장!)",
        "10:00 토게츠쿄 다리 + 아라시야마 원숭이 공원",
        "12:00 점심: 두부 요리 전문점",
        "14:00 킨카쿠지 (금각사)",
        "16:00 철학의 길 산책 → 긴카쿠지 (은각사)",
        "18:30 저녁: 교토 전통 가이세키 요리 (예약 필수)",
        "20:30 기온 거리 야간 산책"
      ),
      h3("Day 5 — 5/5 (화) 교토 → 귀국"),
      bullet(
        "08:00 숙소 체크아웃",
        "09:00 교토역에서 기념품 쇼핑",
        "11:00 JR 하루카로 간사이 공항 이동 (75분)",
        "18:00 간사이 출발 → 20:10 인천 도착"
      ),
      hr(),
      h3("예산 Budget"),
      bullet(
        "항공권: ₩600,000 (2인 왕복)",
        "숙소: ₩600,000 (4박 2인)",
        "교통: ₩200,000 (공항 리무진 + 시내 교통 + JR)",
        "식비: ₩600,000 (1인 1일 ₩60,000 × 5일 × 2인)",
        "관광/입장료: ₩100,000",
        "쇼핑/기타: ₩300,000",
        "합계: ₩2,400,000"
      ),
      hr(),
      h3("짐 체크리스트 Packing"),
      tasks(
        "여권 + 여권 사본 (별도 보관)",
        "항공권/숙소 확인서 (스마트폰 + 출력본)",
        "여행자 보험 가입 확인",
        "환전: 엔화 ¥50,000 (현금) + 해외결제 카드",
        "충전기 + 보조배터리 + 멀티어댑터",
        "편한 운동화 (많이 걸음!)",
        "우산 / 우비 (5월 교토 비 올 수 있음)",
        "상비약 (소화제, 두통약, 반창고)"
      ),
    ],
  },

  // 18. 레시피 (Recipe)
  {
    name: "레시피",
    description: "요리 레시피를 재료, 조리법, 팁과 함께 기록하는 나만의 요리 노트입니다.",
    category: "PERSONAL",
    icon: "🍳",
    content: [
      h2("레시피 — Recipe"),
      callout("레시피를 기록할 때는 계량을 정확히 쓰고, 실패했던 포인트와 성공 팁을 함께 메모하세요. 다음에 만들 때 큰 도움이 됩니다.", "🍳"),
      hr(),
      h3("요리 정보 Recipe Info"),
      bullet(
        "요리명: 크림 파스타 (Creamy Garlic Pasta)",
        "카테고리: 양식 / 메인 요리",
        "난이도: ⭐⭐☆☆☆ (초급)",
        "조리 시간: 25분 (준비 10분 + 조리 15분)",
        "인분: 2인분",
        "칼로리: 약 650kcal / 1인분"
      ),
      hr(),
      h3("재료 Ingredients"),
      h3("메인 재료"),
      bullet(
        "스파게티 면 200g",
        "베이컨 4줄 (또는 판체타 100g) — 1cm 폭으로 자르기",
        "마늘 4쪽 — 얇게 슬라이스",
        "양파 1/2개 — 잘게 다지기",
        "양송이 버섯 5개 — 슬라이스"
      ),
      h3("소스 재료"),
      bullet(
        "생크림 200ml (또는 휘핑크림)",
        "파르메산 치즈 가루 3큰술 (약 30g)",
        "버터 1큰술 (15g)",
        "올리브 오일 2큰술",
        "소금 1작은술 + 후추 약간",
        "파슬리 (장식용, 선택)"
      ),
      hr(),
      h3("조리법 Directions"),
      numbered(
        "끓는 물에 소금 1큰술을 넣고 스파게티를 패키지 표기보다 1분 짧게 삶는다 (알덴테). 면수 1컵을 남겨둔다.",
        "큰 팬에 올리브 오일 + 버터를 중불에 녹이고, 베이컨을 바삭하게 볶는다 (약 4분).",
        "베이컨 기름이 나오면 양파를 넣고 투명해질 때까지 볶는다 (약 2분).",
        "마늘과 버섯을 넣고 마늘 향이 올라올 때까지 볶는다 (약 1분, 마늘 태우지 않게 주의!).",
        "불을 중약불로 줄이고 생크림을 넣어 부드럽게 섞는다. 끓기 직전까지만 가열한다.",
        "파르메산 치즈를 넣고 잘 녹여준다. 이 단계에서 소스가 걸쭉해진다.",
        "삶은 면을 소스 팬에 넣고 잘 섞는다. 소스가 너무 되직하면 면수를 2~3큰술 추가한다.",
        "소금, 후추로 간을 맞추고 접시에 담은 후 파슬리를 뿌려 완성."
      ),
      hr(),
      h3("조리 팁 Cooking Tips"),
      callout("생크림을 넣은 후 절대 센 불로 끓이지 마세요! 크림이 분리됩니다. 중약불에서 천천히 가열하는 것이 포인트입니다.", "⚠️"),
      bullet(
        "면을 1분 덜 삶는 이유: 소스 팬에서 마저 익히면 딱 알덴테가 된다",
        "면수의 전분이 소스를 자연스럽게 걸쭉하게 만들어준다 — 면수 활용 필수!",
        "파르메산 대신 페코리노 로마노를 사용하면 더 짭짤하고 진한 맛",
        "채식 버전: 베이컨 대신 표고버섯 + 훈제 파프리카 1/2작은술"
      ),
      hr(),
      h3("변형 레시피 Variations"),
      bullet(
        "명란 크림 파스타: 소스에 명란젓 2큰술 추가 + 김 가루 토핑",
        "시금치 크림 파스타: 시금치 한 줌을 Step 4에서 함께 볶기",
        "매콤 크림 파스타: 페퍼론치노(건고추) 2개를 Step 2에서 함께 볶기"
      ),
      hr(),
      h3("조리 기록 Cook Log"),
      p("만들 때마다 메모하세요."),
      bullet(
        "4/2: 처음 만들어봄. 마늘을 조금 태웠지만 맛있었다. 다음엔 약불에서 볶기.",
        "다음 도전: 명란 크림 파스타"
      ),
      hr(),
      h3("평점 Rating"),
      p("맛: ⭐⭐⭐⭐⭐ | 난이도: ⭐⭐ | 재료 구하기: ⭐ (마트에서 전부 구매 가능)"),
    ],
  },

  // 19. 예산 계획 (Budget Plan)
  {
    name: "예산 계획",
    description: "월간 수입과 지출을 관리하고, 저축 목표를 추적하는 가계부 겸 예산 플래너입니다.",
    category: "PERSONAL",
    icon: "💰",
    content: [
      h2("예산 계획 — Budget Plan"),
      callout("수입의 50%는 필수 지출, 30%는 원하는 지출, 20%는 저축/투자에 배분하는 '50/30/20 규칙'을 기본으로 시작하세요. 매주 지출을 기록하고 월말에 리뷰합니다.", "💰"),
      hr(),
      h3("월간 개요 Monthly Overview"),
      bullet(
        "기간: 2026년 4월",
        "총 수입: ₩4,500,000",
        "예산 목표: 필수 ₩2,250,000 / 여유 ₩1,350,000 / 저축 ₩900,000",
        "저축 목표: 비상금 ₩10,000,000 (현재 ₩7,200,000 → 이번 달 ₩8,100,000)"
      ),
      hr(),
      h3("수입 Income"),
      bullet(
        "급여 (세후): ₩4,200,000",
        "부수입 (기술 블로그 광고): ₩150,000",
        "부수입 (프리랜서 코드리뷰): ₩150,000",
        "합계: ₩4,500,000"
      ),
      hr(),
      h3("고정 지출 Fixed Expenses"),
      bullet(
        "월세: ₩700,000",
        "관리비: ₩120,000",
        "통신비 (폰 + 인터넷): ₩85,000",
        "보험료 (실비 + 운전자): ₩130,000",
        "교통비 (정기권): ₩65,000",
        "구독 서비스: ₩45,000 (Netflix ₩17,000 + Spotify ₩11,000 + iCloud ₩4,400 + GitHub Copilot ₩12,600)",
        "고정 지출 합계: ₩1,145,000"
      ),
      hr(),
      h3("변동 지출 Variable Expenses"),
      h3("식비 Food"),
      bullet(
        "식료품/장보기: ₩300,000 (주 ₩75,000)",
        "외식/배달: ₩200,000 (주 ₩50,000)",
        "커피/음료: ₩60,000 (주 ₩15,000)"
      ),
      h3("생활 Living"),
      bullet(
        "의류/미용: ₩100,000",
        "건강 (헬스장 + 영양제): ₩80,000",
        "생활용품: ₩50,000"
      ),
      h3("여가 Leisure"),
      bullet(
        "취미/문화 (책, 영화, 게임): ₩80,000",
        "모임/경조사: ₩150,000",
        "자기계발 (온라인 강의): ₩50,000"
      ),
      p("변동 지출 합계: ₩1,070,000"),
      hr(),
      h3("저축 & 투자 Savings & Investment"),
      bullet(
        "비상금 적금: ₩500,000 (자동이체 매월 1일)",
        "투자 (ETF 정기매수): ₩300,000",
        "여행 기금: ₩100,000",
        "저축 합계: ₩900,000"
      ),
      hr(),
      h3("지출 요약 Summary"),
      bullet(
        "총 수입: ₩4,500,000",
        "총 지출: ₩2,215,000 (고정 ₩1,145,000 + 변동 ₩1,070,000)",
        "총 저축: ₩900,000",
        "잔여: ₩1,385,000 → 다음 달 이월 또는 추가 저축"
      ),
      hr(),
      h3("주간 지출 기록 Weekly Tracking"),
      p("매주 실제 사용 금액을 기록하세요."),
      bullet(
        "1주차 (4/1~4/7): 식비 ₩___  / 생활 ₩___  / 여가 ₩___",
        "2주차 (4/8~4/14):",
        "3주차 (4/15~4/21):",
        "4주차 (4/22~4/30):"
      ),
      hr(),
      h3("월말 리뷰 Monthly Review"),
      p("매월 마지막 날에 작성하세요."),
      bullet(
        "예산 대비 초과한 카테고리:",
        "예산 대비 절약한 카테고리:",
        "다음 달 조정할 항목:",
        "저축 목표 달성 여부: ₩___/₩900,000"
      ),
    ],
  },

  // 20. 아침 루틴 (Morning Routine)
  {
    name: "아침 루틴",
    description: "생산적인 하루를 시작하기 위한 아침 루틴을 설계하고 실천을 추적하는 템플릿입니다.",
    category: "PERSONAL",
    icon: "🌅",
    content: [
      h2("아침 루틴 — Morning Routine"),
      callout("아침 루틴은 '결정 피로(Decision Fatigue)'를 줄여줍니다. 매일 같은 순서로 진행하면 의지력을 아끼고, 중요한 일에 집중력을 쓸 수 있습니다. 처음엔 3단계로 시작하고 점차 늘려가세요.", "🌅"),
      hr(),
      h3("나의 아침 루틴 My Morning Routine"),
      p("기상 시간: 06:30 | 루틴 종료: 08:00 | 총 소요: 1시간 30분"),
      hr(),
      h3("06:30 — 기상 Wake Up"),
      bullet(
        "알람이 울리면 5초 안에 일어나기 (5초 규칙)",
        "스마트폰은 침대에서 2m 이상 떨어진 곳에 두기",
        "커튼 열어 자연광 들이기 — 세로토닌 분비를 촉진합니다",
        "물 한 잔 (300ml) 마시기 — 취침 중 탈수 보충"
      ),
      hr(),
      h3("06:35 — 명상 Meditation (5분)"),
      bullet(
        "타이머 5분 설정",
        "편안한 자세로 앉아 호흡에 집중",
        "들숨 4초 — 멈춤 4초 — 날숨 6초 (4-4-6 호흡법)",
        "잡념이 와도 판단하지 말고 다시 호흡에 집중"
      ),
      p("앱 추천: 마보 (한국어), Headspace (영어)"),
      hr(),
      h3("06:40 — 운동 Exercise (20분)"),
      bullet(
        "월/수/금: 홈트레이닝 (스쿼트 20회, 푸시업 15회, 플랭크 1분 × 3세트)",
        "화/목: 가벼운 조깅 또는 빠르게 걷기 (2km)",
        "토/일: 스트레칭 + 요가 (유튜브 20분 루틴)",
        "운동 후 간단한 스트레칭 3분"
      ),
      hr(),
      h3("07:00 — 씻기 & 준비 Freshen Up (15분)"),
      bullet(
        "샤워 (가능하면 마지막 30초 냉수 — 각성 효과)",
        "세안 & 스킨케어",
        "옷 입기 — 전날 밤에 미리 골라두면 시간 절약"
      ),
      hr(),
      h3("07:15 — 아침 식사 Breakfast (15분)"),
      bullet(
        "기본 메뉴: 오트밀 + 바나나 + 아몬드 + 우유",
        "빠른 날: 그릭 요거트 + 그래놀라 + 블루베리",
        "커피는 기상 후 90분 뒤에 마시기 (코르티솔 자연 하강 후가 효과적)"
      ),
      hr(),
      h3("07:30 — 학습 & 계획 Learning & Planning (25분)"),
      h3("학습 (15분)"),
      bullet(
        "독서 15분 — 현재 읽는 책: 함께 자라기 (김창준)",
        "또는 기술 아티클 1편 읽기",
        "읽은 내용 중 1가지를 TIL로 기록 (3줄 이내)"
      ),
      h3("오늘 계획 (10분)"),
      bullet(
        "캘린더 확인 — 오늘 미팅과 마감 확인",
        "MIT(Most Important Tasks) 3개 선정",
        "할 일 목록에 오늘 할 일 정리"
      ),
      hr(),
      h3("07:55 — 출발 준비 Ready to Go"),
      bullet(
        "가방 확인: 노트북, 충전기, 물병, 이어폰",
        "지갑 + 열쇠 + 교통카드 체크",
        "08:00 출발 목표"
      ),
      hr(),
      h3("주간 루틴 달성 Weekly Tracking"),
      tasks(
        "월: 기상 ✓ 명상 ✓ 운동 ✓ 식사 ✓ 학습 ✓ 계획 ✓",
        "화: 기상 ✓ 명상 ✓ 운동 ✓ 식사 ✓ 학습 ✗ 계획 ✓",
        "수:",
        "목:",
        "금:",
        "토:",
        "일:"
      ),
      hr(),
      h3("루틴 조정 기록 Adjustments"),
      p("루틴이 잘 안 되는 부분을 기록하고 조정하세요."),
      bullet(
        "4/1: 명상이 지루했다 → 가이드 명상(마보 앱)으로 변경",
        "4/2: 아침 운동 후 너무 피곤 → 운동 강도를 70%로 낮추기"
      ),
      hr(),
      h3("왜 이 루틴인가? Why This Routine?"),
      quote("성공한 사람들의 공통점은 '아침 시간을 통제한다'는 것이다. 아침 루틴은 하루 전체의 톤을 설정한다."),
      p("이 루틴은 신체(운동) → 마음(명상) → 두뇌(학습) → 실행(계획)의 순서로 전인적 준비를 목표로 합니다."),
    ],
  },
];
