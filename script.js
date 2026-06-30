/* ── 상태 ──────────────────────────────────────── */
const STORAGE_KEY = 'todos-v2';

let todos         = [];
let currentFilter = 'all';
let filterCat     = '';
let searchQuery   = '';

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

/* ── 유틸 ──────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(todo) {
  return !todo.completed && !!todo.dueDate && todo.dueDate < todayStr();
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
}

/* ── 필터링 ────────────────────────────────────── */
function getFiltered() {
  return todos.filter(todo => {
    if (currentFilter === 'active'    &&  todo.completed) return false;
    if (currentFilter === 'completed' && !todo.completed) return false;
    if (filterCat && todo.category !== filterCat)         return false;
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
}

/* ── 행 생성 ───────────────────────────────────── */
function createRow(todo) {
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
  cb.addEventListener('change', () => toggleTodo(todo.id));
  tdCk.appendChild(cb);

  /* 제목 */
  const tdTitle   = document.createElement('td');
  const titleWrap = document.createElement('div');
  titleWrap.className = 'title-cell';

  const textSpan       = document.createElement('span');
  textSpan.className   = 'todo-text';
  textSpan.textContent = todo.text;
  titleWrap.appendChild(textSpan);

  if (isOverdue(todo)) {
    const tag       = document.createElement('span');
    tag.className   = 'overdue-tag';
    tag.textContent = '마감 초과';
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

/* ── 렌더링 ────────────────────────────────────── */
function renderTodos() {
  const tbody   = document.getElementById('todo-tbody');
  const empty   = document.getElementById('empty-message');
  const visible = getFiltered();

  tbody.innerHTML = '';

  if (visible.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    visible.forEach(todo => tbody.appendChild(createRow(todo)));
  }

  updateStats();
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

/* ── 인라인 수정 ──────────────────────────────── */
function startEdit(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const tr        = document.querySelector(`tr[data-id="${id}"]`);
  const titleCell = tr.querySelector('.title-cell');
  const textSpan  = titleCell.querySelector('.todo-text');

  const input     = document.createElement('input');
  input.type      = 'text';
  input.className = 'edit-input';
  input.value     = todo.text;

  function commit() {
    const newText = input.value.trim();
    if (newText) todo.text = newText;
    saveTodos();
    renderTodos();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') renderTodos();
  });
  input.addEventListener('blur', commit);

  textSpan.replaceWith(input);
  input.focus();
  input.select();
}

/* ── 삭제 ──────────────────────────────────────── */
function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
}

/* ── 완료 항목 일괄 삭제 ──────────────────────── */
function clearCompleted() {
  if (!todos.some(t => t.completed)) return;
  todos = todos.filter(t => !t.completed);
  saveTodos();
  renderTodos();
}

/* ── 필터 탭 ───────────────────────────────────── */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('filter-tab--active', btn.dataset.filter === filter);
  });
  renderTodos();
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
  if (e.key === 'Enter') addTodo();
});

document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
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

/* ── 초기화 ─────────────────────────────────────── */
loadTodos();
renderTodos();
