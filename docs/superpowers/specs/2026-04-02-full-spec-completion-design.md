# Notion Web — Full Spec 100% Completion Design

> 기존 3개 spec(기본 설계 SP-1~10, v2 4-Phase, UX 개선 127항목)의 미구현 기능 전체를 구현하기 위한 통합 설계 문서

## 목차

1. [개요](#개요)
2. [현재 구현 현황](#현재-구현-현황)
3. [서브프로젝트 구조 & 실행 전략](#서브프로젝트-구조--실행-전략)
4. [A. Editor UX 완성](#a-editor-ux-완성)
5. [B. Mobile Responsive](#b-mobile-responsive)
6. [C. Visual Polish & Motion](#c-visual-polish--motion)
7. [D. Template 확장](#d-template-확장)
8. [E. Search & Navigation 강화](#e-search--navigation-강화)
9. [F. Collaboration 강화](#f-collaboration-강화)
10. [G. Database 고급 기능](#g-database-고급-기능)
11. [H. PM Hub 확장 + Time Tracking](#h-pm-hub-확장--time-tracking)
12. [I. Workflows](#i-workflows)
13. [J. Native 서비스 연동](#j-native-서비스-연동)
14. [K. Admin & Security + Offline](#k-admin--security--offline)
15. [L. Infrastructure](#l-infrastructure)

---

## 개요

### 목표
기존 spec 3개 문서에 명시된 모든 기능을 100% 구현하여 프로덕션 수준의 Notion 클론을 완성한다.

### 접근 방식
- **Big Bang Parallel**: 12개 서브프로젝트를 단일 코드베이스에서 병렬 진행
- 의존성 있는 항목만 순서 유지 (A→F, 기존 Automation→I)
- 나머지는 자유 순서로 빠르게 구현

### 기술 스택 (추가)
- `framer-motion`: 애니메이션 시스템
- `reactflow`: 워크플로우 빌더
- `d3-force`: Graph View
- `workbox`: Service Worker / 오프라인
- `idb-keyval`: IndexedDB 캐싱
- `prom-client`: Prometheus 메트릭
- `recharts`: 차트 (번다운, 시간 보고서)
- `swagger-jsdoc` + `swagger-ui-react`: API 문서
- `@slack/web-api`: Slack 연동
- `@octokit/rest`: GitHub 연동
- `googleapis`: Google Calendar 연동
- `resend`: Email 발신

---

## 현재 구현 현황

| 카테고리 | 구현율 | 핵심 미구현 |
|---|---|---|
| 기본 설계 (SP-1~10) | ~88% | 오프라인, MinIO, 일부 AI 고급 기능 |
| v2 Phase 1 (Editor/Mobile) | ~60% | 모바일 반응형 대부분 |
| v2 Phase 2 (Templates/Collab) | ~55% | 템플릿 확장, Suggesting Mode, 검색 페이지 |
| v2 Phase 3 (PM/Automation) | ~35% | Workflows, Time Tracking 전무 |
| v2 Phase 4 (Integration) | ~35% | 외부 서비스 연동 전무, Admin 도구 |
| UX 개선 127항목 | ~45% | 애니메이션, 모바일, 고급 DB 기능 |

### 완전 미구현 (0%) 기능
1. Workflows (다단계 자동화, 분기/대기/승인)
2. Time Tracking (타이머, 시간 보고서)
3. Native 서비스 연동 (Slack, GitHub, Google Calendar, Email)
4. 오프라인 지원 (Service Worker, 로컬 캐시, 동기화 큐)
5. Synced Blocks (실제 동기화 로직)
6. Graph View (백링크 시각화)
7. CI/CD Pipeline
8. Monitoring & Logging 시스템

---

## 서브프로젝트 구조 & 실행 전략

### 12개 서브프로젝트

| # | 서브프로젝트 | 핵심 내용 | 의존성 |
|---|---|---|---|
| A | Editor UX 완성 | Synced Blocks, Focus Mode, Toggle Headings, 애니메이션, 하이라이트 | 없음 |
| B | Mobile Responsive | 터치 제스처, 하단 툴바, 반응형 레이아웃 | 없음 |
| C | Visual Polish & Motion | 페이지 전환, 사이드바 모션, 모달 애니메이션, 다크모드 전환 | 없음 |
| D | Template 확장 | 80개 템플릿, 8카테고리 갤러리, CRUD | 없음 |
| E | Search & Navigation 강화 | 전체 검색 페이지, Graph View, Tabs/Split View | 없음 |
| F | Collaboration 강화 | Suggesting Mode, 인라인 코멘트, 버전 diff, 타이핑 인디케이터 | A (Synced Blocks) |
| G | Database 고급 기능 | Linked DB, Relation/Rollup, Row Templates, DB Lock | 없음 |
| H | PM Hub + Time Tracking | PM 뷰 추가, Sprint, 타이머, 시간 보고서 | 없음 |
| I | Workflows | 다단계 자동화, 분기/대기/승인 | 기존 Automation |
| J | Native 서비스 연동 | Slack, GitHub, Google Calendar, Email | 없음 |
| K | Admin & Security + Offline | 감사 로그, 관리자 도구, RBAC, 오프라인/PWA | 없음 |
| L | Infrastructure | CI/CD, Docker, Prometheus/Grafana/Loki, Swagger | 없음 |

### 실행 순서
의존성만 지키고 나머지는 자유 순서:
- **A → F** (Synced Blocks가 Collaboration 강화에 필요)
- **기존 Automation → I** (Workflows는 기존 엔진 확장)
- 나머지 B, C, D, E, G, H, J, K, L은 독립적

---

## A. Editor UX 완성

### A-1. Synced Blocks

**목적**: 하나의 소스 블록을 여러 페이지에서 참조하고, 소스 변경 시 모든 참조가 실시간으로 동기화되는 기능.

**DB 스키마 변경**:
```prisma
model SyncedBlock {
  id            String   @id @default(cuid())
  sourceBlockId String
  sourcePageId  String
  content       Json     // 소스 블록의 현재 내용
  version       Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sourcePage    Page     @relation(fields: [sourcePageId], references: [id])

  @@index([sourceBlockId])
  @@index([sourcePageId])
}
```

**동기화 메커니즘**:
- 소스 블록 변경 감지: Yjs document update 이벤트 핸들러
- 변경 전파: tRPC subscription으로 모든 참조 블록에 Yjs delta 전파
- 역전파: 참조 블록에서 편집 시 소스 블록에 역으로 변경 적용
- 순환 참조 방지: 동기화 그래프에서 cycle detection (DFS 기반)

**TipTap Extension 재작성** (`synced-block.ts`):
- `NodeView`에서 소스 콘텐츠 렌더링
- `sourceBlockId` attribute로 소스 추적
- 편집 시 소스에 역전파
- 로딩/에러/분리 상태 UI

**tRPC 프로시저**:
- `syncedBlock.create`: 소스 블록에서 synced block 생성
- `syncedBlock.get`: 소스 콘텐츠 조회
- `syncedBlock.detach`: 동기화 해제 (독립 블록으로 전환)
- `syncedBlock.listReferences`: 소스 블록의 모든 참조 목록

### A-2. Focus Mode

**목적**: 현재 작업 중인 블록만 강조하고 나머지를 흐리게 처리하여 집중도를 높이는 기능.

**구현**:
- Zustand store: `useFocusMode` — `{ enabled: boolean, activeNodePos: number | null }`
- ProseMirror Plugin: `selectionUpdate` 이벤트에서 현재 블록 pos 추적
- CSS:
  ```css
  .focus-mode .ProseMirror > *:not(.is-focused) {
    opacity: 0.15;
    transition: opacity 200ms ease;
  }
  .focus-mode .ProseMirror > .is-focused {
    opacity: 1;
  }
  ```
- 토글 단축키: `Cmd+Shift+F`
- 에디터 상단에 "Focus Mode" 인디케이터 표시

### A-3. Toggle Headings

**목적**: Heading 블록에 토글(접기/펴기) 기능을 결합한 블록 타입.

**구현**:
- 기존 `toggle.ts` 확장 → `toggleHeading` 노드 타입 추가
- attributes: `level` (1|2|3), `isOpen` (boolean)
- 렌더링: `<details>` + `<summary>` 안에 heading 스타일 적용
- 클릭으로 내용 접기/펴기
- Slash command에 "Toggle Heading 1/2/3" 추가
- 기존 Heading을 Toggle Heading으로 변환하는 액션 추가

### A-4. 텍스트 하이라이트 & 블록 컬러

**텍스트 하이라이트**:
- TipTap `Highlight` mark 확장: 6색 (yellow, green, blue, pink, purple, red)
- 인라인 툴바에 하이라이트 버튼 추가
- 단축키: `Cmd+Shift+H` → 하이라이트 색상 팝오버, 방향키로 선택

**블록 배경색**:
- 모든 블록 노드에 `backgroundColor` attribute 추가
- 블록 메뉴(드래그 핸들)에 "Color" 서브메뉴
- 6색 배경 + 6색 텍스트 컬러 옵션
- 단축키: 블록 선택 후 `/color` 슬래시 커맨드

### A-5. Table 고급 조작

**구현**:
- 기존 TipTap `Table` 확장에 커스텀 컨트롤 추가
- 행/열 헤더에 `+` 버튼 → 행/열 삽입
- 행/열 선택 → `Backspace`/`Delete`로 삭제
- 열 드래그로 너비 조절
- 행 드래그로 순서 변경
- 우클릭 컨텍스트 메뉴: 위/아래 행 삽입, 좌/우 열 삽입, 행/열 삭제, 셀 병합

### A-6. Formula 인라인 프리뷰

**구현**:
- 데이터베이스 테이블 뷰에서 formula 타입 셀에 계산 결과 인라인 표시
- 호버 시 수식 원문 툴팁 (`title` attribute)
- formula 계산: 서버사이드에서 행 데이터 기반 평가 → 결과 캐싱
- `src/lib/database/formula-engine.ts`: 기존 `formula-editor.tsx`의 24개 함수를 실제 실행하는 엔진

### A-7. Full-width Toggle

**구현**:
- 에디터 컨테이너에 `isFullWidth` 상태 추가
- 토글 시 `max-width` 제거 (기본 720px → 100%)
- 페이지 설정 메뉴 또는 topbar에 토글 버튼
- 페이지별 설정: `Page` 모델에 `isFullWidth` boolean 필드 추가

---

## B. Mobile Responsive

### B-1. 아키텍처

**브레이크포인트**:
- Mobile: `< 768px`
- Tablet: `768px ~ 1023px`
- Desktop: `>= 1024px`

**responsive-provider.tsx 확장**:
- `useMediaQuery` 훅으로 breakpoint 감지
- `isMobile`, `isTablet`, `isDesktop` flags
- `deviceType` context value

**CSS 전략**:
- Tailwind responsive prefixes: `sm:`, `md:`, `lg:`
- 조건부 컴포넌트 렌더링: `{isMobile ? <MobileView /> : <DesktopView />}`

### B-2. 사이드바 반응형

**Mobile**:
- `position: fixed; left: 0; top: 0; z-index: 50`
- Overlay 모드: 배경 dimmer (반투명 검정)
- 스와이프 제스처: 우측 스와이프로 열기, 좌측 스와이프로 닫기
- 열기 threshold: 50px

**Tablet**:
- Collapsible: 아이콘만 표시 (48px 너비) ↔ 전체 표시 (260px)
- 토글 버튼으로 전환

**구현 — `use-touch-gestures.ts`** (신규):
```typescript
interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number // default 50px
  preventScroll?: boolean
}
function useSwipeGesture(ref: RefObject<HTMLElement>, options: SwipeOptions): void
```

### B-3. 하단 플로팅 툴바

**`mobile-toolbar.tsx`** (신규):
- 모바일에서만 렌더링 (`isMobile` 조건)
- 버튼: Bold, Italic, List, Heading, Link, Mention, AI, More(...)
- `position: fixed; bottom: 0; left: 0; right: 0`
- 키보드 올라올 때 `visualViewport` API로 위치 조정
- `More` 버튼: 추가 포맷팅 옵션 시트 (sheet up 애니메이션)

### B-4. 터치 드래그

**`touch-drag-handle.ts`** (신규):
- Long-press (300ms) → drag 모드 진입
- Haptic feedback: `navigator.vibrate(10)`
- `touchstart` → 타이머 시작 → `touchmove`로 블록 위치 계산
- 드롭 인디케이터: 기존 drag-handle 로직 재사용
- `touchend` → 블록 이동 실행

### B-5. 반응형 데이터베이스

- Mobile Table → 카드 리스트 자동 전환 (제목 + 주요 속성 2~3개)
- Mobile Board → 가로 스크롤 칼럼 (한 칼럼씩 스냅)
- Mobile Calendar → 주간 뷰 기본 (월간 뷰는 축소)
- Gallery → 2열 그리드 (데스크톱 3~4열)
- Timeline → 가로 스크롤 + 핀치 줌

### B-6. 반응형 에디터

- Mobile: 풀폭, 좌우 패딩 16px (데스크톱 96px)
- 인라인 툴바: Mobile에서 에디터 하단 고정 (플로팅 대신)
- Slash command: 모바일에서 하프시트 스타일로 표시
- 이미지/임베드: 100% 너비 강제

---

## C. Visual Polish & Motion

### C-1. Framer Motion 통합

**패키지**: `framer-motion` (tree-shaking 최적화)

**공통 variants — `src/lib/motion/variants.ts`**:
```typescript
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 }
}

export const slideUp = {
  initial: { y: 8, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 8, opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' }
}

export const scaleIn = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
  transition: { duration: 0.1 }
}

export const heightAuto = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.2 }
}

export const spring = {
  type: 'spring',
  stiffness: 300,
  damping: 30
}
```

### C-2. 적용 대상 상세

| 대상 | 애니메이션 | 구현 위치 |
|---|---|---|
| 페이지 전환 | fadeIn (150ms) | `(main)/layout.tsx` — `AnimatePresence` + `motion.div` |
| 사이드바 expand/collapse | width spring animation | `sidebar.tsx` — `motion.aside` |
| 모달 | scaleIn + backdrop fade | 모든 Dialog 컴포넌트 |
| 드롭다운/팝오버 | slideUp (100ms) | 모든 Popover/Dropdown 컴포넌트 |
| Toast 스택 | slideUp + 스택 재배치 | `toast-container.tsx` — `motion.li` |
| 블록 삽입/삭제 | heightAuto | 에디터 블록 wrapper |
| 다크모드 전환 | CSS transition 200ms | `globals.css` — `*, *::before, *::after { transition: background-color 200ms, color 200ms }` |
| Hover 일관성 | `transition-colors duration-150` | `tailwind.config.ts` 기본값 |
| Focus ring | `ring-2 ring-blue-500/40 transition-shadow` | 전역 유틸리티 클래스 |
| Loading skeleton | 펄스 애니메이션 통일 | `skeleton.tsx` |
| Selection | 하이라이트 fade-in (100ms) | 블록 selection CSS |
| Scroll-to-top | fadeIn + slideUp | `scroll-to-top.tsx` |

### C-3. 성능 고려사항
- `will-change` 속성 최소화 (active 상태에서만)
- `AnimatePresence` mode="wait"으로 중첩 방지
- `motion.div` 대신 `motion(Component)` 사용 시 forwardRef 확인
- 모바일에서 `prefers-reduced-motion` 미디어 쿼리 존중

---

## D. Template 확장

### D-1. DB 스키마

```prisma
model Template {
  id          String   @id @default(cuid())
  name        String
  nameKo      String   // 한국어 이름
  description String?
  descriptionKo String? // 한국어 설명
  category    TemplateCategory
  icon        String?  // emoji or icon name
  coverImage  String?  // URL
  blocks      Json     // TipTap JSON content
  locale      String   @default("ko") // ko, en
  isBuiltIn   Boolean  @default(true)
  isPublic    Boolean  @default(true)
  createdBy   String?  // userId for custom templates
  usageCount  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator     User?    @relation(fields: [createdBy], references: [id])
}

enum TemplateCategory {
  DOCUMENTS    // 문서
  PERSONAL     // 개인
  TEAM         // 팀
  PROJECT      // 프로젝트
  ENGINEERING  // 엔지니어링
  DESIGN       // 디자인
  MARKETING    // 마케팅
  HR           // HR/인사
}
```

### D-2. 80개 템플릿 카테고리 배분

| 카테고리 | 개수 | 예시 |
|---|---|---|
| 문서 (DOCUMENTS) | 12 | 회의록, 의사결정 기록, 프로젝트 제안서, 보고서, 계약서 초안, 정책 문서, 브레인스토밍, 일일 스탠드업, 회고록, 기술 문서, 제품 요구사항(PRD), 릴리즈 노트 |
| 개인 (PERSONAL) | 10 | 일기, 독서 노트, 목표 트래커, 습관 트래커, 식단 계획, 운동 기록, 여행 계획, 버킷 리스트, 가계부, 학습 노트 |
| 팀 (TEAM) | 10 | 팀 위키, 온보딩 가이드, 팀 OKR, 주간 보고, 팀 핸드북, 팀 일정표, 역할 & 책임, 의사소통 가이드, 팀 회고, 1:1 미팅 노트 |
| 프로젝트 (PROJECT) | 12 | 프로젝트 계획, 로드맵, 간트 차트, 리스크 관리, 스프린트 플래닝, 백로그, 버그 트래커, 릴리즈 계획, 프로젝트 대시보드, 마일스톤 트래커, 이해관계자 맵, 프로젝트 회고 |
| 엔지니어링 (ENGINEERING) | 10 | API 문서, 시스템 아키텍처, 코드 리뷰 체크리스트, 인시던트 보고서, 기술 부채 트래커, 온콜 런북, 배포 체크리스트, RFC 템플릿, 테스트 계획, 성능 벤치마크 |
| 디자인 (DESIGN) | 10 | 디자인 시스템, 사용자 리서치, 페르소나, 사용자 여정 맵, 디자인 스프린트, 와이어프레임 노트, 디자인 피드백, 접근성 체크리스트, 브랜드 가이드, UI 컴포넌트 목록 |
| 마케팅 (MARKETING) | 8 | 콘텐츠 캘린더, 소셜 미디어 계획, 캠페인 트래커, SEO 체크리스트, 뉴스레터 템플릿, 마케팅 보고서, 경쟁사 분석, 고객 피드백 |
| HR (HR) | 8 | 채용 프로세스, 면접 평가, 성과 리뷰, 급여 계획, 복리후생 가이드, 퇴사 체크리스트, 교육 계획, 직원 만족도 조사 |

### D-3. 갤러리 UI 재설계

**`template-gallery.tsx` 재작성**:
- 상단: 카테고리 탭 (가로 스크롤) + 검색 바
- "내 템플릿" 탭 (사용자 커스텀)
- 그리드 레이아웃: 카드형 (커버 이미지 + 아이콘 + 제목 + 설명 + 사용 횟수)
- 카드 클릭 → 미리보기 모달 (블록 렌더링 프리뷰 + "이 템플릿 사용" 버튼)
- 인기순 / 최신순 정렬

### D-4. 템플릿 CRUD

**tRPC 프로시저**:
- `template.list`: 카테고리/검색 필터, 정렬, 페이지네이션
- `template.get`: 단일 템플릿 조회 (미리보기용)
- `template.create`: 현재 페이지를 템플릿으로 저장
- `template.update`: 템플릿 수정 (이름, 설명, 카테고리, 블록)
- `template.delete`: 사용자 커스텀 템플릿 삭제
- `template.duplicate`: 기존 템플릿 복제 → 내 템플릿으로
- `template.incrementUsage`: 사용 횟수 증가

### D-5. Seed Script

**`prisma/seed-templates.ts`**:
- 80개 템플릿의 블록 콘텐츠를 TipTap JSON 형식으로 생성
- 한국어 + 영어 이중 언어
- 각 템플릿에 적절한 아이콘, 커버 이미지 URL, 설명 포함
- `prisma db seed` 시 자동 실행

---

## E. Search & Navigation 강화

### E-1. 전체 검색 페이지

**Route**: `/(main)/[workspaceId]/search/page.tsx`

**기능**:
- 검색 입력: debounce 300ms, 실시간 결과
- 필터:
  - 타입: 페이지 / 데이터베이스 / 태스크 / 블록 내용
  - 날짜 범위: 생성일, 수정일
  - 작성자: 사용자 선택
- 결과 표시: 제목 + 내용 미리보기 (검색어 하이라이트) + 경로
- 무한 스크롤: `@tanstack/react-virtual`
- 빈 상태: 최근 검색어 + 추천 검색어

**서버사이드**:
- PostgreSQL `tsvector` 인덱스 추가 (Page.title, Block.content)
- `ts_rank` 기반 정렬
- `search.fullSearch` tRPC 프로시저: 필터, 페이지네이션, 하이라이트

### E-2. Graph View

**Route**: `/(main)/[workspaceId]/graph/page.tsx`

**구현**:
- `d3-force` 기반 force-directed graph
- 노드: 페이지 (아이콘 + 제목)
- 엣지: 페이지 간 링크 + 백링크
- 인터랙션: 줌/패닝 (d3-zoom), 노드 드래그, 노드 클릭 → 페이지 이동
- 현재 페이지 노드 강조 (다른 색상/크기)
- 고립 노드(링크 없음) 표시 옵션

**데이터**:
- `search.getPageGraph` tRPC 프로시저: 모든 페이지 + 링크 관계 조회
- LinkToPage 블록과 멘션에서 관계 추출

### E-3. Tabs / Split View

**Zustand Store — `useTabStore`**:
```typescript
interface TabState {
  tabs: Tab[]           // { id, pageId, title, icon }
  activeTabId: string
  splitMode: 'none' | 'horizontal'
  splitTabId: string | null
  addTab: (pageId: string) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setSplit: (tabId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
}
```

**UI**:
- 탭 바: topbar 아래에 렌더링, 드래그로 순서 변경
- 중복 페이지 탭 방지 (이미 열린 탭으로 포커스 이동)
- Split: 가로 분할, 드래그로 비율 조절 (기본 50:50)
- 단축키: `Cmd+T` 새 탭, `Cmd+W` 탭 닫기, `Cmd+\` split 토글

### E-4. Navigation History

**기존 `navigation-history.ts` 스토어 활용**:

**UI 추가**:
- Topbar에 ← → 화살표 버튼 (breadcrumb 왼쪽)
- 단축키: `Cmd+[` 뒤로, `Cmd+]` 앞으로
- 히스토리 스택: 최대 50개 유지
- 버튼 비활성화: 스택 끝에서 disabled 스타일

---

## F. Collaboration 강화

> **의존성**: A (Editor UX 완성) 완료 후 진행

### F-1. Suggesting Mode

**목적**: 직접 편집 대신 "제안"으로 변경사항을 기록하고, 페이지 소유자가 수락/거절할 수 있는 모드.

**구현**:
- Yjs 기반 `SuggestionMark`: 변경을 mark로 기록
  - 추가: 녹색 밑줄 + 배경
  - 삭제: 빨간색 취소선
  - 수정: 기존 삭제 + 새 추가
- 모드 토글: 에디터 상단 "편집 / 제안" 스위치
- 사이드바: suggestion 목록 (작성자, 시간, 변경 내용)
- 액션: 개별 수락/거절 + 전체 수락/거절
- 권한: 편집 권한이 없는 사용자에게 자동 Suggesting Mode

### F-2. 인라인 코멘트

**구현**:
- 텍스트 선택 → 플로팅 "💬 코멘트" 버튼
- `CommentMark`: 선택 범위에 노란 하이라이트
- 하이라이트 클릭 → 코멘트 스레드 팝오버
- 기존 `Comment` 모델의 `textFrom`/`textTo` 활용
- Resolve/Unresolve 토글
- Resolved 코멘트 숨기기 옵션

### F-3. 버전 Diff

**tRPC 프로시저 — `history.diff`**:
- 입력: snapshotId1, snapshotId2
- 출력: block-level diff (추가/삭제/수정 블록 목록)
- diff 알고리즘: block ID 기준 매칭 → 텍스트 내용 비교 (`fast-diff`)

**UI — `version-diff-view.tsx`**:
- Side-by-side 레이아웃 (이전 | 이후)
- 추가된 블록: 녹색 배경
- 삭제된 블록: 빨간색 배경
- 수정된 블록: 텍스트 레벨 인라인 diff (추가=녹색, 삭제=빨간색 취소선)

### F-4. 타이핑 인디케이터

**구현**:
- Yjs awareness 확장: `{ isTyping: boolean, typingAt: string }` 필드 추가
- 에디터 input 이벤트 시: `awareness.setLocalState({ isTyping: true })`
- 500ms debounce 후 `false` 설정
- UI: 페이지 하단에 "OO님이 입력 중..." 텍스트 + 타이핑 애니메이션 (점 3개)

### F-5. Follow Mode 강화

**구현**:
- 다른 사용자의 커서/뷰포트 위치 추적 (Yjs awareness)
- "Follow" 버튼: 특정 사용자의 스크롤 위치에 자동 동기화
- 팔로우 중 표시: 상단에 "OO님을 따라가는 중" 배너
- 자신이 스크롤하면 팔로우 해제

### F-6. Comment Emoji Reactions

**DB 변경**:
```prisma
model CommentReaction {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  emoji     String   // "👍", "❤️", "😂", etc.
  createdAt DateTime @default(now())

  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])

  @@unique([commentId, userId, emoji])
}
```

**UI**: 코멘트 하단에 이모지 리액션 칩 + "+" 버튼으로 추가

### F-7. Editing Lock Display

- 페이지 잠금 시 topbar에 🔒 아이콘 + "OO님이 편집 중" 표시
- 잠금 해제 요청 버튼
- 자동 해제: 잠금 사용자가 30분 이상 비활성 시

---

## G. Database 고급 기능

### G-1. Relation Property

**DB 스키마**:
- `Property.config`에 `relationDatabaseId: string` 필드
- 양방향: 대상 DB에 자동으로 역방향 relation property 생성

**셀 에디터**:
- 대상 DB의 행 검색 UI (multi-select 스타일)
- 검색: 대상 DB의 title 속성 기준
- 선택된 관계 행: 칩 형태로 표시, 클릭 시 peek preview

**tRPC**:
- `database.createRelation`: relation property 생성 + 대상 DB에 역방향 생성
- `database.updateRelation`: 관계 추가/삭제

### G-2. Rollup Property

**DB 스키마**:
- `Property.config`에:
  - `relationPropertyId: string` (어떤 relation을 기반으로)
  - `rollupPropertyId: string` (관계된 행의 어떤 속성을)
  - `aggregation: 'sum' | 'count' | 'average' | 'min' | 'max' | 'show_original'`

**계산 엔진**:
- 서버사이드: relation 행 조회 → rollup 속성 값 집계
- 결과 캐싱 (관계 변경 시 invalidate)
- 셀: 읽기 전용, 집계 결과 표시

### G-3. Linked Databases

**구현**:
- "데이터베이스 링크" 블록 타입 (TipTap extension)
- 원본 DB ID 참조, 독립적 뷰/필터/정렬 설정 가능
- 데이터는 원본 DB에서 실시간 읽기
- Slash command: "/Linked Database" → DB 선택 UI

**tRPC**:
- `database.createLinked`: linked DB 생성 (원본 참조 + 커스텀 뷰 설정)
- `database.getLinked`: 원본 데이터 + linked 뷰 설정 조회

### G-4. Row Templates

**DB 스키마**:
```prisma
model RowTemplate {
  id           String   @id @default(cuid())
  databaseId   String
  name         String
  defaultValues Json    // { propertyId: value } 매핑
  createdAt    DateTime @default(now())

  database     Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)
}
```

**UI**:
- "새 행" 버튼 옆 드롭다운: 템플릿 목록
- 템플릿 선택 시 미리 정의된 값으로 행 생성
- 템플릿 관리: 생성/수정/삭제 모달

### G-5. Database Lock

**구현**:
- `Database` 모델에 `isLocked: boolean`, `lockedBy: string?` 필드
- 잠금 시: 셀 편집 불가, 행 추가/삭제 불가, 속성 변경 불가
- UI: 툴바에 🔒 토글 버튼 (admin/owner만 가능)
- 잠금 상태에서 편집 시도 → toast 알림 "이 데이터베이스는 잠겨 있습니다"

### G-6. Totals Row 완성

- 테이블 하단에 집계 행 표시
- 속성별 집계 함수 선택: Count, Sum, Average, Min, Max, Count Empty, Count Not Empty, Percent Empty, Percent Not Empty, Median, Range
- 클릭으로 집계 함수 변경

### G-7. Multiline Cells

- 텍스트 타입 셀에서 `Shift+Enter`로 줄바꿈 입력
- 셀 높이 자동 확장 (auto-grow)
- 행 높이 설정: compact / medium / tall

---

## H. PM Hub 확장 + Time Tracking

### H-1. 프로젝트 뷰 추가

**Timeline (Gantt) View — `project-timeline-view.tsx`**:
- `@tanstack/react-virtual` + SVG 렌더링
- 가로축: 날짜 (일/주/월 스케일 전환)
- 세로축: 태스크 목록
- 막대: 시작일~종료일, 드래그로 날짜 변경
- 의존성 화살표: 태스크 간 선행관계 표시
- 마일스톤: 다이아몬드 마커

**Calendar View — `project-calendar-view.tsx`**:
- 기존 DB calendar-view 재사용 + 프로젝트 컨텍스트
- 태스크를 기한 기준으로 날짜에 배치
- 드래그로 기한 변경

**List View — `project-list-view.tsx`**:
- 체크박스 + 제목 + 상태 뱃지 + 담당자 아바타 + 기한
- 그룹핑: 상태별 / 담당자별 / 우선순위별
- 인라인 편집

### H-2. Sprint 관리

**DB 스키마**:
```prisma
model Sprint {
  id        String       @id @default(cuid())
  projectId String
  name      String
  goal      String?
  startDate DateTime?
  endDate   DateTime?
  status    SprintStatus @default(PLANNING)
  createdAt DateTime     @default(now())

  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks     Task[]
}

enum SprintStatus {
  PLANNING
  ACTIVE
  COMPLETED
}
```

**기능**:
- 스프린트 생성: 이름, 목표, 기간 설정
- 태스크 할당: 백로그에서 스프린트로 태스크 이동 (드래그)
- 스프린트 시작/종료
- 번다운 차트: `recharts` — X축 날짜, Y축 남은 태스크 수/스토리포인트

### H-3. Time Tracking

**DB 스키마**:
```prisma
model TimeEntry {
  id        String    @id @default(cuid())
  taskId    String
  userId    String
  startTime DateTime
  endTime   DateTime?
  duration  Int?      // seconds
  note      String?
  isRunning Boolean   @default(false)
  createdAt DateTime  @default(now())

  task      Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id])
}
```

**타이머 — Zustand Store `useTimerStore`**:
```typescript
interface TimerState {
  activeEntryId: string | null
  activeTaskId: string | null
  startTime: Date | null
  elapsed: number // seconds
  isRunning: boolean
  start: (taskId: string) => Promise<void>
  stop: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
}
```

**UI**:
- 태스크 카드에 ▶️ 시작 버튼
- Topbar에 실행 중 타이머 표시 (HH:MM:SS + 태스크명 + ⏹ 중지)
- 수동 시간 입력: 시작/종료 또는 duration 직접 입력

**시간 보고서 — `/(main)/[workspaceId]/projects/[id]/time-report/page.tsx`**:
- 기간 필터: 일 / 주 / 월
- 사용자별 집계: 이름, 총 시간, 태스크 수
- 프로젝트별 집계: 프로젝트명, 총 시간, 완료율
- 차트: `recharts` 막대 그래프 (일별 시간)

---

## I. Workflows

### I-1. 아키텍처

**비주얼 빌더**: `reactflow` 라이브러리 기반

**노드 타입**:
| 노드 | 설명 | 설정 |
|---|---|---|
| Trigger | 워크플로우 시작점 | 이벤트 타입 선택 |
| Action | 실행할 동작 | 액션 타입 + 파라미터 |
| Condition | 분기 판단 | if/else 조건식 |
| Wait | 대기 | 시간 또는 이벤트 |
| Approval | 승인 대기 | 승인자, 메시지 |
| Loop | 반복 | 컬렉션, 반복 횟수 |
| End | 종료 | 성공/실패 |

### I-2. DB 스키마

```prisma
model Workflow {
  id          String              @id @default(cuid())
  name        String
  description String?
  projectId   String?
  workspaceId String
  nodes       Json                // ReactFlow 노드 배열
  edges       Json                // ReactFlow 엣지 배열
  enabled     Boolean             @default(false)
  createdBy   String
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  workspace   Workspace           @relation(fields: [workspaceId], references: [id])
  creator     User                @relation(fields: [createdBy], references: [id])
  executions  WorkflowExecution[]
}

model WorkflowExecution {
  id            String              @id @default(cuid())
  workflowId    String
  status        ExecutionStatus     @default(PENDING)
  currentNodeId String?
  context       Json                // 실행 컨텍스트 (변수, 중간 결과)
  error         String?
  startedAt     DateTime            @default(now())
  completedAt   DateTime?

  workflow      Workflow            @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  approvals     WorkflowApproval[]
}

model WorkflowApproval {
  id          String          @id @default(cuid())
  executionId String
  nodeId      String
  userId      String
  status      ApprovalStatus  @default(PENDING)
  comment     String?
  respondedAt DateTime?

  execution   WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  user        User              @relation(fields: [userId], references: [id])
}

enum ExecutionStatus {
  PENDING
  RUNNING
  WAITING_APPROVAL
  WAITING_DELAY
  COMPLETED
  FAILED
  CANCELLED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### I-3. 실행 엔진 — `src/lib/workflows/executor.ts`

```typescript
class WorkflowExecutor {
  async execute(workflowId: string, triggerData: any): Promise<void>
  private async processNode(node: WorkflowNode, context: ExecutionContext): Promise<string | null> // returns next node ID
  private async evaluateCondition(condition: ConditionConfig, context: ExecutionContext): Promise<boolean>
  private async executeAction(action: ActionConfig, context: ExecutionContext): Promise<void>
  private async waitForDelay(delay: DelayConfig, executionId: string): Promise<void>
  private async waitForApproval(approval: ApprovalConfig, executionId: string): Promise<void>
  private async handleError(executionId: string, error: Error, retryCount: number): Promise<void>
}
```

**에러 핸들링**:
- 재시도: max 3회, exponential backoff
- 실패 시: 알림 전송 + 실행 상태 FAILED

**Wait 복구**:
- 서버 재시작 시 WAITING 상태인 execution 복구
- DB에 다음 실행 시간 저장 → 스케줄러로 재실행

### I-4. UI

**Route**: `/(main)/[workspaceId]/workflows/page.tsx`

**워크플로우 빌더**:
- ReactFlow canvas: 노드 드래그앤드롭, 엣지 연결
- 좌측 패널: 노드 타입 목록 (드래그로 추가)
- 우측 패널: 선택된 노드의 설정 폼
- 상단: 이름, 저장, 활성화/비활성화, 실행 기록

**실행 히스토리**:
- 실행 목록: 시작 시간, 상태, 소요 시간
- 실행 상세: 각 노드별 실행 결과 + 타임라인
- 디버그: 각 노드에서의 context 스냅샷

---

## J. Native 서비스 연동

### J-1. 공통 아키텍처

**어댑터 패턴 — `src/lib/integrations/`**:
```typescript
interface IntegrationAdapter {
  name: string
  authorize(workspaceId: string): string // returns OAuth URL
  handleCallback(code: string, state: string): Promise<Integration>
  disconnect(integrationId: string): Promise<void>
  getStatus(integrationId: string): Promise<IntegrationStatus>
}
```

**DB 스키마**:
```prisma
model Integration {
  id           String            @id @default(cuid())
  workspaceId  String
  service      IntegrationService
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  config       Json?             // 서비스별 설정 (채널 ID, repo 등)
  status       IntegrationStatus @default(ACTIVE)
  createdBy    String
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  workspace    Workspace         @relation(fields: [workspaceId], references: [id])
  creator      User              @relation(fields: [createdBy], references: [id])
}

enum IntegrationService {
  SLACK
  GITHUB
  GOOGLE_CALENDAR
  EMAIL
}

enum IntegrationStatus {
  ACTIVE
  INACTIVE
  ERROR
  EXPIRED
}
```

**OAuth 콜백 라우트**: `/api/integrations/[service]/callback/route.ts`

### J-2. Slack 연동

**OAuth2 Bot Token flow**:
- Slack App 생성 필요 (Bot Token Scopes: `chat:write`, `commands`, `channels:read`)
- 연결 플로우: 설정 페이지 → "Slack 연결" → OAuth 리다이렉트 → 콜백

**기능**:
- 채널 알림: 페이지 변경, 코멘트, 태스크 할당 시 Slack 채널에 메시지 전송
- 슬래시 커맨드: `/notion search <query>`, `/notion create <title>`
- 채널 선택: 연동 설정에서 알림 받을 채널 선택

**구현**: `src/lib/integrations/slack.ts` — `@slack/web-api` SDK

### J-3. GitHub 연동

**GitHub OAuth App**:
- Scopes: `repo`, `read:org`
- 연결 플로우: 설정 → "GitHub 연결" → OAuth → 콜백

**기능**:
- 이슈 ↔ 태스크 동기화: GitHub 이슈 생성 시 Notion 태스크 자동 생성 (양방향)
- PR 멘션 알림: PR에서 Notion 페이지 링크 시 알림
- 커밋 → 활동 로그: 커밋 메시지에서 태스크 ID 감지 → 활동 기록
- Repository 선택: 연동 설정에서 모니터링할 repo 선택

**구현**: `src/lib/integrations/github.ts` — `@octokit/rest` SDK
**Webhook**: `/api/integrations/github/webhook/route.ts` — GitHub webhook 이벤트 수신

### J-4. Google Calendar 연동

**OAuth2 + Calendar API v3**:
- Scopes: `calendar.events`, `calendar.readonly`
- 연결 플로우: 설정 → "Google Calendar 연결" → OAuth → 콜백

**양방향 동기화**:
- Notion → GCal: 기한이 있는 태스크/이벤트를 GCal에 생성
- GCal → Notion: GCal 이벤트 변경 시 Notion 업데이트
- 동기화 주기: Google Calendar `watch` API로 변경 감지 (push notification)

**구현**: `src/lib/integrations/google-calendar.ts` — `googleapis` SDK

### J-5. Email 연동

**발신 — Resend SDK**:
- 알림 이메일: 멘션, 코멘트, 초대, 태스크 할당
- 다이제스트: 일일/주간 활동 요약 이메일
- 템플릿: HTML 이메일 템플릿 (Notion 스타일)

**수신 — Webhook 기반**:
- 이메일 → 페이지 변환: 특정 주소로 보낸 이메일을 페이지로 자동 생성
- Resend inbound webhook 또는 Mailgun routes

**구현**: `src/lib/integrations/email.ts`

### J-6. 연동 관리 UI

**Route**: 기존 설정 페이지에 "연동" 섹션 추가

**UI**:
- 서비스별 카드: 로고 + 이름 + 상태 + 연결/해제 버튼
- 설정: 서비스별 세부 설정 (채널, repo, 캘린더 선택 등)
- 상태 표시: Active (녹색), Error (빨간색), Expired (노란색)

---

## K. Admin & Security + Offline

### K-1. 감사 로그 대시보드

**Route**: `/(main)/[workspaceId]/settings/audit-log/page.tsx`

**기능**:
- 기존 `ActivityLog` 모델 활용
- 필터: 액션 타입, 사용자, 날짜 범위
- 검색: 액션 설명 전문 검색
- 테이블: 시간, 사용자, 액션, 대상, IP, 상세
- 내보내기: CSV 다운로드
- 그래프: 일별 활동량 차트 (`recharts` AreaChart)

### K-2. 관리자 대시보드

**Route**: `/(main)/[workspaceId]/settings/admin/page.tsx`

**위젯**:
- 총 사용자 수 + 활성 사용자 (최근 7일)
- 총 페이지 수 + 최근 생성 페이지
- 스토리지 사용량 (업로드된 파일 총 용량)
- 활성 세션 수
- 최근 활동 타임라인

**사용자 관리**:
- 사용자 목록: 이름, 이메일, 역할, 마지막 활동, 상태
- 액션: 역할 변경, 비활성화/활성화, 초대 취소

### K-3. RBAC 확장

**DB 스키마**:
```prisma
model Role {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?
  permissions Json     // { "pages.create": true, "pages.delete": false, ... }
  isBuiltIn   Boolean  @default(false)
  createdAt   DateTime @default(now())

  workspace   Workspace        @relation(fields: [workspaceId], references: [id])
  members     WorkspaceMember[]
}
```

**기본 역할 (isBuiltIn: true)**:
- Owner: 모든 권한
- Admin: 멤버 관리 + 설정 변경
- Editor: 페이지/DB 생성/편집
- Viewer: 읽기만
- Guest: 초대된 페이지만

**권한 매트릭스 UI**:
- 그리드: 행=권한 카테고리, 열=역할
- 체크박스로 개별 권한 토글
- 커스텀 역할 생성/수정/삭제

### K-4. 오프라인 지원

**Service Worker — Workbox**:
- `next-pwa` 또는 커스텀 Workbox 설정
- 캐싱 전략:
  - 정적 자산 (JS, CSS, 이미지): Cache First
  - API 응답: Network First + fallback to cache
  - HTML 페이지: Stale While Revalidate

**IndexedDB 캐싱**:
- `idb-keyval` 라이브러리
- 최근 방문 페이지 50개 + 블록 데이터 캐시
- 캐시 키: `page:{pageId}`, `blocks:{pageId}`
- TTL: 7일 (자동 정리)

**편집 큐 — `src/lib/offline/sync-queue.ts`**:
```typescript
interface SyncQueueItem {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'page' | 'block' | 'comment'
  data: any
  timestamp: number
  retryCount: number
}

class SyncQueue {
  async enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void>
  async processQueue(): Promise<void>  // 온라인 복귀 시 호출
  async getQueueSize(): Promise<number>
  async clearQueue(): Promise<void>
}
```

**충돌 해결**:
- Yjs CRDT 기반 자동 머지 (대부분의 경우)
- 해결 불가 시 UI 알림 → 사용자 선택 (로컬 / 서버)

**오프라인 상태 UI**:
- 상단 배너: "오프라인 상태입니다. 변경사항은 저장되어 온라인 시 동기화됩니다."
- 동기화 큐 카운터: "N개의 변경사항 대기 중"
- 온라인 복귀 시: "동기화 중..." → "동기화 완료" toast

**PWA**:
- `manifest.json`: 앱 이름, 아이콘, 테마 색상, 디스플레이 모드
- 설치 프롬프트: `beforeinstallprompt` 이벤트 감지 → 설치 안내 배너
- 아이콘: 192x192, 512x512 PNG

---

## L. Infrastructure

### L-1. GitHub Actions CI/CD

**`.github/workflows/ci.yml`**:
```yaml
name: CI/CD
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build-and-deploy:
    needs: [lint, type-check, test]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:latest .
          echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/${{ github.repository }}:latest
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /app/notion-web
            docker-compose pull
            docker-compose up -d
```

### L-2. Docker Compose 확장

**`docker-compose.yml` 확장**:
```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/repo/notion-web:latest
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: notion
      POSTGRES_USER: notion
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  hocuspocus:
    image: ghcr.io/repo/notion-web:latest
    command: node dist/server/collaboration/start-server.js
    ports:
      - "1234:1234"
    env_file: .env
    depends_on:
      - postgres
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml
      - promdata:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafdata:/var/lib/grafana
      - ./infra/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./infra/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    volumes:
      - lokidata:/loki
    ports:
      - "3100:3100"
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./infra/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log
    restart: unless-stopped

volumes:
  pgdata:
  promdata:
  grafdata:
  lokidata:
```

### L-3. 앱 메트릭

**`prom-client` 통합**:
- `src/lib/metrics.ts`:
  - HTTP 요청 수 (method, route, status)
  - HTTP 요청 지연 (histogram)
  - tRPC 프로시저 실행 시간
  - WebSocket 연결 수
  - 에러 수 (type)
- `/api/metrics/route.ts`: Prometheus scrape 엔드포인트

### L-4. Grafana 프리셋 대시보드

**`infra/grafana/dashboards/`**:
- `app-performance.json`: 요청량, P50/P95/P99 지연, 에러율, 동시 사용자
- `database.json`: 쿼리 수, 슬로우 쿼리, 커넥션 풀 사용량
- `collaboration.json`: WebSocket 연결 수, 문서 동시 편집 수

### L-5. Swagger API 문서

- `swagger-jsdoc`: 기존 v1 API 라우트에 JSDoc 주석으로 OpenAPI 스펙 생성
- `swagger-ui-react`: `/api/docs` 라우트에서 인터랙티브 UI 제공
- 자동 생성: request/response body 스키마, 인증 방식, 에러 코드

---

## 기존 Spec UX 개선 항목 매핑

이 설계에서 커버하지 않은 UX 개선 127항목 중 잔여 항목과 매핑:

| UX 항목 | 서브프로젝트 매핑 |
|---|---|
| 에디터 코어 (Focus Mode, Synced Blocks, Toggle Headings 등) | **A** |
| 텍스트 하이라이트, 블록 컬러, Full-width | **A** |
| Table 고급 조작, Formula 프리뷰 | **A** |
| 사이드바 모션, 네비게이션 히스토리 | **C + E** |
| Tabs/Split View, Graph View | **E** |
| 데이터베이스 고급 (Linked DB, Relation, Rollup 등) | **G** |
| 인라인 코멘트, 타이핑 인디케이터, Follow Mode | **F** |
| 페이지 전환 애니메이션, 모달 애니메이션 등 | **C** |
| 템플릿 시스템 | **D** |
| PWA, 오프라인 | **K** |
| CI/CD, Monitoring | **L** |
| 모바일 반응형 | **B** |
| Micro-interactions (더블클릭, Cmd+A 등) | **A** (에디터 확장에 포함) |
| Accessibility (a11y) | **B + C** (반응형 + 포커스 링 등) |
| Virtual scrolling (페이지 레벨) | **C** (성능 최적화 포함) |
| Optimistic updates | **C** (UX 개선 포함) |
| Dark mode auto-switch | **C** |
| Data backup & restore UI | **K** |

모든 127개 항목이 12개 서브프로젝트에 매핑됩니다.
