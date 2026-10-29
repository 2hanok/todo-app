# 아키텍처 구성도 및 흐름도 (v1.1)

> 출처: #1 (v1.0 분석) → v1.1 고도화(#2 #3 #4 #5) 반영본. 계획·검증 이력은 `docs/pdca/v1.1/` 참조.

## 개요

순수 HTML/CSS/JS 기반 클라이언트 전용 할 일 관리 앱입니다. 서버·회원 기능이 없고 데이터는 브라우저 `localStorage`에 저장합니다.

| 파일 | 역할 |
|------|------|
| `index.html` | 사이드바, 상단 바, 요약 카드, 툴바(검색·상태·카테고리), 빠른필터·정렬 바, 추가 폼, 테이블, Undo 토스트 |
| `script.js` | 상태, 저장, 날짜 유틸, 필터·정렬, 렌더링, CRUD, 편집 행, Undo |
| `style.css` | 레이아웃, 배지, 진행 바, 마감 초과/오늘 마감 표시, 편집 행, 토스트, 반응형 |
| 배포 | GitHub Pages (master `/`) → https://2hanok.github.io/todo-app/ |

## 1. 전체 아키텍처

```mermaid
flowchart TB
  subgraph Browser["웹 브라우저 (클라이언트 전용)"]
    subgraph View["View 계층"]
      HTML["index.html<br/>툴바 · 빠른필터/정렬 바 · 테이블(헤더 정렬) · 토스트"]
      CSS["style.css<br/>배지 · 편집 행 · 토스트 · 반응형"]
    end
    subgraph Logic["Logic 계층 - script.js"]
      State["상태: todos[], currentFilter, filterCat, searchQuery<br/>sortKey, sortDir, dueFilter, pinOverdue<br/>editingId, editDraft"]
      CRUD["addTodo / toggleTodo / startEdit→finishEdit / deleteTodo / clearCompleted"]
      Query["getFiltered() → getSorted()"]
      Render["renderTodos() / createRow() / createEditRow() / updateStats() / updateSortUI()"]
      Date["localDateStr() / todayStr() / weekRange() / isOverdue() / matchesDue()"]
      Undo["showUndo() / undoLast() / restoreItems()"]
      Clock["checkDateChange() (60초 + 탭 복귀)"]
    end
    subgraph Storage["Storage 계층 (localStorage)"]
      LS[("todos-v2<br/>할 일 JSON 배열")]
      LP[("todos-v2-prefs<br/>정렬·빠른필터·고정")]
    end
  end
  User(("사용자")) -->|클릭·입력·Enter·Esc·Ctrl+Z| HTML
  HTML --> CRUD
  HTML -->|필터·검색·정렬| State
  CRUD --> State
  CRUD -->|삭제 스냅샷| Undo --> State
  State --> Query --> Render --> HTML
  Date --> Query
  Date --> Render
  Clock -->|날짜 바뀌면| Render
  CRUD -->|saveTodos| LS
  LS -->|loadTodos| State
  State -->|savePrefs| LP
  LP -->|loadPrefs| State
```

### 데이터 모델 (`todos-v2`, v1.0과 동일 — 마이그레이션 없음)

```json
{ "id": 1751234567890, "text": "보고서 작성", "category": "업무|개인|공부", "priority": "긴급|보통|낮음", "dueDate": "YYYY-MM-DD", "completed": false, "createdAt": "ISO8601" }
```

### 설정 모델 (`todos-v2-prefs`, v1.1 신규)

```json
{ "sortKey": "created|due|priority|text", "sortDir": "asc|desc", "dueFilter": "|today|week|overdue", "pinOverdue": false }
```

## 2. 흐름도

### 2-1. 앱 초기화

```mermaid
flowchart LR
  A[페이지 로드] --> B[loadTodos] --> C[loadPrefs] --> D[renderTodos]
  D --> E[getFiltered → getSorted → 행 생성 → updateStats → updateSortUI]
  D --> F[renderedDate = 오늘 로컬 날짜]
```

### 2-2. 필터·정렬 파이프라인 (#2)

```mermaid
flowchart LR
  T[상태 탭] --> F
  C[카테고리] --> F
  S[검색어] --> F
  Q[빠른 필터: 오늘/이번 주/마감 초과] --> F
  F[getFiltered: 5조건 AND] --> O[getSorted: sortKey·sortDir]
  O --> P{pinOverdue?}
  P -->|예| P1[마감 초과 항목을 앞으로]
  P -->|아니오| R
  P1 --> R[renderTodos]
```

- 정렬 기준: 등록순(`createdAt`) / 마감일 임박순(마감일 없음은 항상 맨 뒤) / 우선순위순(긴급→보통→낮음, 동률은 마감일) / 이름순
- 헤더(할 일·우선순위·마감일) 클릭: 같은 열 재클릭 시 방향 전환, ▲▼ 표시

### 2-3. 날짜 처리 (#3)

```mermaid
flowchart LR
  N[new Date] --> L[localDateStr: 로컬 연-월-일] --> T[todayStr]
  T --> O[isOverdue / 오늘 마감 / 이번 주 월~일]
  K[60초 타이머 · visibilitychange] --> C{todayStr ≠ renderedDate?}
  C -->|예| R[renderTodos]
```

### 2-4. 편집 (#4)

```mermaid
stateDiagram-v2
  [*] --> 보기
  보기 --> 편집중: 수정 클릭 / 텍스트 더블클릭 (editingId 설정, editDraft 복사)
  편집중 --> 보기: Enter · 저장 버튼 · 행 바깥으로 포커스 이동 → 저장
  편집중 --> 보기: Esc · 취소 버튼 → 원문 유지
  편집중 --> 편집중: 다른 행 수정 클릭 → 현재 행 저장 후 전환
  note right of 편집중
    finishEdit는 editingId가 일치할 때만 1회 실행
    → 행 제거 시 발생하는 blur/focusout은 무시됨
    편집 필드: 텍스트·카테고리·우선순위·마감일
  end note
```

### 2-5. 삭제와 실행 취소 (#5)

```mermaid
sequenceDiagram
  actor U as 사용자
  participant L as script.js
  participant S as localStorage
  participant T as 토스트
  U->>L: 삭제 클릭 / 완료 삭제 클릭
  alt 완료 삭제
    L->>U: confirm("완료된 할 일 N개를 삭제할까요?")
    U-->>L: 취소 → 종료
  end
  L->>L: {item, index} 스냅샷 후 제거
  L->>S: saveTodos()
  L->>T: showUndo(메시지, 복구함수) 5초
  alt 5초 내 실행 취소 / Ctrl+Z
    U->>T: 실행 취소
    T->>L: restoreItems → 원래 위치에 삽입
    L->>S: saveTodos()
  else 5초 경과 또는 다음 삭제
    T->>T: 숨김 (삭제 확정)
  end
```

## 3. 변경 이력

| 버전 | 내용 |
|------|------|
| v1.0 | 초기 구현 (CRUD, 카테고리, 우선순위, 마감일, 검색, 상태 필터, 요약 카드) |
| v1.1 | #3 로컬 날짜·자정 갱신 / #4 Esc 취소 보장·전 필드 편집 / #2 정렬·헤더 정렬·빠른필터·마감초과 고정·설정 저장 / #5 Undo 토스트·완료 삭제 확인 / 추가 폼 숨김 버그 수정 / 모바일 레이아웃 보정 |

## 4. 남은 과제

- 휴지통(소프트 삭제, 30일 보관): #6 보류
- 사이드바 통계·설정 메뉴: "준비 중"
- 전체 재렌더링(`tbody.innerHTML = ''`) 방식 유지 — 하루 10~20건 규모에서는 성능 문제 없음
