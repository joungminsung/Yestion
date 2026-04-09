# 회의 기능 상세 TASK

## 목표

- [x] 특정 페이지에서 회의 기능을 켜고 끌 수 있어야 한다.
- [x] 회의 기능이 켜진 페이지에서 사용자가 마이크 녹음을 시작하고 종료할 수 있어야 한다.
- [x] 기본 모드는 `A 방식`으로, 한 명의 룸 마이크 녹음만으로 회의를 기록할 수 있어야 한다.
- [x] 확장 모드는 `B 방식`으로, 여러 참여자가 각자 마이크를 붙여 동일 세션으로 확장 가능해야 한다.
- [x] `B 방식`에서는 현재 참여자 목록과 내 마이크 참여 상태를 실시간으로 확인할 수 있어야 한다.
- [x] 발화자가 말한 내용이 5~10초 내에 실시간 대본으로 반영되어야 한다.
- [x] 대본은 가능한 경우 화자 이름으로, 그렇지 않으면 `Speaker 1`, `Speaker 2` 같은 라벨로 구분되어야 한다.
- [x] 같은 회의 세션을 기준으로 실시간 회의록 본문 요약도 함께 갱신되어야 한다.
- [x] 회의록 항목은 근거 발화로 다시 점프할 수 있어야 한다.
- [x] 회의 정보는 페이지 본문 영역과 우측 패널 둘 다에서 볼 수 있어야 한다.
- [x] 회의 종료 후 결과를 라이브 블록으로 유지하거나 일반 문서 블록으로 확정 변환할 수 있어야 한다.
- [x] 원본 오디오는 저장 여부를 세션 단위로 선택할 수 있어야 한다.

## 핵심 제약

- [x] 현재 에디터 저장 구조는 문서 전체 `bulkSave` 기반이므로, AI가 일반 블록을 실시간 직접 수정하지 않도록 한다.
- [x] 실시간 회의 상태는 문서 본문과 분리된 세션 저장소에 보관한다.
- [x] 페이지에는 라이브 회의 상태를 렌더링하는 전용 UI를 붙이고, 필요 시 종료 시점에만 일반 블록 스냅샷을 만든다.
- [x] 구현 1차에서는 `OpenAI diarized chunk transcription`을 사용해 5~10초 지연 허용 범위 안에서 동작하도록 한다.
- [x] 나중에 외부 STT provider로 바꿀 수 있도록 전사 provider 로직은 분리한다.
- [x] 브라우저 녹음은 청크 업로드 큐를 사용해 순서를 보장한다.
- [x] 회의록 생성은 전체 문서 재작성 대신 섹션형 패치 갱신 구조를 기본으로 한다.

## 비목표

- [ ] 이번 작업에서 WebRTC 기반 초저지연 오디오 스트리밍은 구현하지 않는다.
- [ ] 이번 작업에서 완전한 멀티-스트림 믹싱 서버는 구현하지 않는다.
- [ ] 이번 작업에서 참여자 음성 reference 업로드 기반 화자 실명 매핑 UI까지 완성하지 않는다.
- [ ] 이번 작업에서 회의록 내용을 TipTap 일반 블록과 완전 양방향 편집되도록 만들지 않는다.

## 사용자 흐름

### 페이지 회의 기능 활성화

- [x] 사용자는 특정 페이지에서 `회의 기능 켜기`를 눌러 해당 페이지에 회의 기능을 활성화할 수 있어야 한다.
- [x] 회의 기능이 켜진 페이지는 본문 상단에 라이브 회의 영역이 표시되어야 한다.
- [x] 회의 기능이 꺼진 페이지에서는 라이브 회의 UI가 숨겨져야 한다.

### 회의 시작

- [x] 사용자는 `회의 시작` 버튼을 눌러 새 회의 세션을 만들 수 있어야 한다.
- [x] 회의 시작 시 오디오 저장 여부를 선택할 수 있어야 한다.
- [x] 회의 시작 시 활성 세션 상태가 서버에 생성되어야 한다.
- [x] 회의 시작 직후부터 브라우저는 5초 내외 청크 업로드를 시작해야 한다.
- [x] 참여자별 마이크 모드에서는 현재 페이지 링크를 초대 링크로 복사할 수 있어야 한다.

### 회의 중

- [x] 청크가 업로드될 때마다 서버는 전사를 수행해야 한다.
- [x] 전사 결과는 발화 단위로 저장되어야 한다.
- [x] 발화 단위 데이터는 SSE로 클라이언트에 push 되어야 한다.
- [x] 본문 라이브 영역과 우측 패널은 동일 세션 상태를 같이 반영해야 한다.
- [x] 회의록 섹션은 `요약`, `논의`, `결정 사항`, `액션 아이템`을 기본으로 표시해야 한다.
- [x] 화자 이름이 없는 경우 라벨을 자동 생성해 일관되게 유지해야 한다.
- [x] 참여자별 마이크 모드에서는 각 참여자의 join/leave 상태를 세션에 기록해야 한다.
- [x] 참여자별 마이크 모드에서는 heartbeat와 stale timeout으로 자동 이탈 정리가 가능해야 한다.

### 회의 종료

- [x] 사용자는 `회의 종료`로 세션을 끝낼 수 있어야 한다.
- [x] 종료 시 녹음 업로드 큐가 비워질 때까지 대기해야 한다.
- [x] 종료 후 마지막 회의록 스냅샷을 한 번 더 생성해야 한다.
- [x] 종료 후 사용자는 결과를 라이브 블록 유지 또는 일반 문서 블록 변환 중 선택할 수 있어야 한다.

## 데이터 모델 TASK

- [x] `Page`에 `meetingEnabled` 플래그를 추가한다.
- [x] `MeetingSession` 모델을 추가한다.
- [x] `MeetingSession`에는 다음 필드를 포함한다.
- [x] `id`, `pageId`, `workspaceId`, `createdBy`, `status`, `mode`, `title`
- [x] `storeAudio`, `audioStoragePath`, `startedAt`, `endedAt`, `updatedAt`
- [x] `lastChunkIndex`, `lastProcessedAt`, `lastNotesGeneratedAt`
- [x] `MeetingSpeaker` 모델을 추가한다.
- [x] `MeetingSpeaker`에는 `sessionId`, `label`, `displayName`, `source`, `sortOrder`를 둔다.
- [x] `MeetingParticipant` 모델을 추가한다.
- [x] `MeetingParticipant`에는 `sessionId`, `userId`, `displayName`, `status`, `joinedAt`, `lastSeenAt`, `leftAt`를 둔다.
- [x] `MeetingUtterance` 모델을 추가한다.
- [x] `MeetingUtterance`에는 `sessionId`, `speakerId`, `speakerLabel`, `text`, `startMs`, `endMs`, `chunkIndex`, `rawJson`을 둔다.
- [x] `MeetingSnapshot` 모델을 추가한다.
- [x] `MeetingSnapshot`에는 `sessionId`, `summary`, `discussion`, `decisions`, `actionItems`, `rawJson`, `createdAt`을 둔다.
- [x] 스냅샷 discussion/decisions/actionItems에는 근거 발화 ID를 함께 저장할 수 있어야 한다.
- [x] 페이지/세션/발화 조회에 필요한 인덱스를 추가한다.
- [x] Prisma migration SQL 파일을 생성한다.

## 서버 API TASK

### tRPC router

- [x] `meetingRouter`를 추가한다.
- [x] `meeting.getPageState(pageId)`를 구현한다.
- [x] `meeting.togglePageEnabled(pageId, enabled)`를 구현한다.
- [x] `meeting.startSession(pageId, storeAudio)`를 구현한다.
- [x] `meeting.stopSession(sessionId)`를 구현한다.
- [x] `meeting.joinSessionAudio(sessionId, displayName)`를 구현한다.
- [x] `meeting.leaveSessionAudio(sessionId)`를 구현한다.
- [x] `meeting.heartbeatSessionAudio(sessionId, displayName)`를 구현한다.
- [x] `meeting.renameSpeaker(speakerId, displayName)`를 구현한다.
- [x] `meeting.getWorkspaceTargets(pageId)`를 구현한다.
- [x] `meeting.promoteActionItem(sessionId, actionItemIndex, targetType, targetId)`를 구현한다.
- [x] `meeting.exportSessionToPage(sessionId)`를 구현한다.

### HTTP routes

- [x] `POST /api/meeting/chunk`를 구현한다.
- [x] 요청 검증: 인증, 페이지 접근, 편집 권한, 활성 세션 여부를 확인한다.
- [x] 업로드된 청크를 세션 기준 순서대로 처리한다.
- [x] `multi_participant` 모드에서는 사용자별 stable source key 기반으로 청크 dedupe를 수행한다.
- [x] 오디오 저장 옵션이 켜진 경우 비공개 경로에 청크를 저장한다.
- [x] 저장된 청크를 권한 확인 후 재생할 수 있는 `GET /api/meeting/audio/chunk` route를 구현한다.
- [x] `OpenAI audio.transcriptions.create`로 청크 전사를 수행한다.
- [x] `gpt-4o-transcribe-diarize` + `response_format=diarized_json`를 사용한다.
- [x] 전사 결과 세그먼트를 `MeetingUtterance`로 저장한다.
- [x] 전사 완료 후 notes engine을 트리거한다.
- [x] `GET /api/meeting/stream` SSE route를 구현한다.

### 실시간 이벤트

- [x] `meetingEmitter`를 추가한다.
- [x] 이벤트 타입을 최소 `session.updated`, `utterance.created`, `snapshot.updated`로 구분한다.
- [x] 같은 페이지를 보고 있는 여러 클라이언트가 동일 업데이트를 받도록 한다.

## 전사 provider TASK

- [x] 전사 provider 파일을 분리한다.
- [x] provider 인터페이스는 입력 청크와 결과 세그먼트 구조를 분리해야 한다.
- [x] 초기 구현은 OpenAI provider를 사용한다.
- [x] OpenAI API 키가 없는 경우 사용자에게 명확한 오류를 내려야 한다.
- [x] provider 결과에서 화자 라벨이 비어 있으면 fallback 라벨 생성 로직을 둔다.

## 회의록 생성 엔진 TASK

- [x] 회의록 생성 로직을 별도 유틸로 분리한다.
- [x] 입력은 `이전 snapshot + 최근 finalized utterances` 구조로 받는다.
- [x] 출력은 구조화된 JSON이어야 한다.
- [x] 기본 필드는 `summary`, `discussion`, `decisions`, `actionItems`를 포함한다.
- [x] 액션 아이템은 최소 `{ text, owner, status }` 형태를 지원하도록 설계한다.
- [x] 논의/결정/액션 아이템에는 `evidenceUtteranceIds`를 함께 저장한다.
- [x] 회의록 생성은 청크마다 무조건 돌리지 않고 적당한 간격 조건을 둔다.
- [x] 회의 종료 시 마지막 스냅샷을 강제로 갱신한다.

## 페이지 UI TASK

### 페이지 본문 라이브 영역

- [x] 페이지 본문 상단에 `PageMeetingSurface`를 추가한다.
- [x] 회의 기능이 켜진 페이지에서만 보이도록 한다.
- [x] 비활성 상태에는 기능 설명과 `회의 시작` CTA를 표시한다.
- [x] 활성 세션에는 녹음 상태, 경과 시간, 청크 업로드 상태, 저장 여부를 표시한다.
- [x] 탭 UI로 `실시간 대본`, `자동 회의록`을 분리한다.
- [x] 실시간 대본에는 화자별 발화, 시각, 최신 발화를 보여준다.
- [x] 실시간 대본에서 저장된 오디오 청크 재생을 지원한다.
- [x] 자동 회의록에는 구조화된 섹션을 표시한다.
- [x] 자동 회의록에서 근거 발화 이동과 액션 아이템 승격 UI를 제공한다.

### 우측 패널

- [x] Topbar에 회의 패널 토글 버튼을 추가한다.
- [x] 패널은 본문 라이브 영역과 같은 데이터를 표시하되, 좁은 레이아웃에 맞게 압축한다.
- [x] 패널에서 세션 시작/종료/화자 이름 편집/문서 반영 액션을 제공한다.
- [x] 멀티 참여자 세션에서는 현재 참여자 목록과 초대 링크 복사 버튼을 제공한다.

### 페이지 설정 UX

- [x] 페이지 단위 `회의 기능 켜기/끄기` 토글을 노출한다.
- [x] 읽기 전용 권한에서는 회의 기능 토글과 녹음 시작을 비활성화한다.

## 녹음 클라이언트 TASK

- [x] `MediaRecorder` 기반 녹음 훅 또는 컴포넌트를 만든다.
- [x] 청크 길이는 기본 5초로 둔다.
- [x] 업로드 큐는 직렬 처리한다.
- [x] 업로드 실패 시 재시도 또는 에러 표기를 한다.
- [x] 브라우저 권한 거부 시 명확한 오류를 보여준다.
- [x] 세션 종료 시 남은 청크를 flush 한다.
- [x] 참여자별 마이크 세션에서는 주기 heartbeat를 보낸다.

## 페이지 반영 TASK

- [x] 종료 후 `일반 문서로 반영` 액션을 구현한다.
- [x] 회의록 snapshot을 paragraph / heading / todo 블록으로 변환한다.
- [x] 반영 시 기존 문서를 덮어쓰지 않고 상단에 append 하는 방식으로 시작한다.
- [x] 반영된 블록 앞에는 회의 세션 제목과 시각을 넣는다.
- [x] 액션 아이템을 프로젝트 Task 또는 데이터베이스 row로 승격할 수 있다.

## 권한 및 보안 TASK

- [x] 페이지 편집 권한이 없는 사용자는 세션을 시작할 수 없게 한다.
- [x] 페이지 보기 권한만 있는 사용자는 세션 상태 조회만 가능하게 한다.
- [x] 업로드 라우트는 인증 없는 접근을 거부해야 한다.
- [x] 오디오 저장 파일은 `public/uploads`가 아닌 비공개 경로를 사용한다.

## 관측성 및 오류 대응 TASK

- [x] 전사 실패, notes 생성 실패, 업로드 실패를 세션 상태에 남긴다.
- [x] 클라이언트에 최근 오류 메시지를 표시할 수 있어야 한다.
- [x] 녹음 중 페이지 이탈 시 세션을 자동 종료하지 않고 복구 가능한 상태로 유지한다.
- [x] 이번 구현에서는 최소한 페이지 새로고침 후 활성 세션 재진입은 지원한다.

## 구현 순서

- [x] 요구사항과 제약 정리
- [x] 기본 아키텍처 결정
- [x] Prisma 스키마 확장
- [x] migration 파일 작성
- [x] meeting router 추가
- [x] SSE emitter와 stream route 추가
- [x] chunk upload route 추가
- [x] OpenAI diarized transcription provider 추가
- [x] notes generation 유틸 추가
- [x] 페이지 회의 Surface UI 추가
- [x] Topbar 회의 패널 추가
- [x] 페이지 설정 토글 추가
- [x] 회의 종료 후 페이지 반영 기능 추가
- [x] 기본 검증 실행
- [x] 문서 상 남은 리스크 갱신
- [x] 참여자 presence 및 초대 UX 추가

## 운영 최적화 반영

- [x] 회의록 요약 모델 기본값을 `gpt-5.4-mini`로 조정한다.
- [x] 회의록 자동 생성 간격 기본값을 `30초`로 늘린다.
- [x] 필요 시 env로 `MEETING_NOTES_MODEL`, `MEETING_NOTES_DEBOUNCE_MS`를 오버라이드할 수 있게 한다.
- [x] 필요 시 env로 `MEETING_TRANSCRIPTION_LANGUAGE`를 오버라이드할 수 있게 한다.
- [x] heartbeat / stale auto leave 추가
- [x] 근거 발화 링크와 오디오 재생 추가
- [x] 액션 아이템 Task/DB row 승격 추가

## 품질 개선 반영

- [x] 단일 화자의 짧게 끊긴 전사 세그먼트는 서버에서 1차 병합한다.
- [x] 전사 요청 시 기본 언어를 `ko`로 강제해 영어 오인식을 줄인다.
- [x] 고정 5초 경계 대신 `최소 5초 / 최대 12초 / 침묵 감지` 기반으로 청크 종료를 조정한다.
- [x] 회의 대본 UI는 인접 발화를 카드 단위로 다시 병합해 길이를 줄인다.
- [x] 회의 블록은 일정 높이 안에서 내부 스크롤되도록 조정한다.
- [x] 문서 반영 후 `PageEditor`가 최신 블록으로 다시 마운트되도록 갱신 경로를 보강한다.
- [x] 회의록 생성 프롬프트를 사내 회의록 스타일로 강화해 `제목 / 핵심 내용 / 상세 설명 / 실행 항목 메타정보`를 더 구체적으로 작성하게 한다.
- [x] 액션 아이템에는 `우선순위`, `기한` 같은 추가 메타정보를 받을 수 있게 한다.
- [x] 문서 반영 시 회의록 메타정보와 액션 아이템을 표 형태로 내보내 실제 회의록처럼 보이게 한다.
- [x] 전사 요청에 최근 발화 문맥 prompt를 붙여 청크 경계에서도 문장이 덜 끊기게 한다.
- [x] 전사 후처리에서 용어 사전 / 치환 규칙을 적용할 수 있게 한다.
- [x] 최근 발화와 이어지는 경우 첫 세그먼트를 기존 발화에 병합해 조각난 대본을 줄인다.
- [x] VAD를 고정 임계값에서 적응형 noise floor 기반으로 개선한다.

## 수용 기준

- [x] 회의 기능이 켜진 페이지에서 회의 시작이 가능하다.
- [x] 5초 단위 청크가 서버로 업로드된다.
- [x] 업로드 후 5~10초 내 실시간 대본이 화면에 반영된다.
- [x] 자동 회의록 섹션이 주기적으로 갱신된다.
- [x] 회의 패널과 본문 라이브 영역이 같은 세션 상태를 보여준다.
- [x] 회의 종료 후 일반 문서 반영이 가능하다.
- [x] 읽기 전용 페이지에서는 회의 시작이 막힌다.

## 리스크 메모

- [ ] 짧은 5초 청크에서는 화자 라벨이 흔들릴 수 있다.
- [ ] 룸 마이크 기반 diarization 정확도는 환경 소음에 따라 달라질 수 있다.
- [ ] 긴 회의에서 notes generation 호출 비용이 커질 수 있다.
- [ ] 현재 1차 구현은 provider fallback이 제한적일 수 있다.
- [x] `multi_participant` 모드에서 참여 초대/현재 참여자 목록 UX는 최소 구현까지 완료했다.
- [x] 참여자 presence는 heartbeat와 stale timeout 기준으로 자동 정리된다.

## 완료 후 정리해야 할 후속 작업

- [ ] known speaker reference 업로드 UI 추가
