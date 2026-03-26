# Notion Clone - 전체 설계 문서

## 1. 프로젝트 개요

팀 내부용 Notion 클론. 노션의 모든 기능과 UI를 픽셀 단위로 동일하게 구현하여 자체 서버에 배포한다.

### 핵심 원칙

- **UI 완전 동일:** 노션과 픽셀 단위로 동일한 UI. DevTools에서 추출한 정확한 CSS 값 적용. 애니메이션, 트랜지션, 호버 상태 모두 포함.
- **모바일 반응형:** 노션 웹 모바일 뷰와 동일한 반응형 레이아웃.
- **키보드 단축키 전체 지원:** 노션의 모든 키보드 단축키를 동일하게 구현.
- **다국어:** 한국어/영어 최소 지원 (i18n 인프라).

### 요구사항 요약

| 항목 | 결정 |
|------|------|
| 팀 규모 | 16명 이상 |
| 배포 | 온프레미스 자체 서버 |
| 기능 범위 | 노션 전 기능 (문서 + DB + 프로젝트 관리) |
| 실시간 협업 | 동시 편집 + 커서 표시 (노션 동일) |
| 인증 | 자체 회원가입/로그인 |
| AI | GPT-5.4 기반 인라인 AI 어시스턴트 |
| 외부 연동 | REST API + MCP 서버 (양방향) |

---

## 2. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 14 | App Router, Server Components |
| 언어 | TypeScript | strict mode |
| 스타일링 | Tailwind CSS + CSS Modules | 노션 정확한 값 적용을 위해 CSS Modules 병행 |
| 상태관리 | Zustand | 경량, 최소 보일러플레이트 |
| DB | PostgreSQL 16 | 블록 데이터 JSON 저장에 강점 |
| ORM | Prisma | 타입 안전, 마이그레이션 관리 |
| API | tRPC v11 | E2E 타입 안전, Next.js 통합 |
| 인증 | NextAuth.js v5 | Credentials Provider |
| 실시간 | Yjs + Hocuspocus | CRDT 기반 동시 편집 |
| 파일 저장 | MinIO | 온프레미스 S3 호환 오브젝트 스토리지 |
| 검색 | PostgreSQL Full-text Search | pg_trgm 확장 활용 |
| AI | OpenAI GPT-5.4 API | 인라인 AI 어시스턴트 |
| i18n | next-intl | 한국어/영어 |
| 패키지 매니저 | pnpm | 모노레포 대응 |

---

## 3. 프로젝트 구조

```
notion-web/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # 로그인/회원가입
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (main)/                 # 인증 후 메인
│   │   │   └── [workspaceId]/
│   │   │       └── [pageId]/
│   │   ├── api/
│   │   │   ├── trpc/               # tRPC 핸들러
│   │   │   └── ai/                 # AI 스트리밍 엔드포인트
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # 기본 UI (버튼, 인풋, 모달, 토스트 등)
│   │   ├── layout/                 # 사이드바, 탑바, 브레드크럼
│   │   ├── editor/                 # 블록 에디터
│   │   ├── database/               # DB 뷰 컴포넌트
│   │   └── ai/                     # AI 어시스턴트 UI
│   ├── server/
│   │   ├── routers/                # tRPC 라우터
│   │   ├── db/                     # Prisma 클라이언트
│   │   ├── auth/                   # 인증 로직
│   │   └── ai/                     # AI 서비스 레이어
│   ├── lib/
│   │   ├── shortcuts/              # 키보드 단축키 시스템
│   │   ├── i18n/                   # 다국어 설정
│   │   └── utils/                  # 유틸리티
│   ├── stores/                     # Zustand 스토어
│   ├── styles/                     # 글로벌 스타일, 노션 디자인 토큰
│   └── types/                      # 공유 타입 정의
├── prisma/
│   └── schema.prisma
├── public/
│   └── locales/                    # 번역 파일
├── mcp-server/                     # MCP 서버 패키지
│   ├── src/
│   └── package.json
└── package.json
```

---

## 4. 서브 프로젝트 상세

### SP-1: 프로젝트 기반 셋업

프로젝트 초기화부터 인증, 기본 레이아웃까지 전체 기반을 구축한다.

#### 4.1.1 DB 스키마 (코어)

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  password    String   // bcrypt hash
  avatarUrl   String?
  locale      String   @default("ko")
  theme       String   @default("system") // system | light | dark
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships WorkspaceMember[]
  sessions    Session[]
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  icon      String?  // emoji or URL
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   WorkspaceMember[]
  pages     Page[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  userId      String
  workspaceId String
  role        Role     @default(MEMBER) // OWNER, ADMIN, MEMBER, GUEST
  joinedAt    DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id])
  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@unique([userId, workspaceId])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  GUEST
}
```

#### 4.1.2 인증 플로우

- **회원가입:** 이메일 + 비밀번호(bcrypt) → User 생성 → 기본 Workspace 자동 생성 → 세션 발급
- **로그인:** 이메일 + 비밀번호 검증 → JWT 세션 (HttpOnly 쿠키)
- **세션 관리:** 자동 갱신, 만료 시 로그인 리다이렉트
- **로그아웃:** 세션 삭제 + 쿠키 제거

#### 4.1.3 기본 레이아웃

노션과 동일한 3단 구조:
- **사이드바 (280px, 드래그 리사이즈):** 워크스페이스 스위처, 빠른 검색, 페이지 트리, 설정/멤버, 휴지통
- **메인 영역:** 탑바(브레드크럼 + 공유/더보기 버튼) + 스크롤 가능한 콘텐츠
- **커맨드 팔레트:** Cmd+K로 열리는 전역 검색/명령 팔레트
- 사이드바 접기/펼치기 애니메이션 포함
- 다크/라이트 모드: 시스템 연동 + 수동 전환

#### 4.1.4 키보드 단축키 시스템

- 전역 단축키 매니저 (Cmd+K, Cmd+P, Cmd+\\ 등)
- 컨텍스트 기반: 에디터 내, 사이드바, 모달 등 상태에 따라 다른 동작
- 단축키 도움말 패널 (Cmd+/)

#### 4.1.5 토스트/알림 UI

- 화면 하단 중앙에 토스트 메시지
- 성공, 에러, 정보, 경고 타입
- 자동 사라짐 + 수동 닫기
- Undo 액션 지원 (삭제 취소 등)

#### 4.1.6 설정 페이지

- 내 계정: 프로필, 이메일, 비밀번호 변경, 언어, 테마
- 워크스페이스: 이름, 아이콘, 멤버 관리, 역할 변경
- 플랜/결제: 향후 확장 가능한 빈 페이지

---

### SP-2: 블록 에디터 코어

노션의 핵심 기능. 모든 콘텐츠는 블록(Block) 단위로 구성된다.

#### 4.2.1 블록 데이터 모델

```prisma
model Page {
  id          String   @id @default(cuid())
  workspaceId String
  parentId    String?  // 하위 페이지 지원
  title       String   @default("")
  icon        String?  // emoji or custom
  cover       String?  // cover image URL
  isTemplate  Boolean  @default(false)
  isDeleted   Boolean  @default(false)
  deletedAt   DateTime?
  createdBy   String
  lastEditedBy String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  parent    Page?     @relation("PageTree", fields: [parentId], references: [id])
  children  Page[]    @relation("PageTree")
  blocks    Block[]
}

model Block {
  id        String   @id @default(cuid())
  pageId    String
  parentId  String?  // 중첩 블록 (토글 내부 등)
  type      String   // paragraph, heading_1, heading_2, heading_3, bulleted_list, numbered_list, to_do, toggle, code, quote, callout, divider, image, file, bookmark, embed, equation, table, column_list, synced_block, link_to_page, database
  content   Json     // 블록 타입별 데이터
  position  Int      // 같은 부모 내 정렬 순서
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  page     Page    @relation(fields: [pageId], references: [id])
  parent   Block?  @relation("BlockTree", fields: [parentId], references: [id])
  children Block[] @relation("BlockTree")
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  pageId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  page Page @relation(fields: [pageId], references: [id])

  @@unique([userId, pageId])
}
```

#### 4.2.2 지원 블록 타입

**텍스트 블록:**
- paragraph — 기본 텍스트
- heading_1, heading_2, heading_3 — 제목
- bulleted_list — 불릿 리스트
- numbered_list — 번호 리스트
- to_do — 체크박스
- toggle — 토글 (접기/펼치기)
- quote — 인용
- callout — 콜아웃 (아이콘 + 배경색)

**미디어 블록:**
- image — 이미지 (업로드/URL/Unsplash)
- video — 동영상
- file — 파일 첨부
- bookmark — 웹 북마크 (OG 미리보기)
- embed — 외부 임베드 (YouTube, Google Maps, CodePen 등)
- audio — 오디오

**고급 블록:**
- code — 코드 블록 (구문 강조, 언어 선택)
- equation — 수식 (KaTeX)
- table — 심플 테이블
- divider — 구분선
- table_of_contents — 목차
- column_list / column — 다단 레이아웃
- synced_block — 동기화 블록
- link_to_page — 페이지 링크
- database — 인라인/풀페이지 데이터베이스 (SP-5에서 상세)

#### 4.2.3 리치 텍스트

블록 content 내 텍스트는 리치 텍스트 배열로 저장:

```typescript
type RichText = {
  text: string;
  annotations: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    code: boolean;
    color: string; // default, gray, brown, orange, yellow, green, blue, purple, pink, red + 배경색
  };
  link?: string;
  mention?: {
    type: "user" | "page" | "date";
    id: string;
  };
  equation?: string; // 인라인 수식
}[];
```

#### 4.2.4 에디터 UX

- **슬래시 커맨드 (/):** 블록 타입 선택 메뉴 — 노션과 동일한 카테고리 구분, 검색
- **드래그 & 드롭:** 블록 좌측 핸들로 순서 변경, 중첩
- **블록 메뉴:** 블록 좌측 ⋮⋮ 아이콘 → 삭제, 복제, 블록 타입 변환, 색상 변경, 이동
- **인라인 툴바:** 텍스트 선택 시 나타나는 플로팅 툴바 (볼드, 이탈릭, 링크, 색상 등)
- **마크다운 단축키:** `#` → H1, `##` → H2, `-` → 불릿, `[]` → 투두, `>` → 토글, ``` → 코드
- **블록 타입 변환:** 기존 블록을 다른 타입으로 변환 (텍스트 → 헤딩, 리스트 → 투두 등)
- **멀티 블록 선택:** Shift+클릭, 드래그로 여러 블록 선택 → 일괄 삭제/이동/색상 변경

---

### SP-3: 페이지 & 워크스페이스

#### 4.3.1 페이지 기능

- **페이지 CRUD:** 생성, 읽기, 수정, 삭제 (휴지통으로 이동)
- **페이지 트리:** 무한 중첩 하위 페이지
- **페이지 커버:** Unsplash 이미지, 커스텀 업로드, 단색, 그라데이션
- **페이지 아이콘:** 이모지, 커스텀 이미지 업로드
- **즐겨찾기:** 사이드바 상단 고정
- **휴지통:** 30일 보관 후 자동 삭제, 복원 가능
- **페이지 잠금:** 편집 방지 잠금
- **페이지 너비:** 기본/전체 너비 전환
- **하위 페이지 표시:** 페이지 하단에 하위 페이지 목록

#### 4.3.2 사이드바

- **워크스페이스 스위처:** 상단, 멀티 워크스페이스 전환
- **섹션 구분:** 즐겨찾기 / 개인 페이지 / 공유됨 / 프라이빗
- **페이지 트리:** 접기/펼치기, 드래그로 순서/계층 변경
- **빠른 검색 (Cmd+K):** 페이지 이름 검색, 최근 방문
- **새 페이지:** 하단 + 새 페이지 버튼, 사이드바 호버 시 + 아이콘
- **리사이즈:** 사이드바 너비 드래그 조절 (최소 200px, 최대 480px)
- **접기:** 사이드바 완전 숨김/펼침 (Cmd+\\)

#### 4.3.3 템플릿 시스템

- **페이지 템플릿:** 미리 정의된 페이지 구조 선택
- **빈 페이지 / 아이콘 있는 빈 페이지 / 저널 등 기본 제공**
- **데이터베이스 템플릿:** DB 항목 생성 시 사용할 블록 구조 사전 정의
- **커스텀 템플릿:** 사용자가 현재 페이지를 템플릿으로 저장

---

### SP-4: 실시간 협업

#### 4.4.1 아키텍처

- **Yjs:** CRDT 기반 충돌 없는 동시 편집
- **Hocuspocus:** Yjs WebSocket 서버, 인증/권한 통합
- **프레즌스:** 접속 중인 사용자 아바타 표시 (탑바), 편집 중인 블록 표시
- **커서:** 다른 사용자의 커서 위치 + 이름 태그 실시간 표시 (사용자별 색상)

#### 4.4.2 동기화 전략

- 문서 열 때 Yjs 문서 로드 → WebSocket 연결
- 로컬 편집 → Yjs 변경 → WebSocket 브로드캐스트 → 다른 클라이언트 반영
- 연결 끊김 시: 로컬 Yjs 문서에 저장 → 재연결 시 자동 동기화
- 서버 측: Hocuspocus가 Yjs 문서를 PostgreSQL에 주기적 저장

---

### SP-5: 데이터베이스

#### 4.5.1 DB 스키마

```prisma
model Database {
  id          String   @id @default(cuid())
  pageId      String   @unique // 데이터베이스 = 특수한 페이지
  isInline    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  page       Page       @relation(fields: [pageId], references: [id])
  properties Property[]
  views      View[]
  rows       Row[]
}

model Property {
  id         String   @id @default(cuid())
  databaseId String
  name       String
  type       String   // title, text, number, select, multi_select, date, person, files, checkbox, url, email, phone, formula, relation, rollup, created_time, created_by, last_edited_time, last_edited_by, status
  config     Json     // 타입별 설정 (select 옵션, formula 등)
  position   Int
  isVisible  Boolean  @default(true)

  database Database @relation(fields: [databaseId], references: [id])
}

model View {
  id         String @id @default(cuid())
  databaseId String
  name       String
  type       String // table, board, timeline, calendar, gallery, list
  config     Json   // 필터, 정렬, 그룹, 컬럼 너비, 숨김 속성 등
  position   Int

  database Database @relation(fields: [databaseId], references: [id])
}

model Row {
  id         String   @id @default(cuid())
  databaseId String
  pageId     String   @unique // 각 행 = 페이지
  values     Json     // { propertyId: value } 매핑
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  database Database @relation(fields: [databaseId], references: [id])
  page     Page     @relation(fields: [pageId], references: [id])
}
```

#### 4.5.2 속성 타입

title, text, number, select, multi_select, date, person, files, checkbox, url, email, phone, formula, relation, rollup, created_time, created_by, last_edited_time, last_edited_by, status

#### 4.5.3 뷰 타입

- **테이블:** 스프레드시트형, 컬럼 리사이즈/정렬/숨김
- **보드 (칸반):** select/status 기준 그룹, 드래그 이동
- **타임라인 (간트):** date 속성 기준 수평 타임라인
- **캘린더:** date 속성 기준 월간 달력
- **갤러리:** 카드형 그리드, 커버 이미지 표시
- **리스트:** 심플 리스트 형태

#### 4.5.4 필터 / 정렬 / 그룹

- **필터:** 속성별 조건 (contains, equals, is_empty, before, after 등), AND/OR 조합
- **정렬:** 다중 속성 정렬, 오름차순/내림차순
- **그룹:** select/status/person/date 등 기준 그룹핑

---

### SP-6: 미디어 & 임베드

#### 4.6.1 파일 업로드

- MinIO 오브젝트 스토리지에 저장
- 이미지: 업로드, URL 입력, Unsplash 검색
- 파일: 드래그 앤 드롭, 클릭 업로드
- 업로드 사이즈 제한: 설정 가능 (기본 50MB)
- 이미지 리사이즈: 드래그로 크기 조절

#### 4.6.2 임베드 지원

- YouTube, Vimeo — 동영상 플레이어
- Google Maps — 지도
- Google Drive, Google Docs — 문서
- CodePen, CodeSandbox — 코드
- Figma — 디자인
- Twitter/X — 트윗
- GitHub Gist — 코드 스니펫
- 일반 URL — iframe 임베드

#### 4.6.3 웹 클리퍼

- 외부 URL 입력 → OG 메타데이터 추출 → 북마크 블록 생성
- 제목, 설명, 이미지 자동 추출

---

### SP-7: 공유 & 권한

#### 4.7.1 권한 모델

```
Workspace Level:
  OWNER   — 모든 권한, 워크스페이스 삭제 가능
  ADMIN   — 멤버 관리, 설정 변경
  MEMBER  — 페이지 생성/편집
  GUEST   — 초대된 페이지만 접근

Page Level:
  전체 권한 (편집 가능)
  댓글만 가능
  읽기만 가능
  접근 불가 (비공개)
```

#### 4.7.2 공유 기능

- **페이지별 공유:** 특정 사용자 초대 + 권한 설정
- **퍼블릭 링크:** 링크가 있는 누구나 접근 가능 (읽기/댓글/편집 선택)
- **게스트 초대:** 이메일로 외부 사용자 초대, 특정 페이지만 접근
- **공유 상속:** 상위 페이지 권한을 하위 페이지가 상속 (개별 오버라이드 가능)

---

### SP-8: 검색 & 기타 기능

#### 4.8.1 전체 검색

- PostgreSQL Full-text Search (pg_trgm)
- 페이지 제목 + 블록 콘텐츠 검색
- 필터: 생성자, 날짜 범위, 워크스페이스
- Cmd+K 커맨드 팔레트 통합

#### 4.8.2 댓글

- 블록 단위 댓글 (텍스트 선택 범위)
- 페이지 단위 댓글
- 댓글 스레드 (답글)
- 해결됨/미해결 상태
- @멘션으로 사용자 태그

#### 4.8.3 멘션

- @사용자 — 알림 발송
- @페이지 — 페이지 링크
- @날짜 — 날짜 선택기

#### 4.8.4 알림

- 인앱 알림 (사이드바 알림 패널)
- 멘션, 댓글, 페이지 초대, 편집 알림
- 읽음/안읽음 상태

#### 4.8.5 페이지 히스토리

- 편집 히스토리 저장 (스냅샷)
- 특정 시점으로 복원
- 변경 사항 diff 표시

#### 4.8.6 가져오기 / 내보내기

- **가져오기:** Markdown, HTML, CSV (DB용)
- **내보내기:** Markdown, PDF, HTML, CSV (DB용)

#### 4.8.7 오프라인 지원

- Service Worker 기반
- 오프라인 시 로컬에 편집 저장
- 온라인 복귀 시 Yjs 자동 동기화

---

### SP-9: AI 어시스턴트

#### 4.9.1 아키텍처

- 백엔드: Next.js API Route → OpenAI GPT-5.4 API (스트리밍)
- 프론트엔드: 에디터 내 인라인 AI UI

#### 4.9.2 호출 방식

- **스페이스바 (빈 블록에서):** AI 프롬프트 입력창
- **슬래시 커맨드 `/ai`:** 슬래시 메뉴에서 AI 선택
- **텍스트 선택 → AI 메뉴:** 선택된 텍스트에 대해 AI 작업
- **블록 메뉴 → AI에게 요청:** 특정 블록에 대해 AI 작업

#### 4.9.3 AI 기능

**생성:**
- 글쓰기 (자유 프롬프트)
- 요약
- 브레인스토밍
- 초안 작성
- 회의록 정리
- 할 일 목록 생성

**편집:**
- 톤 변경 (전문적, 캐주얼, 직설적, 자신감 있는)
- 길게/짧게 만들기
- 번역 (다국어)
- 맞춤법/문법 수정
- 계속 쓰기

**분석:**
- 블록/페이지 요약
- 핵심 포인트 추출
- 표 데이터 분석

#### 4.9.4 UI/UX

- AI 응답은 스트리밍으로 실시간 표시
- 응답 완료 후: 삽입(아래/대체), 다시 시도, 폐기 선택
- AI 생성 블록은 보라색 왼쪽 보더로 표시 (노션 동일)
- 히스토리: 최근 AI 대화 내역 유지

---

### SP-10: API & MCP 서버

#### 4.10.1 REST API

노션 공식 API와 동일한 구조:

- `GET /v1/pages/:id` — 페이지 조회
- `POST /v1/pages` — 페이지 생성
- `PATCH /v1/pages/:id` — 페이지 수정
- `DELETE /v1/pages/:id` — 페이지 삭제 (휴지통)
- `GET /v1/blocks/:id/children` — 블록 목록
- `PATCH /v1/blocks/:id` — 블록 수정
- `DELETE /v1/blocks/:id` — 블록 삭제
- `POST /v1/blocks/:id/children` — 블록 추가
- `POST /v1/databases/:id/query` — DB 쿼리
- `POST /v1/search` — 검색
- `GET /v1/users` — 사용자 목록

인증: API 키 (Bearer 토큰), 워크스페이스 설정에서 발급

#### 4.10.2 MCP 서버

Model Context Protocol 서버를 별도 패키지로 제공. Claude, GPT 등 AI 도구가 양방향으로 연동 가능.

**제공 Tools:**
- `search_pages` — 페이지 검색
- `get_page` — 페이지 내용 조회
- `create_page` — 페이지 생성
- `update_page` — 페이지 수정
- `delete_page` — 페이지 삭제
- `get_database` — DB 조회
- `query_database` — DB 쿼리 (필터/정렬)
- `create_database_row` — DB 행 추가
- `update_database_row` — DB 행 수정
- `get_block_children` — 블록 목록
- `append_blocks` — 블록 추가
- `update_block` — 블록 수정
- `delete_block` — 블록 삭제

**제공 Resources:**
- `workspace://pages` — 전체 페이지 트리
- `workspace://databases` — 전체 DB 목록
- `page://{id}` — 특정 페이지 콘텐츠

**설정:**
- MCP 서버 URL + API 키로 연결
- 워크스페이스 설정에서 MCP 엔드포인트 관리

---

## 5. 구현 순서

```
SP-1 (기반) ──→ SP-2 (에디터) ──→ SP-3 (페이지) ──→ SP-5 (DB)
                    │                   │               │
                    ├──→ SP-4 (협업)     ├──→ SP-7 (권한) ├──→ SP-8 (검색/기타)
                    └──→ SP-6 (미디어)                    ├──→ SP-9 (AI)
                                                         └──→ SP-10 (API/MCP)
```

1. **SP-1** → 2. **SP-2** → 3. **SP-3** + **SP-4** + **SP-6** (병렬) → 4. **SP-5** → 5. **SP-7** + **SP-8** + **SP-9** (병렬) → 6. **SP-10**
