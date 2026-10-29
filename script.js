/* ── 상태 ──────────────────────────────────────── */
const STORAGE_KEY = 'todos-v2';
const PREFS_KEY   = 'todos-v2-prefs';   // v1.1: 정렬·빠른필터·고정 선택값 (#2)
const PRIORITY_ORDER = { '긴급': 0, '보통': 1, '낮음': 2 };
const CATEGORIES     = ['업무', '개인', '공부'];
const PRIORITIES     = ['긴급', '보통', '낮음'];
const UNDO_MS        = 5000;

let todos         = [];
let currentFilter = 'all';
let filterCat     = '';
let searchQuery   = '';

/* v1.1 (#2) 정렬·빠른필터 */
let sortKey    = 'created';  // created | due | priority | text
let sortDir    = 'asc';      // asc | desc
let dueFilter  = '';         // '' | today | week | overdue
let pinOverdue = false;

/* v1.1 (#4) 편집 */
let editingId = null;
let editDraft = null;

/* v1.1 (#3) 날짜 변경 감지 */
let renderedDate = '';

/* ── localStorage ──────────────────────────────── */
function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadTodos() {
  try {
    todos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    todos = [];
  }
}

function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ sortKey, sortDir, dueFilter, pinOverdue }));
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    if (['created', 'due', 'priority', 'text'].includes(p.sortKey)) sortKey = p.sortKey;
    if (['asc', 'desc'].includes(p.sortDir))                         sortDir = p.sortDir;
    if (['', 'today', 'week', 'overdue'].includes(p.dueFilter))      dueFilter = p.dueFilter;
    pinOverdue = !!p.pinOverdue;
  } catch { /* 기본값 유지 */ }
}

/* ── 날짜 유틸 (#3: 로컬 시간대 기준) ─────────── */
function localDateStr(d = new Date()) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayStr() {
  return localDateStr();
}

/* 이번 주 = 월요일 ~ 일요일 (로컬) */
function weekRange() {
  const now    = new Date();
  const offset = (now.getDay() + 6) % 7;          // 월=0 … 일=6
  const mon    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const sun    = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return [localDateStr(mon), localDateStr(sun)];
}

function isOverdue(todo) {
  return !todo.completed && !!todo.dueDate && todo.dueDate < todayStr();
}

function matchesDue(todo, key) {
  if (!key) return true;
  if (key === 'overdue') return isOverdue(todo);
  if (!todo.dueDate) return false;
  if (key === 'today') return todo.dueDate === todayStr();
  if (key === 'week') {
    const [start, end] = weekRange();
    return todo.dueDate >= start && todo.dueDate <= end;
  }
  return true;
}

/* ── 통계 업데이트 ─────────────────────────────── */
function updateStats() {
  const total  = todos.length;
  const done   = todos.filter(t => t.completed).length;
  const active = total - done;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById('stat-total').textContent  = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-done').textContent   = done;

  document.getElementById('sum-total').textContent  = total;
  document.getElementById('sum-active').textContent = active;
  document.getElementById('sum-done').textContent   = done;
  document.getElementById('sum-pct').textContent    = pct + '%';
  document.getElementById('sum-fill').style.width   = pct + '%';

  const clearBtn = document.getElementById('clear-done-btn');
  clearBtn.disabled = done === 0;
  clearBtn.title    = done === 0 ? '완료된 할 일이 없습니다' : `완료된 할 일 ${done}개 삭제`;

  /* 빠른 필터 개수 (미완료 기준) */
  const open = todos.filter(t => !t.completed);
  ['today', 'week', 'overdue'].forEach(key => {
    const el = document.getElementById(`due-count-${key}`);
    if (el) el.textContent = open.filter(t => matchesDue(t, key)).length;
  });
}

/* ── 필터링 ────────────────────────────────────── */
function getFiltered() {
  return todos.filter(todo => {
    if (currentFilter === 'active'    &&  todo.completed) return false;
    if (currentFilter === 'completed' && !todo.completed) return false;
    if (filterCat && todo.category !== filterCat)         return false;
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (!matchesDue(todo, dueFilter))                     return false;
    return true;
  });
}

/* ── 정렬 (#2) ─────────────────────────────────── */
function createdKey(t) {
  return t.createdAt || '';
}

function compareTodos(a, b) {
  const dir = sortDir === 'desc' ? -1 : 1;
  let r = 0;

  if (sortKey === 'due') {
    /* 마감일 없음은 방향과 무관하게 항상 맨 뒤 */
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (a.dueDate && b.dueDate) r = a.dueDate.localeCompare(b.dueDate) * dir;
    if (r === 0) r = (PRIORITY_ORDER[a.priority || '보통'] - PRIORITY_ORDER[b.priority || '보통']);
  } else if (sortKey === 'priority') {
    r = (PRIORITY_ORDER[a.priority || '보통'] - PRIORITY_ORDER[b.priority || '보통']) * dir;
    if (r === 0) {
      if (a.dueDate && b.dueDate) r = a.dueDate.localeCompare(b.dueDate);
      else if (a.dueDate) r = -1;
      else if (b.dueDate) r = 1;
    }
  } else if (sortKey === 'text') {
    r = a.text.localeCompare(b.text, 'ko') * dir;
  } else {
    r = (createdKey(a).localeCompare(createdKey(b)) || (a.id - b.id)) * dir;
  }

  if (r === 0) r = createdKey(a).localeCompare(createdKey(b)) || (a.id - b.id);
  return r;
}

function getSorted(list) {
  const sorted = [...list].sort(compareTodos);
  if (!pinOverdue) return sorted;
  return [...sorted.filter(isOverdue), ...sorted.filter(t => !isOverdue(t))];
}

/* ── 행 생성 ───────────────────────────────────── */
function createRow(todo) {
  if (todo.id === editingId) return createEditRow(todo);

  const tr = document.createElement('tr');
  tr.dataset.id = todo.id;
  if (todo.completed)  tr.classList.add('completed');
  if (isOverdue(todo)) tr.classList.add('overdue');

  /* 체크박스 */
  const tdCk = document.createElement('td');
  const cb   = document.createElement('input');
  cb.type      = 'checkbox';
  cb.className = 'row-check';
  cb.checked   = todo.completed;
  cb.setAttribute('aria-label', '완료');
  cb.addEventListener('change', () => toggleTodo(todo.id));
  tdCk.appendChild(cb);

  /* 제목 */
  const tdTitle   = document.createElement('td');
  const titleWrap = document.createElement('div');
  titleWrap.className = 'title-cell';

  const textSpan       = document.createElement('span');
  textSpan.className   = 'todo-text';
  textSpan.textContent = todo.text;
  textSpan.title       = todo.text;
  textSpan.addEventListener('dblclick', () => startEdit(todo.id));
  titleWrap.appendChild(textSpan);

  if (isOverdue(todo)) {
    const tag       = document.createElement('span');
    tag.className   = 'overdue-tag';
    tag.textContent = '마감 초과';
    titleWrap.appendChild(tag);
  } else if (!todo.completed && todo.dueDate === todayStr()) {
    const tag       = document.createElement('span');
    tag.className   = 'today-tag';
    tag.textContent = '오늘 마감';
    titleWrap.appendChild(tag);
  }
  tdTitle.appendChild(titleWrap);

  /* 카테고리 */
  const tdCat       = document.createElement('td');
  const badge       = document.createElement('span');
  badge.className   = `badge badge--${todo.category}`;
  badge.textContent = todo.category;
  tdCat.appendChild(badge);

  /* 우선순위 */
  const tdPri     = document.createElement('td');
  const priSpan   = document.createElement('span');
  const priority  = todo.priority || '보통';
  priSpan.className   = `priority priority--${priority}`;
  priSpan.textContent = priority;
  tdPri.appendChild(priSpan);

  /* 마감일 */
  const tdDue       = document.createElement('td');
  tdDue.className   = 'due-cell';
  tdDue.textContent = todo.dueDate || '—';

  /* 액션 */
  const tdAct  = document.createElement('td');
  const wrap   = document.createElement('div');
  wrap.className = 'row-actions';

  const editBtn       = document.createElement('button');
  editBtn.className   = 'btn-row btn-row--edit';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => startEdit(todo.id));

  const delBtn        = document.createElement('button');
  delBtn.className    = 'btn-row btn-row--delete';
  delBtn.textContent  = '삭제';
  delBtn.addEventListener('click', () => deleteTodo(todo.id));

  wrap.append(editBtn, delBtn);
  tdAct.appendChild(wrap);

  tr.append(tdCk, tdTitle, tdCat, tdPri, tdDue, tdAct);
  return tr;
}

/* ── 편집 행 (#4: 전 필드 수정 + Esc 취소 보장) ── */
function makeSelect(options, value, cls) {
  const sel = document.createElement('select');
  sel.className = `edit-select ${cls}`;
  options.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = value;
  return sel;
}

function createEditRow(todo) {
  const d  = editDraft;
  const tr = document.createElement('tr');
  tr.dataset.id = todo.id;
  tr.classList.add('editing');

  const tdCk = document.createElement('td');

  const tdTitle = document.createElement('td');
  const input   = document.createElement('input');
  input.type      = 'text';
  input.className = 'edit-input';
  input.value     = d.text;
  input.setAttribute('aria-label', '할 일 내용');
  tdTitle.appendChild(input);

  const tdCat = document.createElement('td');
  const cat   = makeSelect(CATEGORIES, d.category, 'edit-cat');
  cat.setAttribute('aria-label', '카테고리');
  tdCat.appendChild(cat);

  const tdPri = document.createElement('td');
  const pri   = makeSelect(PRIORITIES, d.priority, 'edit-pri');
  pri.setAttribute('aria-label', '우선순위');
  tdPri.appendChild(pri);

  const tdDue = document.createElement('td');
  const due   = document.createElement('input');
  due.type      = 'date';
  due.className = 'edit-date';
  due.value     = d.dueDate;
  due.setAttribute('aria-label', '마감일');
  tdDue.appendChild(due);

  const tdAct = document.createElement('td');
  const wrap  = document.createElement('div');
  wrap.className = 'row-actions';

  const saveBtn       = document.createElement('button');
  saveBtn.className   = 'btn-row btn-row--save';
  saveBtn.textContent = '저장';
  const cancelBtn       = document.createElement('button');
  cancelBtn.className   = 'btn-row btn-row--cancel';
  cancelBtn.textContent = '취소';
  /* 버튼 mousedown 시 포커스 이동(→ focusout 저장)을 막아 클릭 의도대로 처리 */
  [saveBtn, cancelBtn].forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
  saveBtn.addEventListener('click',   () => finishEdit(todo.id, true));
  cancelBtn.addEventListener('click', () => finishEdit(todo.id, false));
  wrap.append(saveBtn, cancelBtn);
  tdAct.appendChild(wrap);

  /* 입력값을 초안에 보관 → 편집 중 재렌더링(자정 등)에도 유지 */
  input.addEventListener('input', () => { d.text = input.value; });
  cat.addEventListener('change',  () => { d.category = cat.value; });
  pri.addEventListener('change',  () => { d.priority = pri.value; });
  due.addEventListener('input',   () => { d.dueDate = due.value; });
  due.addEventListener('change',  () => { d.dueDate = due.value; });

  tr.addEventListener('keydown', e => {
    if (e.isComposing) return;               // 한글 조합 중 Enter 무시
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      finishEdit(todo.id, true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finishEdit(todo.id, false);
    }
  });

  /* 행 바깥으로 포커스가 나가면 저장 (기존 blur 저장 동작 유지) */
  tr.addEventListener('focusout', e => {
    const next = e.relatedTarget;
    if (next && tr.contains(next)) return;
    if (editingId !== todo.id) return;       // 이미 저장/취소됨 → 무시 (#4 핵심)
    const inTable = next && next.closest && next.closest('#todo-tbody');
    finishEdit(todo.id, true, { render: !inTable });
    if (inTable) {
      /* 다른 행의 버튼/체크박스로 이동한 경우: 그 동작이 다시 렌더링함. 남아 있으면 정리 */
      setTimeout(() => { if (tr.isConnected) renderTodos(); }, 250);
    }
  });

  if (window.matchMedia('(max-width: 640px)').matches) {
    /* 좁은 화면: 한 칸(colspan) 스택 폼 — 열 폭을 깨뜨리지 않음 */
    const td    = document.createElement('td');
    td.colSpan  = 6;
    td.className = 'edit-stack-cell';
    const stack = document.createElement('div');
    stack.className = 'edit-stack';
    const fields = document.createElement('div');
    fields.className = 'edit-stack__fields';
    fields.append(cat, pri, due);
    stack.append(input, fields, wrap);
    td.appendChild(stack);
    tr.appendChild(td);
    return tr;
  }

  tr.append(tdCk, tdTitle, tdCat, tdPri, tdDue, tdAct);
  return tr;
}

function startEdit(id) {
  if (editingId === id) return;
  if (editingId !== null) finishEdit(editingId, true, { render: false });

  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  editingId = id;
  editDraft = {
    text:     todo.text,
    category: todo.category,
    priority: todo.priority || '보통',
    dueDate:  todo.dueDate || '',
  };
  renderTodos();

  const input = document.querySelector(`tr[data-id="${id}"] .edit-input`);
  if (input) { input.focus(); input.select(); }
}

/* 저장/취소는 편집 1회당 한 번만 처리 */
function finishEdit(id, save, { render = true } = {}) {
  if (editingId !== id) return;
  const todo  = todos.find(t => t.id === id);
  const draft = editDraft;
  editingId = null;
  editDraft = null;

  if (save && todo && draft) {
    const newText = draft.text.trim();
    if (newText) todo.text = newText;        // 빈 값이면 기존 텍스트 유지
    todo.category = CATEGORIES.includes(draft.category) ? draft.category : todo.category;
    todo.priority = PRIORITIES.includes(draft.priority) ? draft.priority : (todo.priority || '보통');
    todo.dueDate  = draft.dueDate || '';
    saveTodos();
  }
  if (render) renderTodos();
}

/* ── 렌더링 ────────────────────────────────────── */
function renderTodos() {
  const tbody   = document.getElementById('todo-tbody');
  const empty   = document.getElementById('empty-message');
  const visible = getSorted(getFiltered());

  /* 편집 중인 항목은 필터와 무관하게 유지 */
  if (editingId !== null && !visible.some(t => t.id === editingId)) {
    const editing = todos.find(t => t.id === editingId);
    if (editing) visible.unshift(editing);
  }

  renderedDate = todayStr();
  tbody.innerHTML = '';

  if (visible.length === 0) {
    empty.style.display = 'block';
    empty.textContent   = todos.length === 0 ? '할 일이 없습니다.' : '조건에 맞는 할 일이 없습니다.';
  } else {
    empty.style.display = 'none';
    visible.forEach(todo => tbody.appendChild(createRow(todo)));
  }

  updateStats();
  updateSortUI();
}

function updateSortUI() {
  document.getElementById('sort-select').value = sortKey;
  document.getElementById('sort-dir-btn').textContent = sortDir === 'asc' ? '↑ 오름차순' : '↓ 내림차순';
  document.getElementById('pin-overdue').checked = pinOverdue;

  document.querySelectorAll('.todo-table th[data-sort]').forEach(th => {
    const active = th.dataset.sort === sortKey;
    th.classList.toggle('th-sorted', active);
    th.setAttribute('aria-sort', active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    th.querySelector('.sort-ind').textContent = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
  });

  document.querySelectorAll('#due-tabs .filter-tab').forEach(btn => {
    btn.classList.toggle('filter-tab--active', btn.dataset.due === dueFilter);
  });
}

/* ── 추가 ──────────────────────────────────────── */
function addTodo() {
  const input = document.getElementById('todo-input');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }

  todos.push({
    id:        Date.now(),
    text,
    category:  document.getElementById('category-select').value,
    priority:  document.getElementById('priority-select').value,
    dueDate:   document.getElementById('due-date').value,
    completed: false,
    createdAt: new Date().toISOString(),
  });

  saveTodos();
  renderTodos();

  input.value = '';
  document.getElementById('due-date').value = '';
  input.focus();
}

/* ── 완료 토글 ─────────────────────────────────── */
function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) todo.completed = !todo.completed;
  saveTodos();
  renderTodos();
}

/* ── 실행 취소 토스트 (#5) ─────────────────────── */
let undoTimer   = null;
let undoRestore = null;

function showUndo(message, restoreFn) {
  const toast = document.getElementById('toast');
  clearTimeout(undoTimer);
  undoRestore = restoreFn;                   // 새 삭제가 오면 이전 Undo는 확정
  document.getElementById('toast-msg').textContent = message;
  document.getElementById('toast-undo').hidden = !restoreFn;   // 안내 메시지는 Undo 버튼 없이
  toast.hidden = false;
  toast.classList.remove('toast--show');
  void toast.offsetWidth;                    // 진행 바 애니메이션 재시작
  toast.classList.add('toast--show');
  undoTimer = setTimeout(hideUndo, UNDO_MS);
}

function hideUndo() {
  clearTimeout(undoTimer);
  undoTimer   = null;
  undoRestore = null;
  const toast = document.getElementById('toast');
  toast.classList.remove('toast--show');
  toast.hidden = true;
}

function undoLast() {
  if (!undoRestore) return;
  const restore = undoRestore;
  hideUndo();
  restore();
  saveTodos();
  renderTodos();
}

/* 삭제된 항목을 원래 위치(인덱스 오름차순)로 되돌림 */
function restoreItems(removed) {
  removed
    .sort((a, b) => a.index - b.index)
    .forEach(({ item, index }) => {
      if (todos.some(t => t.id === item.id)) return;
      todos.splice(Math.min(index, todos.length), 0, item);
    });
}

/* ── 삭제 ──────────────────────────────────────── */
function deleteTodo(id) {
  const index = todos.findIndex(t => t.id === id);
  if (index < 0) return;
  if (editingId === id) { editingId = null; editDraft = null; }

  const [item] = todos.splice(index, 1);
  saveTodos();
  renderTodos();

  const label = item.text.length > 20 ? item.text.slice(0, 20) + '…' : item.text;
  showUndo(`"${label}" 삭제됨`, () => restoreItems([{ item, index }]));
}

/* ── 완료 항목 일괄 삭제 (#5: 확인 + Undo) ────── */
function clearCompleted() {
  const count = todos.filter(t => t.completed).length;
  if (count === 0) return;                   // 버튼도 비활성화됨 (진행 중인 Undo를 덮지 않음)
  if (!confirm(`완료된 할 일 ${count}개를 삭제할까요?\n삭제 후 5초 동안 실행 취소할 수 있습니다.`)) return;

  const removed = [];
  todos.forEach((item, index) => { if (item.completed) removed.push({ item, index }); });
  todos = todos.filter(t => !t.completed);
  if (editingId !== null && !todos.some(t => t.id === editingId)) { editingId = null; editDraft = null; }

  saveTodos();
  renderTodos();
  showUndo(`완료된 할 일 ${count}개 삭제됨`, () => restoreItems(removed));
}

/* ── 필터 탭 ───────────────────────────────────── */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('#status-tabs .filter-tab').forEach(btn => {
    btn.classList.toggle('filter-tab--active', btn.dataset.filter === filter);
  });
  renderTodos();
}

function setDueFilter(key) {
  dueFilter = key;
  savePrefs();
  renderTodos();
}

function setSort(key, dir) {
  sortKey = key;
  sortDir = dir;
  savePrefs();
  renderTodos();
}

/* ── 날짜 변경 감시 (#3: 자정 자동 재렌더링) ──── */
function checkDateChange() {
  if (todayStr() !== renderedDate) renderTodos();
}

/* ── 이벤트 바인딩 ─────────────────────────────── */
document.getElementById('add-toggle-btn').addEventListener('click', () => {
  const form = document.getElementById('add-form');
  form.hidden = !form.hidden;
  if (!form.hidden) document.getElementById('todo-input').focus();
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  document.getElementById('add-form').hidden = true;
});

document.getElementById('submit-btn').addEventListener('click', addTodo);

document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) addTodo();
});

document.querySelectorAll('#status-tabs .filter-tab').forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

document.querySelectorAll('#due-tabs .filter-tab').forEach(btn => {
  btn.addEventListener('click', () => setDueFilter(btn.dataset.due));
});

document.getElementById('sort-select').addEventListener('change', e => setSort(e.target.value, 'asc'));

document.getElementById('sort-dir-btn').addEventListener('click', () => {
  setSort(sortKey, sortDir === 'asc' ? 'desc' : 'asc');
});

document.querySelectorAll('.todo-table th[data-sort]').forEach(th => {
  const activate = () => {
    const key = th.dataset.sort;
    setSort(key, sortKey === key && sortDir === 'asc' ? 'desc' : 'asc');
  };
  th.addEventListener('click', activate);
  th.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });
});

document.getElementById('pin-overdue').addEventListener('change', e => {
  pinOverdue = e.target.checked;
  savePrefs();
  renderTodos();
});

document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderTodos();
});

document.getElementById('filter-category').addEventListener('change', e => {
  filterCat = e.target.value;
  renderTodos();
});

document.getElementById('clear-done-btn').addEventListener('click', clearCompleted);

document.getElementById('toast-undo').addEventListener('click', undoLast);
document.getElementById('toast-close').addEventListener('click', hideUndo);

/* Ctrl/Cmd+Z: 입력 중이 아닐 때 마지막 삭제 실행 취소 */
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing && undoRestore) {
    e.preventDefault();
    undoLast();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkDateChange();
});
setInterval(checkDateChange, 60 * 1000);

/* ── 초기화 ─────────────────────────────────────── */
loadTodos();
loadPrefs();
renderTodos();
