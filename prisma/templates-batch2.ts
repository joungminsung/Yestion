// prisma/templates-batch2.ts

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

const h2 = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const h3 = (text: string) => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
const p = (text = "") => text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const bullet = (...items: string[]) => ({ type: "bulletList", content: items.map(t => ({ type: "listItem", content: [t ? { type: "paragraph", content: [{ type: "text", text: t }] } : { type: "paragraph" }] })) });
const tasks = (...items: string[]) => ({ type: "taskList", content: items.map(t => ({ type: "taskItem", attrs: { checked: false }, content: [t ? { type: "paragraph", content: [{ type: "text", text: t }] } : { type: "paragraph" }] })) });
const numbered = (...items: string[]) => ({ type: "orderedList", content: items.map(t => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })) });
const quote = (text: string) => ({ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const hr = () => ({ type: "horizontalRule" });
const callout = (text: string, icon = "💡") => ({ type: "callout", attrs: { icon, color: "default" }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

export const BATCH2_TEMPLATES: SeedTemplate[] = [
  // ──────────────── TEAM (10) ────────────────

  // 1. 1:1 미팅
  {
    name: "1:1 Meeting",
    nameKo: "1:1 미팅",
    description: "Structured one-on-one meeting template for managers and reports",
    descriptionKo: "매니저와 팀원 간 정기 1:1 미팅 템플릿",
    icon: "🤝",
    category: "team",
    tags: ["1on1", "meeting", "feedback", "미팅", "피드백"],
    blocks: [
      callout("매주 금요일 14:00 — 김민수 ↔ 박지영 리드 정기 1:1", "🤝"),
      h2("기분 체크 / Mood Check"),
      p("이번 주 컨디션: 😊 좋음 | 😐 보통 | 😟 힘듦"),
      p("한 줄 요약: 이번 주는 API 리팩터링에 집중하면서 성취감을 느꼈습니다."),
      hr(),
      h2("지난 액션 아이템 확인 / Previous Action Items"),
      p("지난 1:1에서 합의한 사항을 점검합니다."),
      tasks(
        "코드 리뷰 가이드라인 문서 초안 작성 — 기한: 4/4",
        "Jest 테스트 커버리지 60% 이상 달성",
        "디자인팀 싱크 미팅 일정 잡기"
      ),
      hr(),
      h2("이번 주 하이라이트 / This Week's Highlights"),
      p("잘된 점, 배운 점, 공유하고 싶은 것을 작성하세요."),
      bullet(
        "주문 API v2 리팩터링 완료 — 응답 시간 320ms → 180ms 개선",
        "신규 인턴 온보딩 페어 프로그래밍 진행",
        "사내 기술 세미나에서 'Prisma 마이그레이션 전략' 발표"
      ),
      hr(),
      h2("어려움 및 블로커 / Challenges & Blockers"),
      p("현재 막혀 있는 부분이나 도움이 필요한 사항을 기록합니다."),
      bullet(
        "결제 모듈 외부 API 응답 지연 이슈 — DevOps 팀 협조 필요",
        "QA 환경 배포 파이프라인 간헐적 실패"
      ),
      hr(),
      h2("커리어 성장 / Career Growth"),
      p("중장기 목표와 관련된 진행 상황을 이야기합니다."),
      bullet(
        "Q2 목표: 시니어 엔지니어 승급 준비 — 기술 설계 문서 2건 작성 중",
        "관심 분야: 시스템 디자인, 대규모 트래픽 처리"
      ),
      hr(),
      h2("다음 액션 아이템 / Next Action Items"),
      tasks(
        "결제 모듈 타임아웃 설정 조사 및 PR 올리기 — 기한: 4/11",
        "시니어 승급 자기평가서 초안 작성",
        "팀 코드 리뷰 문화 개선 제안서 공유"
      ),
      hr(),
      h2("기타 메모 / Additional Notes"),
      p("자유롭게 기록할 내용을 적어주세요."),
      p(),
    ],
  },

  // 2. 스프린트 회고
  {
    name: "Sprint Retrospective",
    nameKo: "스프린트 회고",
    description: "Team sprint retrospective with actionable improvements",
    descriptionKo: "팀 스프린트 회고 — 개선 액션 도출",
    icon: "🔄",
    category: "team",
    tags: ["sprint", "retro", "agile", "회고", "스프린트"],
    blocks: [
      callout("Sprint 14 회고 — 2026.03.23 ~ 2026.04.03 (2주)", "🔄"),
      h2("스프린트 요약 / Sprint Summary"),
      bullet(
        "목표: 사용자 대시보드 v2 출시 및 알림 시스템 안정화",
        "완료 스토리 포인트: 34 / 계획: 40 (달성률 85%)",
        "참여 인원: 김민수, 박지영, 이서준, 최하늘, 정다은"
      ),
      hr(),
      h2("잘한 점 / What Went Well 🎉"),
      p("이번 스프린트에서 잘 진행된 사항을 작성합니다."),
      bullet(
        "대시보드 성능 최적화 — LCP 2.8s → 1.2s로 개선",
        "디자인팀과의 핸드오프가 Figma 코멘트로 원활했음",
        "코드 리뷰 평균 응답 시간 4시간 이내 유지",
        "신규 팀원 정다은님 첫 스프린트 성공적 적응"
      ),
      hr(),
      h2("아쉬운 점 / What Could Improve 🤔"),
      p("개선이 필요하다고 느낀 부분을 솔직하게 공유합니다."),
      bullet(
        "알림 시스템 마이그레이션이 예상보다 2일 지연됨",
        "QA 단계에서 발견된 버그 7건 — 단위 테스트 부족",
        "스프린트 중반 요구사항 변경으로 스코프 크리프 발생",
        "일일 스탠드업이 15분을 초과하는 날이 3일 있었음"
      ),
      hr(),
      h2("시도해볼 것 / Action Items to Try 🚀"),
      p("다음 스프린트에서 구체적으로 시도할 개선 사항입니다."),
      tasks(
        "PR 머지 전 최소 테스트 커버리지 70% 기준 도입 — 담당: 이서준",
        "스탠드업 타이머 10분 설정 및 블로커만 논의 — 담당: 박지영",
        "스프린트 중간 스코프 변경 시 PO 승인 프로세스 도입 — 담당: 김민수",
        "페어 프로그래밍 주 1회 시범 운영 — 담당: 최하늘"
      ),
      hr(),
      h2("팀 분위기 투표 / Team Mood"),
      p("1(매우 나쁨) ~ 5(매우 좋음) 점수로 팀 분위기를 평가합니다."),
      bullet(
        "김민수: ⭐⭐⭐⭐ (4/5)",
        "박지영: ⭐⭐⭐⭐ (4/5)",
        "이서준: ⭐⭐⭐ (3/5)",
        "최하늘: ⭐⭐⭐⭐⭐ (5/5)",
        "정다은: ⭐⭐⭐⭐ (4/5)"
      ),
      p("평균: 4.0 / 5.0"),
    ],
  },

  // 3. 스프린트 계획
  {
    name: "Sprint Planning",
    nameKo: "스프린트 계획",
    description: "Sprint planning with goals, capacity, and backlog items",
    descriptionKo: "스프린트 계획 — 목표, 역량, 백로그 배정",
    icon: "📅",
    category: "team",
    tags: ["sprint", "planning", "agile", "계획", "스프린트"],
    blocks: [
      callout("Sprint 15 계획 — 2026.04.06 ~ 2026.04.17 (2주)", "📅"),
      h2("스프린트 목표 / Sprint Goal"),
      p("결제 시스템 v2 베타 출시 및 모바일 반응형 대시보드 완성"),
      quote("핵심 가치: 결제 전환율 5% 향상에 기여하는 안정적인 결제 플로우 구축"),
      hr(),
      h2("팀 역량 / Team Capacity"),
      p("가용 인원과 시간을 기반으로 스프린트 역량을 산정합니다."),
      bullet(
        "김민수 — 10일 (풀타임) / 16 SP",
        "박지영 — 8일 (수요일 연차) / 13 SP",
        "이서준 — 10일 (풀타임) / 16 SP",
        "최하늘 — 6일 (컨퍼런스 참석 2일) / 10 SP",
        "정다은 — 10일 (풀타임, 신규 멤버 보정 0.7) / 11 SP"
      ),
      p("총 가용 스토리 포인트: 66 SP → 버퍼 10% 적용: 60 SP"),
      hr(),
      h2("백로그 아이템 / Sprint Backlog"),
      h3("높은 우선순위 / High Priority"),
      tasks(
        "[PAY-201] 카드 결제 플로우 구현 — 8 SP — 김민수",
        "[PAY-202] 결제 실패 재시도 로직 — 5 SP — 김민수",
        "[DASH-105] 모바일 대시보드 레이아웃 — 8 SP — 이서준",
        "[DASH-106] 차트 컴포넌트 반응형 대응 — 5 SP — 정다은"
      ),
      h3("중간 우선순위 / Medium Priority"),
      tasks(
        "[PAY-203] 결제 내역 조회 API — 5 SP — 박지영",
        "[NOTI-301] 결제 완료 이메일 알림 — 3 SP — 박지영",
        "[DASH-107] 필터 & 정렬 기능 — 5 SP — 최하늘"
      ),
      h3("낮은 우선순위 / Low Priority (stretch)"),
      tasks(
        "[UX-401] 로딩 스켈레톤 UI 개선 — 3 SP — 정다은",
        "[INFRA-501] Sentry 에러 그룹핑 설정 — 2 SP — 최하늘"
      ),
      hr(),
      h2("리스크 및 의존성 / Risks & Dependencies"),
      bullet(
        "PG사 샌드박스 API 키 발급 지연 가능성 — 4/8까지 미수신 시 에스컬레이션",
        "디자인 시안 최종본 4/7 확정 필요 — 미확정 시 DASH-105 지연"
      ),
      hr(),
      h2("완료 조건 / Definition of Done"),
      tasks(
        "코드 리뷰 승인 (최소 1인)",
        "단위 테스트 커버리지 70% 이상",
        "QA 환경 배포 및 테스트 통과",
        "기술 문서 업데이트 (API 변경 시)"
      ),
    ],
  },

  // 4. 팀 위키
  {
    name: "Team Wiki",
    nameKo: "팀 위키",
    description: "Central knowledge base for team information",
    descriptionKo: "팀 정보 중앙 지식 베이스",
    icon: "📚",
    category: "team",
    tags: ["wiki", "knowledge", "team", "위키", "지식"],
    blocks: [
      callout("프론트엔드 플랫폼팀 위키 — 최종 업데이트: 2026-04-01", "📚"),
      h2("팀 소개 / About the Team"),
      p("프론트엔드 플랫폼팀은 사내 모든 웹 서비스의 공통 UI 컴포넌트, 디자인 시스템, 빌드 인프라를 담당합니다."),
      bullet(
        "미션: 일관된 사용자 경험과 개발 생산성 극대화",
        "소속: 엔지니어링 본부 > 플랫폼 조직",
        "인원: 6명 (프론트엔드 5, 디자이너 1)"
      ),
      hr(),
      h2("팀원 / Team Members"),
      bullet(
        "👤 박지영 — 팀 리드 / Tech Lead — Slack: @jiyoung.park",
        "👤 김민수 — 시니어 엔지니어 — 디자인 시스템 담당",
        "👤 이서준 — 엔지니어 — 빌드 인프라 담당",
        "👤 최하늘 — 엔지니어 — 성능 최적화 담당",
        "👤 정다은 — 주니어 엔지니어 — 컴포넌트 개발",
        "👤 한유진 — 프로덕트 디자이너 — UI/UX"
      ),
      hr(),
      h2("핵심 링크 / Key Links"),
      p("자주 사용하는 도구와 리소스 바로가기입니다."),
      bullet(
        "GitHub: github.com/company/frontend-platform",
        "Figma: figma.com/team/frontend-design-system",
        "Storybook: storybook.internal.company.com",
        "Jira 보드: jira.company.com/board/FE-PLATFORM",
        "Slack 채널: #frontend-platform, #fe-design-system"
      ),
      hr(),
      h2("기술 스택 / Tech Stack"),
      bullet(
        "Framework: Next.js 14 (App Router)",
        "Language: TypeScript 5.4",
        "Styling: Tailwind CSS + CVA (Class Variance Authority)",
        "State: Zustand + React Query",
        "Testing: Vitest + Playwright",
        "CI/CD: GitHub Actions → AWS ECS"
      ),
      hr(),
      h2("정기 미팅 / Regular Meetings"),
      bullet(
        "데일리 스탠드업 — 매일 10:00 (15분) — Google Meet",
        "스프린트 플래닝 — 격주 월요일 14:00 (1시간)",
        "스프린트 회고 — 격주 금요일 16:00 (45분)",
        "1:1 미팅 — 매주 금요일 (30분씩 개별)"
      ),
      hr(),
      h2("팀 규칙 / Team Agreements"),
      p("팀 내에서 합의한 규칙과 컨벤션을 정리합니다."),
      numbered(
        "PR은 24시간 내 리뷰 — 긴급 시 Slack 태그",
        "커밋 메시지는 Conventional Commits 형식 사용",
        "코어 타임: 10:00 ~ 16:00 (이 시간 내 응답 필수)",
        "코드 리뷰 시 최소 1 approve 후 머지"
      ),
    ],
  },

  // 5. 온보딩 가이드
  {
    name: "Onboarding Guide",
    nameKo: "온보딩 가이드",
    description: "New team member onboarding checklist and resources",
    descriptionKo: "신규 팀원 온보딩 체크리스트 및 리소스",
    icon: "🎯",
    category: "team",
    tags: ["onboarding", "new-hire", "guide", "온보딩", "신규"],
    blocks: [
      callout("환영합니다! 🎉 이 가이드는 첫 4주간의 온보딩을 돕기 위해 만들어졌습니다.", "🎯"),
      h2("첫째 주: 환경 설정 / Week 1: Setup"),
      p("입사 첫 주에 완료해야 할 필수 설정 항목들입니다."),
      tasks(
        "노트북 수령 및 macOS 초기 설정 완료",
        "회사 계정 생성: Google Workspace, Slack, Jira, GitHub",
        "개발 환경 구축: Node.js 20, pnpm, Docker Desktop 설치",
        "프로젝트 저장소 클론 및 로컬 빌드 확인",
        "VPN 접속 테스트 및 AWS 콘솔 접근 권한 확인",
        "팀 Slack 채널 가입: #frontend-platform, #general, #random"
      ),
      hr(),
      h2("둘째 주: 코드베이스 이해 / Week 2: Codebase"),
      p("코드 구조와 아키텍처를 파악하는 주간입니다."),
      tasks(
        "README.md 및 CONTRIBUTING.md 정독",
        "디자인 시스템 Storybook 전체 둘러보기",
        "주요 PR 5개 히스토리 리뷰 (팀 리드가 선정)",
        "간단한 Good First Issue 1건 해결 및 PR 제출",
        "코드 리뷰 받고 피드백 반영하기"
      ),
      hr(),
      h2("셋째 주: 실무 참여 / Week 3: Contribute"),
      p("실제 스프린트에 참여하여 기여를 시작합니다."),
      tasks(
        "스프린트 플래닝 참여 — 스토리 1~2개 배정받기",
        "페어 프로그래밍 세션 2회 참여 (시니어와 함께)",
        "PR 리뷰어로 1건 이상 참여",
        "팀 스탠드업에서 진행 상황 공유"
      ),
      hr(),
      h2("넷째 주: 자립 / Week 4: Independence"),
      p("독립적으로 작업하고 온보딩을 마무리합니다."),
      tasks(
        "독립적으로 스토리 1건 완료 (설계 → 구현 → 리뷰 → 배포)",
        "팀 위키에 자신이 배운 내용 1건 이상 추가",
        "온보딩 회고 미팅 — 팀 리드와 30분",
        "30-60-90일 목표 설정 문서 작성"
      ),
      hr(),
      h2("필수 읽기 자료 / Required Reading"),
      p("온보딩 기간 중 반드시 읽어야 할 문서 목록입니다."),
      numbered(
        "회사 엔지니어링 핸드북 — engineering.company.com/handbook",
        "프론트엔드 코딩 컨벤션 문서",
        "디자인 시스템 가이드라인 v2.1",
        "장애 대응 런북 (Runbook)",
        "보안 가이드라인 및 코드 리뷰 체크리스트"
      ),
      hr(),
      h2("버디 / Onboarding Buddy"),
      p("온보딩 버디: 김민수 (Slack: @minsu.kim) — 무엇이든 편하게 질문하세요!"),
    ],
  },

  // 6. 팀 OKR
  {
    name: "Team OKR",
    nameKo: "팀 OKR",
    description: "Quarterly objectives and key results for the team",
    descriptionKo: "분기별 팀 목표 및 핵심 결과 지표",
    icon: "🎯",
    category: "team",
    tags: ["okr", "objectives", "goals", "목표", "OKR"],
    blocks: [
      callout("2026년 Q2 (4월 ~ 6월) 프론트엔드 플랫폼팀 OKR", "🎯"),
      h2("Objective 1: 디자인 시스템 채택률 극대화"),
      p("사내 모든 웹 서비스에서 공통 디자인 시스템 사용률을 높여 UI 일관성을 확보합니다."),
      h3("Key Results"),
      bullet(
        "KR1: 디자인 시스템 컴포넌트 사용률 70% → 90% 달성 (현재: 72%)",
        "KR2: 신규 프로젝트 100%가 디자인 시스템 v2 기반으로 시작",
        "KR3: 컴포넌트 문서화 완성도 100% (현재 미문서화 12개 → 0개)"
      ),
      p("진행률: ██░░░░░░░░ 20% (4월 1주차 기준)"),
      hr(),
      h2("Objective 2: 웹 성능 최상위 수준 달성"),
      p("Core Web Vitals 기준으로 모든 주요 페이지가 'Good' 등급을 유지하도록 합니다."),
      h3("Key Results"),
      bullet(
        "KR1: LCP p75 2.5초 이내 달성 (현재: 3.1초)",
        "KR2: CLS p75 0.1 이하 유지 (현재: 0.08)",
        "KR3: 번들 사이즈 메인 페이지 기준 200KB 이하 (현재: 280KB)"
      ),
      p("진행률: ░░░░░░░░░░ 0% (측정 기반 설정 중)"),
      hr(),
      h2("Objective 3: 팀 개발 생산성 향상"),
      p("반복 작업을 자동화하고 개발 사이클 타임을 단축합니다."),
      h3("Key Results"),
      bullet(
        "KR1: PR 머지까지 평균 리드 타임 48시간 → 24시간 단축",
        "KR2: CI 파이프라인 평균 실행 시간 12분 → 6분 단축",
        "KR3: 코드 생성 CLI 도구 출시 — 컴포넌트 보일러플레이트 자동화"
      ),
      p("진행률: █░░░░░░░░░ 10% (CI 최적화 착수)"),
      hr(),
      h2("OKR 체크인 일정 / Check-in Schedule"),
      bullet(
        "주간 체크인: 매주 월요일 스탠드업 시 간략 공유",
        "월간 리뷰: 4/30, 5/29, 6/26 (팀 전체 미팅)",
        "분기 최종 평가: 7/3 (Q2 마감 후)"
      ),
      hr(),
      h2("메모 / Notes"),
      p("OKR 달성을 위한 아이디어나 참고 사항을 자유롭게 기록합니다."),
      p(),
    ],
  },

  // 7. 주간 보고
  {
    name: "Weekly Report",
    nameKo: "주간 보고",
    description: "Weekly team status report with metrics and plans",
    descriptionKo: "주간 팀 현황 보고 — 지표, 성과, 다음 주 계획",
    icon: "📊",
    category: "team",
    tags: ["weekly", "report", "status", "주간", "보고"],
    blocks: [
      callout("주간 보고 — 2026년 4월 1주차 (3/30 ~ 4/3)", "📊"),
      h2("주요 성과 / Key Accomplishments"),
      p("이번 주에 완료한 주요 작업을 요약합니다."),
      bullet(
        "결제 시스템 v2 베타 내부 테스트 완료 — 버그 3건 발견 및 수정",
        "디자인 시스템 DatePicker 컴포넌트 신규 출시",
        "성능 최적화: 메인 페이지 LCP 3.1s → 2.4s 개선",
        "신규 팀원 정다은님 온보딩 2주차 완료"
      ),
      hr(),
      h2("핵심 지표 / Key Metrics"),
      p("이번 주 주요 지표 현황입니다."),
      bullet(
        "스프린트 진행률: 22/40 SP 완료 (55%) — 정상 궤도",
        "버그 발생: 5건 / 해결: 7건 (백로그 감소 -2)",
        "PR 평균 리뷰 시간: 18시간 (목표: 24시간 이내 ✅)",
        "배포 횟수: 8회 (스테이징 5, 프로덕션 3)",
        "Sentry 에러율: 0.12% (목표: 0.5% 이내 ✅)"
      ),
      hr(),
      h2("진행 중 / In Progress"),
      p("현재 진행 중인 작업과 예상 완료일입니다."),
      tasks(
        "[PAY-201] 카드 결제 플로우 QA 중 — 예상 완료: 4/7",
        "[DASH-105] 모바일 대시보드 — 70% 완료 — 예상 완료: 4/10",
        "[NOTI-301] 결제 알림 이메일 템플릿 — 디자인 대기 중"
      ),
      hr(),
      h2("이슈 및 리스크 / Issues & Risks"),
      p("주의가 필요한 이슈와 리스크를 기록합니다."),
      bullet(
        "🔴 PG사 샌드박스 API 키 미발급 — 4/8 에스컬레이션 예정",
        "🟡 QA 환경 DB 디스크 용량 80% — DevOps에 증설 요청 완료",
        "🟢 디자인 시안 지연 리스크 해소 — 4/2 최종 확정"
      ),
      hr(),
      h2("다음 주 계획 / Next Week Plan"),
      p("다음 주 핵심 목표와 계획입니다."),
      numbered(
        "결제 플로우 프로덕션 배포 (4/8 예정)",
        "모바일 대시보드 QA 진입",
        "디자인 시스템 v2.2 릴리스 준비",
        "분기 OKR 중간 체크인 미팅 (4/10)"
      ),
      hr(),
      h2("팀 리소스 현황 / Team Availability"),
      bullet(
        "김민수: 정상 근무",
        "박지영: 4/8 연차",
        "이서준: 정상 근무",
        "최하늘: 4/9~10 컨퍼런스 참석",
        "정다은: 정상 근무"
      ),
    ],
  },

  // 8. 팀 핸드북
  {
    name: "Team Handbook",
    nameKo: "팀 핸드북",
    description: "Comprehensive team processes, culture, and guidelines",
    descriptionKo: "팀 프로세스, 문화, 가이드라인 종합 문서",
    icon: "📘",
    category: "team",
    tags: ["handbook", "culture", "process", "핸드북", "문화"],
    blocks: [
      callout("프론트엔드 플랫폼팀 핸드북 — 우리가 일하는 방식", "📘"),
      h2("팀 미션 / Team Mission"),
      quote("모든 사용자에게 일관되고 빠른 웹 경험을 제공하며, 동료 개발자의 생산성을 극대화합니다."),
      hr(),
      h2("근무 방식 / Working Style"),
      p("팀의 근무 형태와 기본 원칙을 설명합니다."),
      bullet(
        "하이브리드 근무: 주 3일 사무실 (월/화/목) + 주 2일 재택",
        "코어 타임: 10:00 ~ 16:00 (이 시간 동안 Slack 응답 필수)",
        "유연 근무: 코어 타임 외 자율 (총 8시간 기준)",
        "집중 시간: 수요일 오후 No-Meeting 블록"
      ),
      hr(),
      h2("커뮤니케이션 / Communication"),
      p("팀 내 소통 규칙과 채널별 용도입니다."),
      h3("Slack 채널"),
      bullet(
        "#frontend-platform — 팀 공식 채널 (공지, 논의)",
        "#fe-platform-pr — PR 알림 자동 포스팅",
        "#fe-design-system — 디자인 시스템 관련 질문/공유",
        "#fe-random — 잡담, 밈, 팀빌딩"
      ),
      h3("커뮤니케이션 원칙"),
      numbered(
        "비동기 우선: 긴급하지 않으면 Slack 메시지 → 24시간 내 응답",
        "긴급 사항: Slack 멘션 + 이모지 🚨 → 1시간 내 응답",
        "장애 발생: #incident 채널 + 온콜 담당자 호출",
        "의사결정: 논의 후 반드시 문서화 (이 위키 또는 ADR)"
      ),
      hr(),
      h2("개발 프로세스 / Development Process"),
      p("코드 작성부터 배포까지의 프로세스를 정리합니다."),
      numbered(
        "Jira 티켓 생성 및 스프린트 배정",
        "feature 브랜치 생성 (feature/TICKET-ID-description)",
        "구현 및 단위 테스트 작성",
        "PR 생성 — 최소 1인 리뷰어 지정",
        "CI 통과 + 코드 리뷰 승인 후 Squash Merge",
        "스테이징 자동 배포 → QA 검증",
        "프로덕션 배포 (매주 화/목 오전)"
      ),
      hr(),
      h2("코드 리뷰 가이드 / Code Review"),
      p("건설적이고 효율적인 코드 리뷰를 위한 가이드입니다."),
      bullet(
        "PR 사이즈: 가급적 400줄 이하 (큰 경우 분할 권장)",
        "리뷰 응답 시간: 24시간 이내 (긴급 태그 시 4시간)",
        "Approve / Request Changes / Comment 명확히 구분",
        "칭찬도 함께: 좋은 코드에는 👍 이모지로 격려"
      ),
      hr(),
      h2("온콜 & 장애 대응 / On-Call"),
      p("주간 로테이션으로 온콜을 운영합니다."),
      bullet(
        "온콜 주기: 주간 로테이션 (월요일 교대)",
        "응답 시간 목표: 심각도 P1 — 15분, P2 — 1시간, P3 — 다음 업무일",
        "장애 발생 시: 런북 참조 → 조치 → 포스트모템 작성"
      ),
    ],
  },

  // 9. 팀 회고
  {
    name: "Team Retrospective",
    nameKo: "팀 회고",
    description: "Quarterly or ad-hoc team retrospective",
    descriptionKo: "분기별 또는 수시 팀 전체 회고",
    icon: "🪞",
    category: "team",
    tags: ["retro", "team", "review", "회고", "분기"],
    blocks: [
      callout("2026년 Q1 팀 회고 — 1월 ~ 3월 전체 돌아보기", "🪞"),
      h2("Q1 목표 대비 성과 / Q1 Goals vs Results"),
      p("분기 초 세운 목표와 실제 달성을 비교합니다."),
      bullet(
        "디자인 시스템 v2 출시 — ✅ 달성 (2월 출시)",
        "Core Web Vitals Good 등급 — 🟡 부분 달성 (LCP 미달 1개 페이지)",
        "팀 채용 2명 — ✅ 달성 (최하늘 2/1, 정다은 3/15 합류)",
        "CI 파이프라인 50% 단축 — ❌ 미달 (12분 → 9분, 25% 단축)"
      ),
      hr(),
      h2("자랑스러운 순간 / Proud Moments 🏆"),
      p("팀원들이 자랑스럽게 느낀 순간을 공유합니다."),
      bullet(
        "디자인 시스템 v2 런칭 후 사내 5개 팀 즉시 채택",
        "프로덕션 장애 0건 연속 47일 달성 (역대 최장)",
        "팀 기술 블로그 게시물 3건 발행 — 외부 조회수 12,000+",
        "신규 팀원 2명이 2주 만에 첫 PR 머지 성공"
      ),
      hr(),
      h2("아쉬운 점 / Disappointments 😔"),
      p("기대에 못 미쳤거나 개선이 필요한 부분을 솔직히 나눕니다."),
      bullet(
        "CI 최적화 목표 미달 — 캐시 전략 변경이 예상보다 복잡했음",
        "기술 부채 해소 시간 확보 실패 — 스프린트마다 기능 우선 배정",
        "팀 간 커뮤니케이션 병목 — 백엔드팀 API 스펙 변경 사전 공유 부족",
        "문서화 부채 증가 — 신규 기능 대비 문서 업데이트 지연"
      ),
      hr(),
      h2("배운 점 / Lessons Learned 📖"),
      p("이번 분기에 팀이 배운 교훈을 정리합니다."),
      numbered(
        "큰 마이그레이션은 feature flag로 점진적 롤아웃해야 리스크가 줄어든다",
        "채용과 온보딩은 시간 투자 대비 장기적 효과가 매우 크다",
        "성능 최적화는 측정 → 가설 → 실험 사이클을 꼭 지켜야 한다",
        "팀 간 API 계약은 문서화 + 자동 테스트로 보호해야 한다"
      ),
      hr(),
      h2("Q2 개선 약속 / Q2 Commitments"),
      p("다음 분기에 반드시 실행할 개선 사항입니다."),
      tasks(
        "스프린트마다 기술 부채 해소용 포인트 20% 확보 — 담당: 박지영",
        "백엔드팀과 API 변경 사전 리뷰 프로세스 도입 — 담당: 김민수",
        "CI 캐시 레이어 재설계 — 목표: 6분 이내 — 담당: 이서준",
        "신규 기능 출시 시 문서 동시 업데이트 의무화 — 담당: 전체"
      ),
      hr(),
      h2("팀 건강도 설문 결과 / Team Health"),
      bullet(
        "심리적 안전감: 4.2/5.0 ⬆️ (이전: 3.8)",
        "업무 만족도: 3.9/5.0 → (이전: 3.9)",
        "워라밸: 3.7/5.0 ⬇️ (이전: 4.0 — Q1 말 크런치 영향)",
        "성장 기회: 4.1/5.0 ⬆️ (이전: 3.6)"
      ),
    ],
  },

  // 10. 스탠드업 노트
  {
    name: "Standup Notes",
    nameKo: "스탠드업 노트",
    description: "Daily standup notes with blockers and updates",
    descriptionKo: "일일 스탠드업 기록 — 진행, 계획, 블로커",
    icon: "🧍",
    category: "team",
    tags: ["standup", "daily", "scrum", "스탠드업", "데일리"],
    blocks: [
      callout("데일리 스탠드업 — 2026년 4월 2일 (수) 10:00", "🧍"),
      p("각 팀원이 어제 한 일, 오늘 할 일, 블로커를 공유합니다. 15분 이내 완료를 목표로 합니다."),
      hr(),
      h2("김민수"),
      h3("어제 한 일 / Yesterday"),
      bullet(
        "카드 결제 플로우 에러 핸들링 구현 완료",
        "PG사 API 타임아웃 이슈 디버깅 — 원인 파악"
      ),
      h3("오늘 할 일 / Today"),
      bullet(
        "결제 실패 재시도 로직 구현 시작 [PAY-202]",
        "QA팀 결제 테스트 케이스 리뷰"
      ),
      h3("블로커 / Blockers"),
      bullet("PG사 sandbox 환경 간헐적 503 에러 — PG사 기술지원팀에 문의 중"),
      hr(),
      h2("박지영"),
      h3("어제 한 일 / Yesterday"),
      bullet(
        "결제 내역 조회 API 설계 문서 작성",
        "이서준님 PR 코드 리뷰 완료"
      ),
      h3("오늘 할 일 / Today"),
      bullet(
        "결제 내역 API 엔드포인트 구현 착수 [PAY-203]",
        "스프린트 중간 번다운 차트 확인 및 조정"
      ),
      h3("블로커 / Blockers"),
      p("없음"),
      hr(),
      h2("이서준"),
      h3("어제 한 일 / Yesterday"),
      bullet(
        "모바일 대시보드 그리드 레이아웃 70% 완료",
        "Tailwind breakpoint 이슈 해결"
      ),
      h3("오늘 할 일 / Today"),
      bullet(
        "모바일 대시보드 차트 영역 반응형 작업 [DASH-105]",
        "Playwright 모바일 뷰포트 테스트 추가"
      ),
      h3("블로커 / Blockers"),
      p("없음"),
      hr(),
      h2("요약 / Summary"),
      p("팀 전체 블로커와 오늘 핵심 목표를 정리합니다."),
      bullet(
        "🔴 블로커 1건: PG사 sandbox 503 — 김민수 팔로업",
        "오늘 핵심: 결제 재시도 로직 + 모바일 대시보드 차트 반응형"
      ),
    ],
  },

  // ──────────────── PROJECT (10) ────────────────

  // 1. 프로젝트 계획
  {
    name: "Project Plan",
    nameKo: "프로젝트 계획",
    description: "Comprehensive project plan with scope, timeline, and resources",
    descriptionKo: "프로젝트 범위, 일정, 리소스 종합 계획서",
    icon: "📋",
    category: "project",
    tags: ["plan", "project", "scope", "계획", "프로젝트"],
    blocks: [
      callout("프로젝트: 커머스 결제 시스템 v2 — 시작: 2026.03.01 / 종료: 2026.06.30", "📋"),
      h2("프로젝트 개요 / Project Overview"),
      p("기존 결제 시스템을 차세대 아키텍처로 전환하여 결제 전환율을 개선하고 글로벌 결제 수단을 지원합니다."),
      quote("비전: 3초 이내 결제 완료, 결제 전환율 85% → 92% 달성"),
      hr(),
      h2("목표 / Objectives"),
      numbered(
        "결제 UX 개선 — 3단계 → 1단계 결제 플로우 간소화",
        "글로벌 결제 수단 추가 — PayPal, Apple Pay, Google Pay",
        "시스템 안정성 — 결제 성공률 99.5% 이상 유지",
        "보안 강화 — PCI DSS 3.2 컴플라이언스 충족"
      ),
      hr(),
      h2("범위 / Scope"),
      h3("포함 (In Scope)"),
      bullet(
        "카드 결제 플로우 재설계",
        "간편 결제 (카카오페이, 네이버페이) 통합",
        "글로벌 결제 수단 연동 (PayPal, Apple Pay)",
        "결제 대시보드 및 관리자 도구"
      ),
      h3("제외 (Out of Scope)"),
      bullet(
        "암호화폐 결제",
        "오프라인 POS 연동",
        "정산 시스템 재설계 (별도 프로젝트)"
      ),
      hr(),
      h2("일정 / Timeline"),
      bullet(
        "Phase 1 (3/1 ~ 3/31): 설계 및 프로토타입 — ✅ 완료",
        "Phase 2 (4/1 ~ 4/30): 핵심 결제 플로우 개발 — 🔵 진행 중",
        "Phase 3 (5/1 ~ 5/31): 글로벌 결제 연동 및 QA",
        "Phase 4 (6/1 ~ 6/15): 베타 테스트 및 성능 최적화",
        "Phase 5 (6/16 ~ 6/30): 점진적 롤아웃 및 모니터링"
      ),
      hr(),
      h2("팀 구성 / Team"),
      bullet(
        "PM: 이수현 — 전체 일정 및 이해관계자 관리",
        "Tech Lead: 김민수 — 아키텍처 설계 및 기술 의사결정",
        "Frontend: 이서준, 정다은 — 결제 UI 및 대시보드",
        "Backend: 박지영, 최하늘 — API 및 PG 연동",
        "QA: 윤서아 — 테스트 계획 및 실행",
        "Design: 한유진 — UX 설계 및 프로토타입"
      ),
      hr(),
      h2("성공 지표 / Success Metrics"),
      bullet(
        "결제 전환율: 85% → 92% (런칭 후 30일 기준)",
        "평균 결제 완료 시간: 12초 → 4초",
        "결제 성공률: 97.2% → 99.5%",
        "고객 문의: 결제 관련 CS 30% 감소"
      ),
    ],
  },

  // 2. 로드맵
  {
    name: "Roadmap",
    nameKo: "로드맵",
    description: "Product or project roadmap with quarterly milestones",
    descriptionKo: "제품/프로젝트 로드맵 — 분기별 마일스톤",
    icon: "🗺️",
    category: "project",
    tags: ["roadmap", "timeline", "milestones", "로드맵", "일정"],
    blocks: [
      callout("2026년 커머스 플랫폼 로드맵 — 연간 계획", "🗺️"),
      h2("비전 / Vision"),
      quote("동남아 시장 1위 커머스 플랫폼으로 도약 — MAU 500만 달성"),
      hr(),
      h2("Q1 (1월 ~ 3월) — 기반 강화 ✅"),
      p("핵심 인프라와 기술 부채 해소에 집중한 분기입니다."),
      bullet(
        "✅ 디자인 시스템 v2 출시 (2월)",
        "✅ 검색 엔진 Elasticsearch → OpenSearch 마이그레이션",
        "✅ 모바일 앱 성능 최적화 (앱 시작 시간 40% 단축)",
        "✅ 신규 채용 2명 (프론트엔드 1, 백엔드 1)"
      ),
      hr(),
      h2("Q2 (4월 ~ 6월) — 결제 혁신 🔵"),
      p("결제 경험을 전면 개편하여 전환율을 높이는 분기입니다."),
      bullet(
        "🔵 결제 시스템 v2 출시 (6월 목표)",
        "🔵 글로벌 결제 수단 추가 (PayPal, Apple Pay)",
        "⬜ 실시간 결제 대시보드 구축",
        "⬜ A/B 테스트 플랫폼 도입"
      ),
      hr(),
      h2("Q3 (7월 ~ 9월) — 글로벌 확장 ⬜"),
      p("동남아 시장 진출을 위한 다국어/다통화 지원 분기입니다."),
      bullet(
        "⬜ 다국어 지원 (영어, 베트남어, 태국어)",
        "⬜ 다통화 결제 및 환율 자동 처리",
        "⬜ 동남아 CDN 엣지 노드 추가 (싱가포르, 호치민)",
        "⬜ 현지 물류 파트너 API 연동"
      ),
      hr(),
      h2("Q4 (10월 ~ 12월) — 데이터 & AI ⬜"),
      p("데이터 기반 의사결정과 AI 기능으로 경쟁력을 확보합니다."),
      bullet(
        "⬜ AI 상품 추천 엔진 v1 출시",
        "⬜ 실시간 분석 대시보드 (매출, 사용자 행동)",
        "⬜ 챗봇 기반 고객 지원 자동화",
        "⬜ 연말 대규모 프로모션 대비 인프라 스케일링"
      ),
      hr(),
      h2("범례 / Legend"),
      bullet(
        "✅ 완료 (Completed)",
        "🔵 진행 중 (In Progress)",
        "⬜ 예정 (Planned)"
      ),
      hr(),
      h2("의존성 & 리스크 / Dependencies & Risks"),
      bullet(
        "Q3 글로벌 확장은 Q2 결제 v2 완료에 의존",
        "다국어 번역 외주 업체 선정 6월까지 완료 필요",
        "AI 추천 엔진은 데이터 파이프라인 구축 선행 필요"
      ),
    ],
  },

  // 3. 리스크 관리
  {
    name: "Risk Management",
    nameKo: "리스크 관리",
    description: "Project risk register with mitigation strategies",
    descriptionKo: "프로젝트 리스크 등록부 및 완화 전략",
    icon: "⚠️",
    category: "project",
    tags: ["risk", "management", "mitigation", "리스크", "관리"],
    blocks: [
      callout("결제 시스템 v2 프로젝트 리스크 관리 대장 — 최종 업데이트: 2026-04-01", "⚠️"),
      h2("리스크 평가 기준 / Risk Assessment Criteria"),
      p("리스크를 영향도(Impact)와 발생 확률(Probability)로 평가합니다."),
      bullet(
        "영향도: 1(미미) ~ 5(치명적)",
        "확률: 1(매우 낮음) ~ 5(거의 확실)",
        "리스크 점수 = 영향도 × 확률 (15 이상: 긴급 대응 필요)"
      ),
      hr(),
      h2("🔴 높은 리스크 / High Risk"),
      h3("R-001: PG사 API 안정성 이슈"),
      bullet(
        "설명: 신규 PG사 sandbox 환경 간헐적 장애 (주 2~3회 발생)",
        "영향도: 5 / 확률: 4 / 점수: 20",
        "완화 전략: 멀티 PG 페일오버 구현 + 기존 PG사 폴백 유지",
        "담당: 박지영 / 기한: 4/15",
        "상태: 대응 중 — 페일오버 로직 70% 구현"
      ),
      h3("R-002: 인력 리스크 — 핵심 인원 이탈"),
      bullet(
        "설명: 결제 도메인 전문가(백엔드)가 1명뿐이라 SPOF 리스크",
        "영향도: 5 / 확률: 2 / 점수: 10",
        "완화 전략: 페어 프로그래밍으로 지식 공유 + 기술 문서 필수 작성",
        "담당: 김민수 / 기한: 상시",
        "상태: 진행 중 — 최하늘님 결제 도메인 스터디 중"
      ),
      hr(),
      h2("🟡 중간 리스크 / Medium Risk"),
      h3("R-003: 일정 지연 — 디자인 시안 확정 지연"),
      bullet(
        "설명: UX 리서치 결과 반영으로 디자인 2차 수정 발생",
        "영향도: 3 / 확률: 3 / 점수: 9",
        "완화 전략: 디자인 버퍼 1주 확보 + MVP 우선 개발",
        "담당: 한유진 / 기한: 4/7 최종 확정",
        "상태: 해소됨 ✅ — 4/2 최종 시안 확정"
      ),
      h3("R-004: 보안 — PCI DSS 컴플라이언스"),
      bullet(
        "설명: 카드 정보 처리 방식이 PCI DSS 요건 충족 여부 불확실",
        "영향도: 4 / 확률: 2 / 점수: 8",
        "완화 전략: 외부 보안 감사 4월 중 실시 + 토큰화 방식 적용",
        "담당: 김민수 / 기한: 4/30",
        "상태: 보안 감사 업체 선정 완료"
      ),
      hr(),
      h2("🟢 낮은 리스크 / Low Risk"),
      h3("R-005: 기술 — 브라우저 호환성"),
      bullet(
        "설명: Safari에서 Payment Request API 동작 차이 가능성",
        "영향도: 2 / 확률: 2 / 점수: 4",
        "완화 전략: Playwright cross-browser 테스트 자동화",
        "담당: 이서준 / 기한: 5/15",
        "상태: 테스트 환경 구축 예정"
      ),
      hr(),
      h2("리스크 리뷰 일정 / Review Schedule"),
      bullet(
        "주간 리뷰: 매주 수요일 스탠드업 후 10분",
        "월간 리뷰: 매월 첫째 주 금요일 (PM + Tech Lead)",
        "긴급 리뷰: 점수 15 이상 신규 리스크 발생 시 즉시"
      ),
    ],
  },

  // 4. 백로그
  {
    name: "Backlog",
    nameKo: "백로그",
    description: "Product backlog with prioritized user stories",
    descriptionKo: "우선순위 기반 제품 백로그",
    icon: "📦",
    category: "project",
    tags: ["backlog", "stories", "priority", "백로그", "우선순위"],
    blocks: [
      callout("결제 시스템 v2 제품 백로그 — 총 42개 스토리 / 완료 18개", "📦"),
      h2("백로그 관리 원칙 / Backlog Principles"),
      p("백로그 항목의 우선순위 결정 기준을 설명합니다."),
      numbered(
        "비즈니스 가치 (매출, 전환율 영향도)",
        "사용자 영향도 (영향 받는 사용자 수)",
        "기술적 의존성 (선행 작업 유무)",
        "구현 복잡도 (스토리 포인트)"
      ),
      hr(),
      h2("🔴 긴급 / Critical"),
      p("즉시 처리가 필요한 항목입니다."),
      tasks(
        "[PAY-210] 결제 타임아웃 시 이중 결제 방지 로직 — 8 SP — 박지영",
        "[PAY-211] 카드사 3DS 인증 플로우 구현 — 13 SP — 김민수"
      ),
      hr(),
      h2("🟠 높음 / High Priority"),
      p("현재 스프린트 또는 다음 스프린트에 배정될 항목입니다."),
      tasks(
        "[PAY-201] 카드 결제 원클릭 플로우 — 8 SP — 김민수 (진행 중)",
        "[PAY-202] 결제 실패 자동 재시도 — 5 SP — 김민수",
        "[PAY-203] 결제 내역 조회 API — 5 SP — 박지영 (진행 중)",
        "[DASH-105] 모바일 결제 대시보드 — 8 SP — 이서준 (진행 중)",
        "[DASH-106] 차트 컴포넌트 반응형 — 5 SP — 정다은",
        "[NOTI-301] 결제 완료 이메일 알림 — 3 SP — 박지영"
      ),
      hr(),
      h2("🟡 보통 / Medium Priority"),
      p("이번 분기 내 처리 예정인 항목입니다."),
      tasks(
        "[PAY-220] 카카오페이 간편결제 연동 — 8 SP",
        "[PAY-221] 네이버페이 간편결제 연동 — 8 SP",
        "[PAY-222] PayPal 글로벌 결제 연동 — 13 SP",
        "[DASH-110] 결제 통계 리포트 페이지 — 8 SP",
        "[UX-401] 로딩 스켈레톤 UI 개선 — 3 SP",
        "[UX-402] 결제 성공/실패 애니메이션 — 3 SP"
      ),
      hr(),
      h2("🟢 낮음 / Low Priority"),
      p("여유가 있을 때 처리하거나 다음 분기로 이월 가능한 항목입니다."),
      tasks(
        "[PAY-230] Apple Pay 연동 — 8 SP",
        "[PAY-231] Google Pay 연동 — 8 SP",
        "[INFRA-501] Sentry 에러 그룹핑 최적화 — 2 SP",
        "[INFRA-502] 결제 로그 ELK 대시보드 구축 — 5 SP",
        "[DOC-601] 결제 API 외부 개발자 문서 — 5 SP"
      ),
      hr(),
      h2("아이스박스 / Icebox 🧊"),
      p("언젠가 하면 좋지만 현재 계획에 없는 항목입니다."),
      bullet(
        "암호화폐 결제 지원 탐색",
        "BNPL(후불결제) 연동 검토",
        "결제 위젯 SDK (외부 파트너용)"
      ),
    ],
  },

  // 5. 버그 트래커
  {
    name: "Bug Tracker",
    nameKo: "버그 트래커",
    description: "Bug tracking with severity, status, and reproduction steps",
    descriptionKo: "버그 추적 — 심각도, 상태, 재현 방법",
    icon: "🐛",
    category: "project",
    tags: ["bug", "tracker", "issue", "버그", "이슈"],
    blocks: [
      callout("결제 시스템 v2 버그 트래커 — 미해결: 7건 / 해결: 23건", "🐛"),
      h2("심각도 기준 / Severity Levels"),
      bullet(
        "P0 — 서비스 중단: 즉시 대응 (1시간 이내)",
        "P1 — 주요 기능 장애: 당일 수정",
        "P2 — 기능 이상: 이번 스프린트 내 수정",
        "P3 — 경미한 이슈: 백로그 등록"
      ),
      hr(),
      h2("🔴 미해결 — P1 / Open — P1"),
      h3("BUG-147: iOS Safari에서 카드 번호 입력 시 커서 점프"),
      bullet(
        "심각도: P1 / 상태: 수정 중",
        "보고자: QA 윤서아 / 담당: 이서준",
        "환경: iOS 17.4, Safari, iPhone 15",
        "재현: 카드 번호 필드에 8자리 이상 입력 시 커서가 첫 번째 자리로 이동",
        "원인 추정: IME 이벤트와 포맷팅 로직 충돌",
        "예상 수정일: 4/4"
      ),
      h3("BUG-149: 결제 완료 후 확인 페이지 빈 화면 (간헐적)"),
      bullet(
        "심각도: P1 / 상태: 조사 중",
        "보고자: CS팀 / 담당: 김민수",
        "환경: Chrome 124, Windows 11",
        "재현: 결제 완료 후 리다이렉트 시 약 5% 확률로 빈 화면 표시",
        "원인 추정: 결제 콜백 URL 파라미터 누락 가능성",
        "예상 수정일: 4/5"
      ),
      hr(),
      h2("🟡 미해결 — P2 / Open — P2"),
      h3("BUG-151: 결제 내역 날짜 필터 '이번 달' 선택 시 범위 오류"),
      bullet(
        "심각도: P2 / 상태: 대기",
        "환경: 전체 브라우저",
        "재현: 4월 1일에 '이번 달' 필터 선택 시 3월 데이터가 포함됨",
        "담당: 미배정"
      ),
      h3("BUG-152: 대시보드 차트 툴팁이 모바일에서 잘림"),
      bullet(
        "심각도: P2 / 상태: 대기",
        "환경: 화면 너비 375px 이하",
        "담당: 정다은"
      ),
      hr(),
      h2("🟢 미해결 — P3 / Open — P3"),
      bullet(
        "BUG-155: 결제 수단 선택 라디오 버튼 포커스 링 미표시 — 접근성",
        "BUG-156: 영수증 PDF 다운로드 시 파일명에 특수문자 포함",
        "BUG-157: 다크모드에서 카드사 로고 배경 투명 처리 미적용"
      ),
      hr(),
      h2("최근 해결 / Recently Resolved ✅"),
      bullet(
        "BUG-145: 결제 금액 소수점 반올림 오류 — 해결 (4/1) — 김민수",
        "BUG-144: 결제 취소 시 404 에러 — 해결 (3/31) — 박지영",
        "BUG-143: 중복 결제 요청 방지 debounce 미적용 — 해결 (3/30) — 김민수"
      ),
      hr(),
      h2("버그 보고 방법 / How to Report"),
      p("버그 발견 시 아래 정보를 포함하여 이 문서에 추가하거나 Jira에 등록해주세요."),
      numbered(
        "심각도 (P0~P3)",
        "재현 환경 (OS, 브라우저, 디바이스)",
        "재현 단계 (step by step)",
        "기대 결과 vs 실제 결과",
        "스크린샷 또는 영상 (가능한 경우)"
      ),
    ],
  },

  // 6. 릴리스 계획
  {
    name: "Release Plan",
    nameKo: "릴리스 계획",
    description: "Release planning with checklist and rollout strategy",
    descriptionKo: "릴리스 계획 — 체크리스트 및 배포 전략",
    icon: "🚀",
    category: "project",
    tags: ["release", "deploy", "launch", "릴리스", "배포"],
    blocks: [
      callout("결제 시스템 v2.0 릴리스 계획 — 목표일: 2026-06-16", "🚀"),
      h2("릴리스 개요 / Release Overview"),
      bullet(
        "버전: v2.0.0",
        "코드네임: Phoenix",
        "릴리스 유형: Major Release",
        "영향 범위: 전체 결제 플로우, 결제 대시보드"
      ),
      hr(),
      h2("포함 기능 / Features Included"),
      p("이번 릴리스에 포함되는 주요 기능 목록입니다."),
      tasks(
        "카드 원클릭 결제 플로우 [PAY-201~202]",
        "카카오페이 / 네이버페이 간편결제 [PAY-220~221]",
        "글로벌 결제: PayPal [PAY-222]",
        "모바일 반응형 결제 대시보드 [DASH-105~107]",
        "결제 완료 이메일 알림 [NOTI-301]",
        "결제 내역 조회 및 통계 API [PAY-203, DASH-110]"
      ),
      hr(),
      h2("배포 전략 / Rollout Strategy"),
      p("점진적 배포(Canary Release)로 리스크를 최소화합니다."),
      numbered(
        "6/16 (월): 내부 직원 대상 배포 (100명) — 1일 모니터링",
        "6/17 (화): 트래픽 5% 카나리 배포 — 에러율, 전환율 모니터링",
        "6/18 (수): 트래픽 25% 확대 — 성능 지표 확인",
        "6/19 (목): 트래픽 50% 확대 — CS 문의 추이 확인",
        "6/20 (금): 전체 100% 롤아웃 완료"
      ),
      hr(),
      h2("릴리스 전 체크리스트 / Pre-Release Checklist"),
      p("릴리스 일주일 전까지 모든 항목을 완료해야 합니다."),
      tasks(
        "전체 기능 QA 완료 및 사인오프",
        "성능 테스트 완료 — 동시 사용자 10,000명 기준 응답 시간 2초 이내",
        "보안 감사 완료 — PCI DSS 체크리스트 통과",
        "로드 테스트 — 블랙프라이데이급 트래픽 시뮬레이션",
        "롤백 플랜 테스트 — 5분 이내 이전 버전 복구 확인",
        "모니터링 대시보드 설정 (Grafana, Sentry, CloudWatch)",
        "릴리스 노트 작성 완료",
        "CS팀 교육 완료 — 변경사항 및 FAQ 공유",
        "마케팅팀 공지 준비 완료 — 이메일, 인앱 배너"
      ),
      hr(),
      h2("릴리스 당일 순서 / Release Day Runbook"),
      numbered(
        "09:00 — 릴리스 팀 전원 온라인 확인 (Slack #release-v2)",
        "09:30 — DB 마이그레이션 실행 (다운타임 없는 마이그레이션)",
        "10:00 — 카나리 배포 시작 (5%)",
        "10:30 — 핵심 지표 1차 확인 (에러율, 결제 성공률)",
        "12:00 — 2차 확인 후 25% 확대 결정",
        "15:00 — 50% 확대 (문제 발생 시 이 시점에서 롤백 판단)",
        "18:00 — 당일 최종 리뷰 및 다음날 100% 롤아웃 결정"
      ),
      hr(),
      h2("롤백 계획 / Rollback Plan"),
      p("문제 발생 시 즉시 이전 버전으로 복구할 수 있어야 합니다."),
      bullet(
        "롤백 기준: 에러율 1% 초과 또는 결제 성공률 95% 미만",
        "롤백 소요 시간: 5분 이내 (ECS 블루-그린 배포)",
        "DB 롤백: 하위 호환 마이그레이션으로 롤백 불필요",
        "롤백 담당: 김민수 (1차) / 박지영 (백업)"
      ),
    ],
  },

  // 7. 프로젝트 대시보드
  {
    name: "Project Dashboard",
    nameKo: "프로젝트 대시보드",
    description: "At-a-glance project status dashboard",
    descriptionKo: "프로젝트 현황 한눈에 보기 대시보드",
    icon: "📊",
    category: "project",
    tags: ["dashboard", "status", "overview", "대시보드", "현황"],
    blocks: [
      callout("결제 시스템 v2 프로젝트 대시보드 — 2026-04-02 기준", "📊"),
      h2("전체 현황 / Overall Status"),
      p("🟢 일정: 정상 궤도 | 🟡 예산: 주의 (87% 소진) | 🟢 품질: 양호"),
      hr(),
      h2("진행률 / Progress"),
      bullet(
        "전체 진행률: ████████░░ 65%",
        "Phase 1 (설계): ██████████ 100% ✅",
        "Phase 2 (개발): ██████░░░░ 60% 🔵",
        "Phase 3 (QA): ░░░░░░░░░░ 0% ⬜",
        "Phase 4 (베타): ░░░░░░░░░░ 0% ⬜",
        "Phase 5 (출시): ░░░░░░░░░░ 0% ⬜"
      ),
      hr(),
      h2("스프린트 현황 / Sprint Status"),
      p("Sprint 15 (4/6 ~ 4/17) — 진행 중"),
      bullet(
        "배정: 44 SP / 완료: 12 SP / 남은: 32 SP",
        "번다운 상태: 약간 뒤처짐 (1.5일 지연 추세)",
        "블로커: 1건 (PG사 sandbox 이슈)"
      ),
      hr(),
      h2("핵심 지표 / Key Metrics"),
      h3("개발 효율"),
      bullet(
        "PR 평균 리뷰 시간: 18시간 (목표: 24h ✅)",
        "CI 평균 실행 시간: 9분 (목표: 6min ❌)",
        "코드 커버리지: 72% (목표: 70% ✅)",
        "배포 빈도: 주 8회 (스테이징 + 프로덕션)"
      ),
      h3("품질"),
      bullet(
        "미해결 버그: 7건 (P1: 2 / P2: 2 / P3: 3)",
        "기술 부채 항목: 12건 (이번 분기 목표: 8건 이하)",
        "테스트 통과율: 98.5%"
      ),
      hr(),
      h2("리스크 요약 / Risk Summary"),
      bullet(
        "🔴 높음: 1건 — PG사 API 안정성 (대응 중)",
        "🟡 보통: 2건 — 디자인 확정(해소), PCI 감사(진행 중)",
        "🟢 낮음: 1건 — 브라우저 호환성"
      ),
      hr(),
      h2("예산 현황 / Budget"),
      bullet(
        "총 예산: 2억 4,000만원",
        "집행: 2억 880만원 (87%)",
        "잔여: 3,120만원",
        "주요 지출: 인건비 78%, 인프라 12%, 외부 서비스 7%, 기타 3%"
      ),
      hr(),
      h2("다음 마일스톤 / Next Milestone"),
      p("Phase 2 완료 — 2026-04-30"),
      tasks(
        "카드 결제 플로우 프로덕션 배포",
        "간편결제 연동 개발 착수",
        "모바일 대시보드 QA 완료"
      ),
    ],
  },

  // 8. 마일스톤 트래커
  {
    name: "Milestone Tracker",
    nameKo: "마일스톤 트래커",
    description: "Track project milestones with status and deliverables",
    descriptionKo: "프로젝트 마일스톤 추적 — 상태 및 산출물",
    icon: "🏁",
    category: "project",
    tags: ["milestone", "tracker", "deadline", "마일스톤", "추적"],
    blocks: [
      callout("결제 시스템 v2 마일스톤 트래커 — 총 8개 마일스톤 / 완료 3개", "🏁"),
      h2("마일스톤 목록 / Milestone List"),
      p("각 마일스톤의 상태, 기한, 산출물을 추적합니다."),
      hr(),
      h2("M1: 프로젝트 킥오프 ✅"),
      bullet(
        "기한: 2026-03-03 / 완료: 2026-03-03",
        "상태: 완료",
        "산출물: 프로젝트 헌장, 팀 구성, 커뮤니케이션 계획"
      ),
      hr(),
      h2("M2: 기술 설계 완료 ✅"),
      bullet(
        "기한: 2026-03-14 / 완료: 2026-03-13",
        "상태: 완료 (1일 앞당김)",
        "산출물: 시스템 아키텍처 문서, API 스펙 v1, DB 스키마 설계"
      ),
      hr(),
      h2("M3: 프로토타입 검증 ✅"),
      bullet(
        "기한: 2026-03-28 / 완료: 2026-03-28",
        "상태: 완료",
        "산출물: 결제 플로우 프로토타입, 사용자 테스트 결과 (12명 참여, 만족도 4.2/5)"
      ),
      hr(),
      h2("M4: 핵심 결제 기능 개발 완료 🔵"),
      bullet(
        "기한: 2026-04-25",
        "상태: 진행 중 (60%)",
        "산출물 (예정): 카드 결제 API, 결제 UI, 단위/통합 테스트"
      ),
      tasks(
        "카드 결제 플로우 구현 — 80% 완료",
        "결제 실패 재시도 — 0% (이번 주 착수)",
        "결제 내역 API — 30% 완료",
        "모바일 대시보드 — 70% 완료"
      ),
      hr(),
      h2("M5: 간편결제 연동 완료 ⬜"),
      bullet(
        "기한: 2026-05-16",
        "상태: 예정",
        "산출물: 카카오페이, 네이버페이, PayPal 연동 완료"
      ),
      hr(),
      h2("M6: QA 완료 및 사인오프 ⬜"),
      bullet(
        "기한: 2026-06-06",
        "상태: 예정",
        "산출물: QA 리포트, 성능 테스트 결과, 보안 감사 보고서"
      ),
      hr(),
      h2("M7: 베타 릴리스 ⬜"),
      bullet(
        "기한: 2026-06-13",
        "상태: 예정",
        "산출물: 베타 버전, 내부 사용자 피드백, 모니터링 대시보드"
      ),
      hr(),
      h2("M8: 정식 출시 (GA) ⬜"),
      bullet(
        "기한: 2026-06-20",
        "상태: 예정",
        "산출물: v2.0 정식 릴리스, 릴리스 노트, CS 교육 자료"
      ),
      hr(),
      h2("마일스톤 건강도 / Health Summary"),
      p("전체적으로 일정 정상 궤도. M4 내 결제 재시도 로직 착수가 관건입니다."),
      bullet(
        "일정 준수율: 3/3 (100%) — 지금까지 지연 없음",
        "다음 마일스톤까지: 23일 (M4: 4/25)"
      ),
    ],
  },

  // 9. 이해관계자 맵
  {
    name: "Stakeholder Map",
    nameKo: "이해관계자 맵",
    description: "Stakeholder identification, influence, and communication plan",
    descriptionKo: "이해관계자 식별, 영향력, 커뮤니케이션 계획",
    icon: "👥",
    category: "project",
    tags: ["stakeholder", "communication", "이해관계자", "소통"],
    blocks: [
      callout("결제 시스템 v2 이해관계자 맵 — 핵심 이해관계자 12명", "👥"),
      h2("이해관계자 분류 기준 / Classification"),
      p("영향력(Power)과 관심도(Interest)에 따라 4분면으로 분류합니다."),
      bullet(
        "높은 영향력 + 높은 관심: 적극 관리 (Manage Closely)",
        "높은 영향력 + 낮은 관심: 만족 유지 (Keep Satisfied)",
        "낮은 영향력 + 높은 관심: 정보 공유 (Keep Informed)",
        "낮은 영향력 + 낮은 관심: 모니터링 (Monitor)"
      ),
      hr(),
      h2("적극 관리 / Manage Closely"),
      p("프로젝트의 성패에 직접적 영향을 미치는 핵심 이해관계자입니다."),
      h3("강태호 — CTO"),
      bullet(
        "역할: 최종 기술 의사결정자, 예산 승인",
        "관심사: 기술 아키텍처 방향, 보안, 시스템 안정성",
        "소통 방식: 격주 1:1 (30분) + 월간 서면 리포트",
        "담당: 김민수 (Tech Lead)"
      ),
      h3("이수현 — 프로젝트 PM"),
      bullet(
        "역할: 일정 관리, 이해관계자 조율, 예산 집행",
        "관심사: 일정 준수, 리스크 관리, 팀 간 의존성",
        "소통 방식: 주간 1:1 + 데일리 Slack 업데이트",
        "담당: 김민수"
      ),
      h3("오세진 — 커머스사업부장"),
      bullet(
        "역할: 비즈니스 요구사항 최종 승인, KPI 설정",
        "관심사: 결제 전환율, 매출 영향, 고객 만족도",
        "소통 방식: 월간 프로젝트 리뷰 미팅 (1시간)",
        "담당: 이수현 (PM)"
      ),
      hr(),
      h2("만족 유지 / Keep Satisfied"),
      h3("정보안팀 (CISO 직속)"),
      bullet(
        "역할: 보안 감사 및 컴플라이언스 승인",
        "관심사: PCI DSS 준수, 개인정보 보호, 취약점 관리",
        "소통 방식: 보안 감사 시 집중 소통 + 월간 보안 리포트",
        "담당: 김민수"
      ),
      h3("인프라팀"),
      bullet(
        "역할: 서버, DB, 네트워크 인프라 지원",
        "관심사: 리소스 사용량, 비용, 장애 영향",
        "소통 방식: 필요 시 Slack 요청 + 스프린트 플래닝 초대",
        "담당: 박지영"
      ),
      hr(),
      h2("정보 공유 / Keep Informed"),
      bullet(
        "CS팀 (팀장: 권미라) — 고객 응대 변경사항 교육 필요 — 릴리스 2주 전 교육",
        "마케팅팀 (팀장: 신예진) — 런칭 캠페인 준비 — 릴리스 3주 전 공지",
        "QA팀 (윤서아) — 테스트 계획 및 실행 — 주간 싱크",
        "디자인팀 (한유진) — UX 설계 피드백 — 스프린트 단위 리뷰"
      ),
      hr(),
      h2("모니터링 / Monitor"),
      bullet(
        "법무팀 — 약관 변경 시 검토 (현재 변경 없음)",
        "재무팀 — 정산 시스템 연동 (이번 프로젝트 범위 외)"
      ),
      hr(),
      h2("커뮤니케이션 캘린더 / Communication Calendar"),
      p("정기적으로 수행해야 할 이해관계자 소통 일정입니다."),
      bullet(
        "매주 월요일: PM 주간 상태 리포트 발송 (전체 이해관계자)",
        "격주 수요일: CTO 1:1 미팅",
        "매월 첫째 금요일: 사업부장 프로젝트 리뷰",
        "릴리스 3주 전: 마케팅/CS 사전 브리핑",
        "릴리스 1주 전: 전체 이해관계자 Go/No-Go 미팅"
      ),
    ],
  },

  // 10. 프로젝트 회고
  {
    name: "Project Retrospective",
    nameKo: "프로젝트 회고",
    description: "End-of-project retrospective with outcomes and lessons",
    descriptionKo: "프로젝트 완료 후 전체 회고 — 성과 및 교훈",
    icon: "🔍",
    category: "project",
    tags: ["retro", "project", "postmortem", "회고", "프로젝트"],
    blocks: [
      callout("검색 엔진 마이그레이션 프로젝트 회고 — 2026.01.05 ~ 2026.03.15", "🔍"),
      h2("프로젝트 개요 / Project Summary"),
      p("Elasticsearch 5.x에서 OpenSearch 2.x로의 검색 엔진 마이그레이션 프로젝트입니다."),
      bullet(
        "기간: 2026.01.05 ~ 2026.03.15 (10주)",
        "팀: 백엔드 3명 + 프론트엔드 1명 + DevOps 1명",
        "예산: 1억 2,000만원 (실제: 1억 500만원 — 12.5% 절감)"
      ),
      hr(),
      h2("목표 달성 / Goal Achievement"),
      p("프로젝트 초기 목표 대비 실제 달성 결과를 비교합니다."),
      bullet(
        "✅ OpenSearch 2.x 마이그레이션 완료 — 다운타임 0분 (블루-그린 전환)",
        "✅ 검색 응답 시간 개선 — 평균 450ms → 180ms (60% 개선)",
        "✅ 검색 정확도 향상 — nDCG@10 0.72 → 0.81",
        "🟡 한국어 형태소 분석기 커스텀 사전 구축 — 80% 완료 (5월까지 마무리)",
        "✅ 인프라 비용 절감 — 월 380만원 → 250만원 (34% 절감)"
      ),
      hr(),
      h2("타임라인 리뷰 / Timeline Review"),
      bullet(
        "Phase 1 (1/5~1/23): 분석 및 설계 — 예정대로 완료 ✅",
        "Phase 2 (1/26~2/20): 마이그레이션 개발 — 3일 지연 (인덱스 매핑 이슈)",
        "Phase 3 (2/23~3/6): 병행 운영 및 검증 — 예정대로 완료 ✅",
        "Phase 4 (3/9~3/15): 전환 및 안정화 — 2일 앞당겨 완료 ✅"
      ),
      p("전체 일정: 1일 지연 (원래 3/14 → 실제 3/15) — 허용 범위 내"),
      hr(),
      h2("잘한 점 / What Went Well 🎉"),
      bullet(
        "블루-그린 배포 전략으로 다운타임 제로 전환 달성",
        "병행 운영 기간에 shadow traffic으로 정확도 사전 검증",
        "매주 금요일 이해관계자 데모로 신뢰 구축",
        "기술 문서를 실시간으로 작성하여 인수인계 부담 최소화",
        "팀원 전원 OpenSearch 실무 역량 확보"
      ),
      hr(),
      h2("아쉬운 점 / What Could Improve 😔"),
      bullet(
        "인덱스 매핑 호환성 이슈를 초기에 발견하지 못해 3일 지연",
        "한국어 사전 구축 범위를 과소 추정 — 프로젝트 내 완료 불가",
        "DevOps 담당자 휴가 기간 인프라 작업 병목 발생",
        "성능 테스트를 Phase 3에서야 시작 — 더 일찍 했어야 함"
      ),
      hr(),
      h2("배운 교훈 / Lessons Learned 📖"),
      p("향후 유사 프로젝트에 적용할 교훈입니다."),
      numbered(
        "마이그레이션은 반드시 PoC로 호환성 먼저 검증 — 최소 1주 투자",
        "병행 운영(shadow traffic)은 검색 품질 검증의 필수 단계",
        "핵심 인원 1인에 대한 의존도를 줄이기 위해 크로스 트레이닝 필수",
        "성능 테스트는 개발 초기부터 CI에 포함시켜야 함",
        "이해관계자 주간 데모는 프로젝트 신뢰도를 크게 높임"
      ),
      hr(),
      h2("향후 권장 사항 / Recommendations"),
      tasks(
        "한국어 형태소 분석기 사전 완성 프로젝트 별도 진행 — 5월 완료 목표",
        "OpenSearch 운영 런북 최신화 — DevOps팀 이관",
        "검색 품질 자동 모니터링 대시보드 구축",
        "다음 마이그레이션 시 이 회고 문서를 참고자료로 활용"
      ),
      hr(),
      h2("팀 감사 / Acknowledgements"),
      p("프로젝트에 기여해주신 모든 분들께 감사합니다."),
      bullet(
        "박지영 — 인덱스 설계 및 성능 튜닝 주도",
        "최하늘 — DevOps 파이프라인 및 블루-그린 배포 구축",
        "이서준 — 프론트엔드 검색 UI 최적화",
        "김민수 — 기술 리드 및 아키텍처 의사결정",
        "윤서아 — QA 테스트 및 병행 운영 검증"
      ),
    ],
  },
];
