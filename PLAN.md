# PLAN: 할 일 관리 웹페이지 구현 흐름

> **이력 문서(v1.0 초기 구현 계획)입니다.** 실제 구현은 이후 `index.html`·`script.js`·`style.css` 3분할로 확장되었습니다.
> 현재 기준: 요구사항 `PRD.md`(v1.1) · 구조 `docs/ARCHITECTURE.md` · 고도화 계획/검증 `docs/pdca/v1.1/` (01-plan → 03-check → 04-act)

## 파일 구성

```
001-study/
├── PRD.md        # 요구사항 문서 (기존)
├── PLAN.md       # 구현 흐름 문서 (현재)
└── index.html    # 구현 대상 (단일 파일)
```

> 모든 HTML, CSS, JavaScript를 `index.html` 하나에 작성한다.

---

## 구현 단계

### Step 1. HTML 기본 구조 잡기

**파일**: `index.html`

- `<head>` 에 제목, 인코딩, 뷰포트 설정
- `<body>` 에 아래 영역을 순서대로 배치
  - 헤더: 페이지 제목 + 완료율 텍스트 + 진행 바
  - 입력 영역: 카테고리 드롭다운 + 텍스트 입력창 + 추가 버튼
  - 필터 탭: 전체 / 진행 중 / 완료 버튼 3개
  - 할 일 목록: 항목이 동적으로 삽입될 `<ul>` 컨테이너

---

### Step 2. CSS 스타일 적용

**파일**: `index.html` (`<style>` 블록)

- 전체 레이아웃: 가운데 정렬, 최대 너비 제한, 여백
- 헤더: 제목 폰트, 진행 바 색상 및 애니메이션
- 입력 영역: 드롭다운 + 입력창 + 버튼 가로 배치
- 필터 탭: 선택된 탭 강조 스타일
- 할 일 항목: 체크박스, 텍스트, 카테고리 배지, 버튼 가로 배치
- 완료된 항목: 텍스트에 취소선, 흐린 색상
- 카테고리 배지: 업무/개인/공부 각각 다른 배경색

---

### Step 3. 데이터 구조 및 상태 설계

**파일**: `index.html` (`<script>` 블록)

- 전역 변수 2개 선언
  - `todos`: 할 일 배열 (메모리 상태)
  - `currentFilter`: 현재 선택된 필터 (`'all'` / `'active'` / `'completed'`)
- 할 일 항목 1건의 구조 확정
  ```
  { id, text, category, completed, createdAt }
  ```

---

### Step 4. localStorage 연동

**파일**: `index.html` (`<script>` 블록)

- `saveTodos()`: `todos` 배열을 JSON으로 직렬화해 `localStorage`에 저장
- `loadTodos()`: 페이지 로드 시 `localStorage`에서 데이터를 읽어 `todos`에 복원
- 페이지 로드 이벤트에서 `loadTodos()` 호출

---

### Step 5. 할 일 목록 렌더링

**파일**: `index.html` (`<script>` 블록)

- `renderTodos()`: `todos` 배열을 `currentFilter`에 따라 필터링 후 `<ul>`에 항목 생성
  - 각 항목: 체크박스 + 텍스트 + 카테고리 배지 + 수정 버튼 + 삭제 버튼
  - 완료 항목은 CSS 클래스로 취소선 처리
- `updateProgress()`: 완료율 텍스트와 진행 바 너비를 갱신
- 데이터 변경이 발생하는 모든 함수 마지막에 `renderTodos()` + `updateProgress()` 호출

---

### Step 6. 할 일 추가 기능

**파일**: `index.html` (`<script>` 블록)

- `addTodo()` 함수 구현
  - 입력창 텍스트 공백 제거 후 빈 값이면 무시
  - `id`: `Date.now()` 사용
  - `todos` 배열에 새 항목 push
  - `saveTodos()` → `renderTodos()` 호출
  - 입력창 초기화
- 추가 버튼 클릭 이벤트 연결
- 입력창에서 Enter 키 입력 이벤트 연결

---

### Step 7. 완료 체크 기능

**파일**: `index.html` (`<script>` 블록)

- `toggleTodo(id)` 함수 구현
  - `id`로 항목을 찾아 `completed` 값을 반전
  - `saveTodos()` → `renderTodos()` 호출
- 렌더링 시 체크박스의 `change` 이벤트에 `toggleTodo` 연결

---

### Step 8. 할 일 수정 기능

**파일**: `index.html` (`<script>` 블록)

- `editTodo(id)` 함수 구현
  - 해당 항목의 텍스트 영역을 `<input>`으로 교체 (인라인 편집)
  - 입력 완료(Enter 또는 포커스 아웃) 시 변경된 텍스트를 저장
  - 빈 값이면 변경 취소
  - `saveTodos()` → `renderTodos()` 호출
- 렌더링 시 수정 버튼의 클릭 이벤트에 `editTodo` 연결

---

### Step 9. 할 일 삭제 기능

**파일**: `index.html` (`<script>` 블록)

- `deleteTodo(id)` 함수 구현
  - `id`로 항목을 찾아 `todos` 배열에서 제거
  - `saveTodos()` → `renderTodos()` 호출
- 렌더링 시 삭제 버튼의 클릭 이벤트에 `deleteTodo` 연결

---

### Step 10. 필터 기능

**파일**: `index.html` (`<script>` 블록)

- `setFilter(filter)` 함수 구현
  - `currentFilter` 값을 변경
  - 선택된 탭 버튼에 활성 CSS 클래스 적용
  - `renderTodos()` 호출
- 필터 탭 버튼 3개에 각각 클릭 이벤트 연결

---

### Step 11. 최종 점검

PRD의 완료 기준 10개 항목을 순서대로 브라우저에서 직접 확인한다.

| # | 확인 항목 |
|---|-----------|
| 1 | 할 일 추가 후 목록에 즉시 반영되는가 |
| 2 | 수정 저장 후 변경 내용이 반영되는가 |
| 3 | 삭제 버튼 클릭 시 즉시 제거되는가 |
| 4 | 체크박스 토글로 완료/미완료 전환되는가 |
| 5 | 카테고리 배지가 각 항목에 올바르게 표시되는가 |
| 6 | 필터 탭 선택 시 해당 항목만 표시되는가 |
| 7 | 완료 항목 변경 시 완료율과 진행 바가 갱신되는가 |
| 8 | 새로고침 후에도 데이터가 유지되는가 |
| 9 | 공백 텍스트로 추가 시 무시되는가 |
| 10 | `index.html` 파일 하나만으로 모든 기능이 동작하는가 |
