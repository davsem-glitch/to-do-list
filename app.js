/* Daylight — task management and productivity logic.
   Keeps the original localStorage key and task fields for backward compatibility. */
(() => {
  'use strict';

  const STORAGE_KEY = 'daylight-todo-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
  const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
  const REPEATS = ['none', 'daily', 'weekly', 'monthly'];
  const DEFAULT_CATEGORIES = ['Personal', 'Work', 'Study', 'Health', 'Shopping', 'Other'];

  const uid = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-5)}`;
  const localISO = (date = new Date()) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayISO = () => localISO();
  const addDays = (iso, amount) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return localISO(d);
  };
  const addMonths = (iso, amount) => {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year, month - 1 + amount, 1, 12);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return localISO(target);
  };
  const formatDate = (iso, options = { month: 'short', day: 'numeric' }) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, options) : 'No due date';
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const toValidNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const seedTasks = () => [
    { id: uid(), title: 'Plan the week ahead', description: 'Choose the three most important things to make progress on.', date: todayISO(), time: '09:30', priority: 'high', category: 'Personal', tags: ['planning'], repeat: 'none', done: false, createdAt: Date.now() - 900000, subtasks: ['Review calendar', 'Choose top priorities'] },
    { id: uid(), title: 'Finish project update', description: 'Prepare a short summary for the team.', date: todayISO(), time: '14:00', priority: 'high', category: 'Work', tags: ['project'], repeat: 'none', done: false, createdAt: Date.now() - 800000, subtasks: [] },
    { id: uid(), title: 'Take a mindful break', description: 'Step away from the screen and get some fresh air.', date: todayISO(), time: '16:00', priority: 'low', category: 'Health', repeat: 'none', done: true, createdAt: Date.now() - 700000, completedAt: Date.now(), subtasks: [] },
    { id: uid(), title: 'Read 10 pages', description: 'A small step toward a consistent reading habit.', date: addDays(todayISO(), 1), time: '20:00', priority: 'medium', category: 'Study', repeat: 'daily', done: false, createdAt: Date.now() - 600000, subtasks: [] },
    { id: uid(), title: 'Pick up groceries', description: 'Remember fruit, vegetables and coffee.', date: addDays(todayISO(), 2), time: '17:30', priority: 'medium', category: 'Shopping', repeat: 'none', done: false, createdAt: Date.now() - 500000, subtasks: [] }
  ];
  const seedHabits = () => [
    { id: uid(), name: 'Drink 8 glasses of water', icon: '💧', goal: 'Every day', checks: [], streak: 0 },
    { id: uid(), name: 'Read for 20 minutes', icon: '📚', goal: 'Every day', checks: [], streak: 0 },
    { id: uid(), name: 'Move your body', icon: '🏃', goal: '3 times a week', checks: [], streak: 0 }
  ];

  function normalizeTask(task, index = 0) {
    const source = task && typeof task === 'object' ? task : {};
    const subtasks = Array.isArray(source.subtasks)
      ? source.subtasks.map((item) => typeof item === 'string' ? item.trim() : String(item?.title ?? '').trim()).filter(Boolean).slice(0, 30)
      : [];
    const doneValues = Array.isArray(source.subtaskDone) ? source.subtaskDone : [];
    return {
      ...source,
      id: String(source.id || uid()),
      title: String(source.title || 'Untitled task').trim().slice(0, 100),
      description: String(source.description || '').slice(0, 1000),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(source.date || '')) ? String(source.date) : '',
      time: /^\d{2}:\d{2}$/.test(String(source.time || '')) ? String(source.time) : '',
      priority: PRIORITIES.includes(source.priority) ? source.priority : 'medium',
      category: String(source.category || 'Personal').trim().slice(0, 50) || 'Personal',
      tags: Array.isArray(source.tags) ? [...new Set(source.tags.map((tag) => String(tag).trim().replace(/^#/, '').slice(0, 30)).filter(Boolean))].slice(0, 12) : [],
      repeat: REPEATS.includes(source.repeat) ? source.repeat : 'none',
      subtasks,
      subtaskDone: subtasks.map((_, i) => Boolean(doneValues[i])),
      done: Boolean(source.done),
      createdAt: toValidNumber(source.createdAt, Date.now() - index),
      order: toValidNumber(source.order, index),
      ...(source.completedAt ? { completedAt: toValidNumber(source.completedAt, Date.now()) } : {})
    };
  }

  function normalizeHabit(habit) {
    const source = habit && typeof habit === 'object' ? habit : {};
    return {
      ...source,
      id: String(source.id || uid()),
      name: String(source.name || 'New habit').trim().slice(0, 60),
      icon: String(source.icon || '✧').slice(0, 8),
      goal: String(source.goal || 'Every day').slice(0, 40),
      checks: Array.isArray(source.checks) ? [...new Set(source.checks.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date))))] : [],
      streak: toValidNumber(source.streak, 0)
    };
  }

  function normalizeState(source) {
    const tasks = Array.isArray(source.tasks) ? source.tasks.map(normalizeTask) : [];
    tasks.sort((a, b) => a.order - b.order);
    tasks.forEach((task, index) => { task.order = index; });
    return {
      tasks,
      habits: Array.isArray(source.habits) ? source.habits.map(normalizeHabit) : [],
      dark: Boolean(source.dark),
      focusSessions: Math.max(0, toValidNumber(source.focusSessions, 0)),
      dailyGoal: Math.min(50, Math.max(1, toValidNumber(source.dailyGoal, 3)))
    };
  }

  let storageUnavailable = false;
  let storageCorrupt = false;
  let corruptedStorageValue = null;
  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageUnavailable = true;
      console.warn('Daylight could not read local storage:', error);
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.habits)) throw new Error('Stored data is missing required task or habit collections');
        return normalizeState(parsed);
      } catch (error) {
        // Never replace unreadable existing user data with demo data on the next save.
        storageCorrupt = true;
        corruptedStorageValue = raw;
        console.warn('Daylight found unreadable local data and will preserve the original value:', error);
      }
    }
    return normalizeState({ tasks: seedTasks(), habits: seedHabits(), dark: false, focusSessions: 0, dailyGoal: 3 });
  }

  let state = loadState();
  let activeFilter = 'all';
  let upcomingFilter = 'all';
  let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDate = todayISO();
  let timerSeconds = 25 * 60;
  let timerDeadline = null;
  let timerInterval = null;
  let timerRunning = false;
  let timerMode = 'Focus';
  let toastTimer = null;
  let lastFocusedElement = null;
  let draggingId = null;
  const sentReminders = new Set();

  function save(showError = true) {
    if (storageCorrupt) {
      if (showError) toast('Existing local data could not be read. It has been left untouched; export a recovery copy or import a known backup.', 'error');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageUnavailable = false;
      return true;
    } catch (error) {
      console.error('Daylight could not save local data:', error);
      if (showError) toast('Could not save changes. Export a backup and check this browser’s storage settings.', 'error');
      storageUnavailable = true;
      return false;
    }
  }

  function toast(message, type = 'success') {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 3000);
  }

  function isOverdue(task) { return !task.done && Boolean(task.date) && task.date < todayISO(); }
  function isToday(task) { return task.date === todayISO(); }
  function priorityLabel(priority) { return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`; }

  function taskMarkup(task, options = {}) {
    const overdue = isOverdue(task);
    const completedSubtasks = task.subtaskDone.filter(Boolean).length;
    const hasSubtasks = task.subtasks.length > 0;
    const tags = task.tags.map((tag) => `<span class="pill tag-pill">#${escapeHTML(tag)}</span>`).join('');
    const subtasks = hasSubtasks ? `
      <div class="subtasks-inline" aria-label="Checklist">
        ${task.subtasks.slice(0, 6).map((item, index) => `
          <label class="subtask-item ${task.subtaskDone[index] ? 'is-done' : ''}">
            <input type="checkbox" data-subtask="${index}" aria-label="Complete checklist item: ${escapeHTML(item)}" ${task.subtaskDone[index] ? 'checked' : ''}>
            <span>${escapeHTML(item)}</span>
          </label>`).join('')}
        ${task.subtasks.length > 6 ? `<span class="subtask-more">+${task.subtasks.length - 6} more</span>` : ''}
        <span class="subtask-count">${completedSubtasks}/${task.subtasks.length}</span>
      </div>` : '';
    return `
      <article class="task ${task.done ? 'done' : ''} ${options.manual ? 'manual-order' : ''}" data-id="${escapeHTML(task.id)}" draggable="${options.draggable !== false}" tabindex="0">
        ${options.draggable === false ? '' : '<span class="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>'}
        <input class="check" type="checkbox" aria-label="Mark ${escapeHTML(task.title)} complete" ${task.done ? 'checked' : ''}>
        <div class="task-main">
          <div class="task-title">${escapeHTML(task.title)}</div>
          ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
          <div class="task-meta">
            <span class="pill ${task.priority}">${priorityLabel(task.priority)}</span>
            <span class="pill">${escapeHTML(task.category)}</span>
            <span class="pill ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue' : formatDate(task.date)}${task.time ? ` · ${escapeHTML(task.time)}` : ''}</span>
            ${task.repeat !== 'none' ? `<span class="pill">↻ ${escapeHTML(task.repeat)}</span>` : ''}
            ${tags}
          </div>
          ${subtasks}
        </div>
        <div class="task-actions">
          ${options.manual ? `<button class="tiny-btn move-task" data-move="up" title="Move up" aria-label="Move ${escapeHTML(task.title)} up">↑</button><button class="tiny-btn move-task" data-move="down" title="Move down" aria-label="Move ${escapeHTML(task.title)} down">↓</button>` : ''}
          <button class="tiny-btn edit-task" title="Edit task" aria-label="Edit ${escapeHTML(task.title)}">✎</button>
          <button class="tiny-btn delete-task" title="Delete task" aria-label="Delete ${escapeHTML(task.title)}">×</button>
        </div>
      </article>`;
  }

  function currentTaskFilters() {
    return {
      query: $('#searchInput').value.trim().toLocaleLowerCase(),
      priority: $('#filterPriority').value,
      category: $('#filterCategory').value,
      date: $('#filterDate').value,
      sort: $('#sortSelect').value
    };
  }

  function matchesTaskFilters(task, filters) {
    const haystack = [task.title, task.description, task.category, ...task.tags, ...task.subtasks].join(' ').toLocaleLowerCase();
    if (filters.query ? !haystack.includes(filters.query) : false) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.category !== 'all' && task.category !== filters.category) return false;
    if (!filters.query) {
      if (filters.date === 'today' && !(isToday(task) || !task.date)) return false;
      if (filters.date === 'upcoming' && !(task.date >= todayISO() && !task.done)) return false;
      if (filters.date === 'overdue' && !isOverdue(task)) return false;
      if (filters.date === 'no-date' && Boolean(task.date)) return false;
    }
    if (activeFilter === 'active' && task.done) return false;
    if (activeFilter === 'done' && !task.done) return false;
    return true;
  }

  function sortTasks(tasks, sortMode) {
    return tasks.sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (sortMode === 'manual') return a.order - b.order;
      if (sortMode === 'created') return b.createdAt - a.createdAt;
      if (sortMode === 'deadline') {
        const dateCompare = (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
        return dateCompare || (a.time || '99:99').localeCompare(b.time || '99:99') || a.order - b.order;
      }
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')
        || (a.time || '99:99').localeCompare(b.time || '99:99')
        || a.order - b.order;
    });
  }

  function updateCategoryFilter() {
    const select = $('#filterCategory');
    if (!select) return;
    const current = select.value || 'all';
    const categories = [...new Set([...DEFAULT_CATEGORIES, ...state.tasks.map((task) => task.category)])].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="all">All categories</option>' + categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
    select.value = categories.includes(current) ? current : 'all';
    const datalist = $('#categoryOptions');
    if (datalist) datalist.innerHTML = categories.map((category) => `<option value="${escapeHTML(category)}"></option>`).join('');
  }

  function renderTaskList() {
    updateCategoryFilter();
    const filters = currentTaskFilters();
    let tasks = state.tasks.filter((task) => matchesTaskFilters(task, filters));
    sortTasks(tasks, filters.sort);
    $('#taskList').innerHTML = tasks.length ? tasks.map((task) => taskMarkup(task, { manual: filters.sort === 'manual' })).join('') : `
      <div class="empty">
        <div class="empty-icon">${filters.query ? '⌕' : '🌤️'}</div>
        <strong>${filters.query ? 'No matching tasks' : 'A clear space to start'}</strong>
        <span>${filters.query ? 'Try another keyword or adjust your filters.' : 'Add a task and make today count.'}</span>
        ${!filters.query ? '<button class="secondary empty-add" data-add-empty>＋ Create your first task</button>' : ''}
      </div>`;
    $('#taskSubhead').textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} shown${filters.query ? ' across your list' : ''}`;
  }

  function renderStats() {
    const todayTasks = state.tasks.filter(isToday);
    const completedToday = todayTasks.filter((task) => task.done).length;
    const pendingToday = todayTasks.length - completedToday;
    const overdue = state.tasks.filter(isOverdue).length;
    const upcoming = state.tasks.filter((task) => !task.done && task.date >= todayISO() && task.date <= addDays(todayISO(), 7)).length;
    $('#statTotal').textContent = state.tasks.length;
    $('#statToday').textContent = todayTasks.length;
    $('#statDone').textContent = completedToday;
    $('#statPending').textContent = pendingToday;
    $('#statOverdue').textContent = overdue;
    $('#statUpcoming').textContent = upcoming;
    $('#todayCount').textContent = pendingToday;
    const percentage = todayTasks.length ? Math.round(completedToday / todayTasks.length * 100) : 0;
    $('#progressPercent').textContent = `${percentage}%`;
    $('#progressRing').style.setProperty('--progress', `${percentage}%`);
    $('#progressBar').style.width = `${percentage}%`;
    $('#progressLabel').textContent = percentage === 100 ? 'Amazing work!' : percentage >= 50 ? 'You’re building momentum' : 'Let’s get started';
    $('#progressDetail').textContent = `${completedToday} of ${todayTasks.length} tasks completed today`;
    const goalPercent = Math.min(100, Math.round(completedToday / state.dailyGoal * 100));
    $('#dailyGoalValue').textContent = state.dailyGoal;
    $('#dailyGoalProgress').textContent = `${completedToday} / ${state.dailyGoal} completed`;
    $('#dailyGoalBar').style.width = `${goalPercent}%`;
    $('#dailyGoalBar').setAttribute('aria-valuenow', String(goalPercent));
    $('#dailyGoalMessage').textContent = completedToday >= state.dailyGoal ? 'Daily goal reached — excellent work.' : `${Math.max(0, state.dailyGoal - completedToday)} more to reach your goal`;
  }

  function renderUpcoming() {
    let tasks = state.tasks.filter((task) => !task.done && task.date);
    if (upcomingFilter === 'week') tasks = tasks.filter((task) => task.date >= todayISO() && task.date <= addDays(todayISO(), 7));
    else if (upcomingFilter === 'late') tasks = tasks.filter(isOverdue);
    else tasks = tasks.filter((task) => task.date >= todayISO() || isOverdue(task));
    tasks.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99'));
    $('#upcomingList').innerHTML = tasks.length ? tasks.map((task) => taskMarkup(task, { draggable: false })).join('') : `
      <div class="empty"><div class="empty-icon">🗓️</div><strong>No ${upcomingFilter === 'late' ? 'overdue' : 'upcoming'} tasks</strong><span>Enjoy the breathing room or add something new.</span></div>`;
  }

  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    $('#monthTitle').textContent = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `<div class="day-name">${day}</div>`).join('');
    for (let index = 0; index < 42; index += 1) {
      let dateNumber;
      let monthOffset = 0;
      if (index < offset) { dateNumber = previousMonthDays - offset + index + 1; monthOffset = -1; }
      else if (index >= offset + daysInMonth) { dateNumber = index - offset - daysInMonth + 1; monthOffset = 1; }
      else dateNumber = index - offset + 1;
      const date = new Date(year, month + monthOffset, dateNumber, 12);
      const iso = localISO(date);
      const dayTasks = state.tasks.filter((task) => task.date === iso);
      const count = dayTasks.length;
      const doneCount = dayTasks.filter((task) => task.done).length;
      html += `<button class="day-cell ${monthOffset ? 'muted' : ''} ${iso === selectedDate ? 'selected' : ''} ${iso === todayISO() ? 'today-cell' : ''}" data-date="${iso}" aria-label="${formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} tasks">
        <span class="day-number">${dateNumber}</span><div class="day-dots">${count ? `<i class="day-dot"></i>`.repeat(Math.min(count, 4)) : ''}</div>
        ${count ? `<span class="day-count">${doneCount}/${count}</span>` : ''}
      </button>`;
    }
    $('#calendarGrid').innerHTML = html;
    renderSelectedDay();
  }

  function renderSelectedDay() {
    const tasks = state.tasks.filter((task) => task.date === selectedDate).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    $('#selectedDateTitle').textContent = formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' });
    $('#selectedDateSub').textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} scheduled`;
    $('#selectedDayTasks').innerHTML = tasks.length ? tasks.map((task) => `
      <div class="mini-task ${task.done ? 'is-done' : ''}" data-mini-task="${escapeHTML(task.id)}">
        <label><input type="checkbox" data-mini-check ${task.done ? 'checked' : ''} aria-label="Complete ${escapeHTML(task.title)}"><span>${escapeHTML(task.title)}</span></label>
        <small>${task.time ? `${escapeHTML(task.time)} · ` : ''}${task.done ? 'Completed' : escapeHTML(priorityLabel(task.priority))}</small>
        <button class="mini-edit" data-mini-edit aria-label="Edit ${escapeHTML(task.title)}">Edit</button>
      </div>`).join('') : '<div class="empty" style="padding:20px 5px"><span>No tasks for this day.</span></div>';
  }

  function habitStreak(habit) {
    let date = todayISO();
    if (!habit.checks.includes(date)) date = addDays(date, -1);
    let streak = 0;
    while (habit.checks.includes(date)) { streak += 1; date = addDays(date, -1); }
    return streak;
  }

  function renderHabits() {
    const today = todayISO();
    $('#habitsGrid').innerHTML = state.habits.length ? state.habits.map((habit) => {
      const done = habit.checks.includes(today);
      const streak = habitStreak(habit);
      return `<article class="card habit">
        <div class="habit-icon">${escapeHTML(habit.icon)}</div><h3>${escapeHTML(habit.name)}</h3><p>${escapeHTML(habit.goal)}</p>
        <div class="habit-foot"><span class="streak">🔥 ${streak} day streak</span><button class="habit-done ${done ? 'done' : ''}" data-habit="${escapeHTML(habit.id)}">${done ? '✓ Done today' : 'Mark done'}</button></div>
        <button class="tiny-btn delete-habit" data-habit-delete="${escapeHTML(habit.id)}" title="Remove habit" style="margin-top:9px">Remove ×</button>
      </article>`;
    }).join('') : '<div class="card empty" style="grid-column:1/-1"><div class="empty-icon">🌱</div><strong>Plant your first habit</strong><span>Choose one small routine you want to repeat.</span></div>';
  }

  function renderRecent() {
    const recent = state.tasks.filter((task) => task.done).sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt)).slice(0, 4);
    $('#recentList').innerHTML = recent.length ? recent.map((task) => `
      <button class="recent-item" data-open-task="${escapeHTML(task.id)}">
        <span class="recent-check">✓</span><span class="recent-title">${escapeHTML(task.title)}</span><small>${task.completedAt ? formatDate(localISO(new Date(task.completedAt)), { month: 'short', day: 'numeric' }) : 'Completed'}</small>
      </button>`).join('') : '<div class="recent-empty">Completed tasks will show up here.</div>';
  }

  function renderInsights() {
    const total = state.tasks.length;
    const done = state.tasks.filter((task) => task.done).length;
    const rate = total ? Math.round(done / total * 100) : 0;
    const weekDates = Array.from({ length: 7 }, (_, index) => addDays(todayISO(), index - 6));
    const weekDone = weekDates.map((date) => state.tasks.filter((task) => task.done && task.completedAt && localISO(new Date(task.completedAt)) === date).length);
    const max = Math.max(1, ...weekDone);
    $('#allTasksMetric').textContent = total;
    $('#completionMetric').textContent = `${rate}%`;
    $('#focusMetric').textContent = state.focusSessions;
    $('#habitMetric').textContent = state.habits.reduce((count, habit) => count + habit.checks.filter((date) => date >= addDays(todayISO(), -6)).length, 0);
    $('#weeklyChart').innerHTML = weekDates.map((date, index) => `
      <div class="bar-col"><div class="bar" style="height:${Math.max(3, weekDone[index] / max * 110)}px" title="${weekDone[index]} completed" aria-label="${weekDone[index]} completed"></div>
      <span>${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</span></div>`).join('');
    const categories = [...new Set([...DEFAULT_CATEGORIES, ...state.tasks.map((task) => task.category)])];
    const categoryCounts = categories.map((category) => state.tasks.filter((task) => task.category === category).length);
    const maxCategoryCount = Math.max(1, ...categoryCounts);
    $('#categoryChart').innerHTML = categories.map((category, index) => `
      <div class="category-row"><span class="cat-name">${escapeHTML(category)}</span><div class="progress-bar"><span style="width:${categoryCounts[index] / maxCategoryCount * 100}%"></span></div><b>${categoryCounts[index]}</b></div>`).join('');
    const habitChecks = state.habits.reduce((count, habit) => count + habit.checks.filter((date) => date >= addDays(todayISO(), -6)).length, 0);
    const score = Math.min(100, Math.round(rate * 0.7 + Math.min(30, habitChecks * 5)));
    $('#productivityScore').innerHTML = `${score}<span style="font-size:15px;color:var(--muted)">/100</span>`;
    $('#scoreBar').style.width = `${score}%`;
    $('#insightTip').textContent = score >= 80 ? 'You’re showing great consistency. Protect your focus time.' : score >= 50 ? 'Good momentum. Choose a clear top priority tomorrow.' : 'Start small: finish one meaningful task and build from there.';
  }

  function renderAll() {
    renderTaskList();
    renderStats();
    renderUpcoming();
    renderCalendar();
    renderHabits();
    renderRecent();
    renderInsights();
  }

  function openTaskModal(task = null) {
    lastFocusedElement = document.activeElement;
    $('#taskForm').reset();
    $('#taskId').value = task?.id || '';
    $('#modalTitle').textContent = task ? 'Edit task' : 'Create a task';
    $('#taskTitle').value = task?.title || '';
    $('#taskDescription').value = task?.description || '';
    $('#taskDate').value = task?.date || ($('#page-calendar').classList.contains('active') ? selectedDate : todayISO());
    $('#taskTime').value = task?.time || '';
    $('#taskPriority').value = task?.priority || 'medium';
    $('#taskCategory').value = task?.category || 'Personal';
    $('#taskTags').value = (task?.tags || []).join(', ');
    $('#taskRepeat').value = task?.repeat || 'none';
    $('#taskSubtasks').value = (task?.subtasks || []).join('\n');
    $('#taskModal').classList.add('show');
    setTimeout(() => $('#taskTitle').focus(), 40);
  }

  function closeTaskModal() {
    $('#taskModal').classList.remove('show');
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  }

  function preserveChecklistState(previousTask, nextSubtasks) {
    const states = new Map();
    (previousTask?.subtasks || []).forEach((item, index) => {
      if (!states.has(item)) states.set(item, []);
      states.get(item).push(Boolean(previousTask.subtaskDone?.[index]));
    });
    return nextSubtasks.map((item) => states.has(item) && states.get(item).length ? states.get(item).shift() : false);
  }

  function saveTask(event) {
    event.preventDefault();
    const id = $('#taskId').value;
    const previous = id ? state.tasks.find((task) => task.id === id) : null;
    const title = $('#taskTitle').value.trim();
    if (!title) { $('#taskTitle').focus(); return; }
    const subtasks = $('#taskSubtasks').value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 30);
    const tags = [...new Set($('#taskTags').value.split(',').map((tag) => tag.trim().replace(/^#/, '').slice(0, 30)).filter(Boolean))].slice(0, 12);
    const task = normalizeTask({
      ...(previous || {}),
      id: id || uid(),
      title,
      description: $('#taskDescription').value.trim(),
      date: $('#taskDate').value,
      time: $('#taskTime').value,
      priority: $('#taskPriority').value,
      category: $('#taskCategory').value.trim() || 'Personal',
      tags,
      repeat: $('#taskRepeat').value,
      subtasks,
      subtaskDone: preserveChecklistState(previous, subtasks),
      done: previous?.done || false,
      createdAt: previous?.createdAt || Date.now(),
      completedAt: previous?.completedAt,
      order: previous?.order ?? -1
    });
    if (previous) {
      state.tasks = state.tasks.map((item) => item.id === id ? task : item);
      toast('Task updated');
    } else {
      task.order = -1;
      state.tasks.unshift(task);
      state.tasks.forEach((item, index) => { item.order = index; });
      toast('Task added');
    }
    save();
    closeTaskModal();
    renderAll();
  }

  function toggleTask(id, checked) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    task.done = checked;
    if (checked) {
      task.completedAt = Date.now();
      if (task.repeat !== 'none' && task.date) {
        const nextDate = task.repeat === 'daily' ? addDays(task.date, 1)
          : task.repeat === 'weekly' ? addDays(task.date, 7) : addMonths(task.date, 1);
        state.tasks.unshift({ ...task, id: uid(), date: nextDate, done: false, createdAt: Date.now(), completedAt: null, subtaskDone: task.subtasks.map(() => false), order: -1 });
        state.tasks.forEach((item, index) => { item.order = index; });
        toast(`Completed — next ${task.repeat} task added`);
      } else toast('Nice work! Task completed.');
    } else {
      delete task.completedAt;
      toast('Task moved back to active');
    }
    save();
    renderAll();
  }

  function toggleSubtask(id, index, checked) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task || !task.subtasks[index]) return;
    task.subtaskDone[index] = checked;
    save();
    renderTaskList();
    renderUpcoming();
    renderSelectedDay();
  }

  function deleteTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    if (!confirm(`Permanently delete “${task.title}”?`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== id);
    save();
    renderAll();
    toast('Task deleted');
  }

  function showPage(name) {
    $$('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));
    $$('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === name));
    $('#sidebar').classList.remove('open');
    if (name === 'calendar') renderCalendar();
    if (name === 'insights') renderInsights();
  }

  function planDay() {
    const pending = state.tasks.filter((task) => !task.done).sort((a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')
      || (a.time || '99:99').localeCompare(b.time || '99:99'));
    const top = pending.slice(0, 3);
    const box = $('#planResult');
    if (!top.length) {
      box.textContent = 'You have no open tasks. Enjoy the extra space or add a new goal!';
      box.classList.add('show');
      return;
    }
    box.innerHTML = `<strong>A suggested order for today</strong>${top.map((task, index) => `
      <div class="plan-task"><span>${index + 1}</span><div>${escapeHTML(task.title)}<small>${escapeHTML(priorityLabel(task.priority))}${task.date ? ` · ${formatDate(task.date)}` : ''}</small></div></div>`).join('')}
      <div class="plan-tip">Tip: Start with the first task, then take a short focused break.</div>`;
    box.classList.add('show');
  }

  function renderDateGreeting() {
    const hour = new Date().getHours();
    $('#greetingTitle').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'} ✨`;
    $('#dateLine').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function updateTimer() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    $('#timerDisplay').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function timerTick() {
    if (timerDeadline) timerSeconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    updateTimer();
    if (timerSeconds > 0) return;
    clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = null;
    timerRunning = false;
    $('#timerStart').textContent = 'Start focus';
    $('#timerCaption').textContent = `${timerMode} complete — well done!`;
    if (timerMode === 'Focus') {
      state.focusSessions += 1;
      save();
      renderInsights();
    }
    toast(`${timerMode} session complete!`);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Daylight', { body: `${timerMode} session complete. Time for your next step.` }); } catch (error) { console.info('Notification could not be displayed.', error); }
    }
  }

  function setTimer(minutes, mode) {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = null;
    timerRunning = false;
    timerSeconds = minutes * 60;
    timerMode = mode;
    $('#timerStart').textContent = `Start ${mode === 'Focus' ? 'focus' : 'break'}`;
    $('#timerCaption').textContent = mode === 'Focus' ? 'Ready when you are' : 'Take a moment to recharge';
    $$('.focus-modes button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    updateTimer();
  }

  function toggleFocusMode() {
    const enabled = !document.body.classList.contains('focus-mode');
    document.body.classList.toggle('focus-mode', enabled);
    $('#focusModeBtn').textContent = enabled ? '↙ Exit focus' : '↗ Focus mode';
    $('#focusModeBtn').setAttribute('aria-pressed', String(enabled));
    if (enabled && !$('#page-today').classList.contains('active')) showPage('today');
    toast(enabled ? 'Focus mode on — distractions hidden.' : 'Focus mode off.');
  }

  function toggleTheme() {
    state.dark = !state.dark;
    document.body.classList.toggle('dark', state.dark);
    updateThemeButton();
    save();
  }

  function updateThemeButton() {
    $('#themeBtn').textContent = state.dark ? '☀' : '☾';
    $('#themeSide').querySelector('.nav-count').textContent = state.dark ? 'Light' : 'Dark';
    $('#themeSide').querySelector('.nav-icon').textContent = state.dark ? '☀' : '☾';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.dark ? '#151724' : '#f5f6fc');
  }

  function exportData() {
    const payload = {
      ...state,
      exportedAt: new Date().toISOString(),
      app: 'Daylight',
      version: 2,
      ...(storageCorrupt ? { recovery: { storageKey: STORAGE_KEY, unreadableOriginalValue: corruptedStorageValue } } : {})
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daylight-${storageCorrupt ? 'recovery' : 'backup'}-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(storageCorrupt ? 'Recovery copy exported; original browser data was preserved.' : 'Backup exported');
  }

  function importData(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('Backup file is larger than 10 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onerror = () => toast('Could not read that backup file.', 'error');
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.habits)) throw new Error('Invalid backup structure');
        const imported = normalizeState(data);
        if (!confirm(`Replace your current ${state.tasks.length} tasks and ${state.habits.length} habits with ${imported.tasks.length} tasks and ${imported.habits.length} habits from this backup?`)) return;
        state = imported;
        storageCorrupt = false;
        corruptedStorageValue = null;
        document.body.classList.toggle('dark', state.dark);
        updateThemeButton();
        save();
        renderAll();
        toast('Backup imported successfully');
      } catch (error) {
        console.warn('Backup import failed:', error);
        toast('This file is not a valid Daylight backup.', 'error');
      }
    };
    reader.readAsText(file);
  }

  function addHabit(event) {
    event.preventDefault();
    const name = $('#habitName').value.trim();
    if (!name) return;
    state.habits.push({ id: uid(), name, icon: $('#habitIcon').value, goal: $('#habitGoal').value, checks: [], streak: 0 });
    save();
    $('#habitModal').classList.remove('show');
    $('#habitForm').reset();
    renderHabits();
    renderInsights();
    toast('Habit added');
  }

  function setConnectionStatus() {
    const element = $('#connectionStatus');
    const offline = !navigator.onLine;
    element.classList.toggle('offline', offline);
    element.textContent = offline ? 'Offline · saved on this device' : 'Local data · synced to this browser';
    element.title = offline ? 'You can continue working. Changes are stored locally in this browser.' : 'Your data is stored locally in this browser.';
  }

  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    const today = todayISO();
    state.tasks.filter((task) => !task.done && task.date === today && task.time).forEach((task) => {
      const dueAt = new Date(`${task.date}T${task.time}:00`).getTime();
      // A short grace window makes reminders resilient to background-tab timer throttling.
      if (!Number.isFinite(dueAt) || now < dueAt || now - dueAt > 10 * 60 * 1000) return;
      const key = `${task.id}:${task.date}:${task.time}`;
      if (sentReminders.has(key)) return;
      sentReminders.add(key);
      try { sessionStorage.setItem('daylight-reminded', JSON.stringify([...sentReminders])); } catch (error) { /* Session storage is optional. */ }
      try { new Notification('Task reminder', { body: task.title, tag: key }); }
      catch (error) { console.info('Task reminder could not be shown.', error); }
    });
  }

  function moveTaskBy(id, direction) {
    const visible = sortTasks(state.tasks.filter((task) => matchesTaskFilters(task, currentTaskFilters())), 'manual');
    const index = visible.findIndex((task) => task.id === id);
    const target = visible[index + (direction === 'up' ? -1 : 1)];
    if (target) reorderTasks(id, target.id);
  }

  function reorderTasks(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const filters = currentTaskFilters();
    const visible = sortTasks(state.tasks.filter((task) => matchesTaskFilters(task, filters)), filters.sort);
    const sourceIndex = visible.findIndex((task) => task.id === sourceId);
    const targetIndex = visible.findIndex((task) => task.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = visible.splice(sourceIndex, 1);
    visible.splice(targetIndex, 0, moved);
    const visibleIds = new Set(visible.map((task) => task.id));
    const untouched = state.tasks.filter((task) => !visibleIds.has(task.id)).sort((a, b) => a.order - b.order);
    state.tasks = [...visible, ...untouched];
    state.tasks.forEach((task, index) => { task.order = index; });
    $('#sortSelect').value = 'manual';
    save();
    renderTaskList();
    toast('Task order updated');
  }

  // Navigation
  $$('[data-page]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // Task modal and creation
  $('#addTaskBtn').addEventListener('click', () => openTaskModal());
  $$('[data-add]').forEach((button) => button.addEventListener('click', () => openTaskModal()));
  $('#taskList').addEventListener('click', (event) => {
    if (event.target.closest('[data-add-empty]')) { openTaskModal(); return; }
    const card = event.target.closest('.task');
    if (!card) return;
    const id = card.dataset.id;
    if (event.target.closest('[data-move]')) { moveTaskBy(id, event.target.closest('[data-move]').dataset.move); return; }
    if (event.target.closest('.edit-task')) openTaskModal(state.tasks.find((task) => task.id === id));
    if (event.target.closest('.delete-task')) deleteTask(id);
  });
  $('#taskList').addEventListener('change', (event) => {
    const card = event.target.closest('.task');
    if (!card) return;
    if (event.target.matches('.check')) toggleTask(card.dataset.id, event.target.checked);
    if (event.target.matches('[data-subtask]')) toggleSubtask(card.dataset.id, Number(event.target.dataset.subtask), event.target.checked);
  });
  $('#upcomingList').addEventListener('click', (event) => {
    const card = event.target.closest('.task');
    if (!card) return;
    const id = card.dataset.id;
    if (event.target.closest('.edit-task')) openTaskModal(state.tasks.find((task) => task.id === id));
    if (event.target.closest('.delete-task')) deleteTask(id);
  });
  $('#upcomingList').addEventListener('change', (event) => {
    const card = event.target.closest('.task');
    if (!card) return;
    if (event.target.matches('.check')) toggleTask(card.dataset.id, event.target.checked);
    if (event.target.matches('[data-subtask]')) toggleSubtask(card.dataset.id, Number(event.target.dataset.subtask), event.target.checked);
  });
  $('#closeModal').addEventListener('click', closeTaskModal);
  $('#cancelModal').addEventListener('click', closeTaskModal);
  $('#taskModal').addEventListener('click', (event) => { if (event.target === $('#taskModal')) closeTaskModal(); });
  $('#taskForm').addEventListener('submit', saveTask);

  // Search, filters, sorting, and drag-to-reorder
  ['searchInput', 'filterPriority', 'filterCategory', 'filterDate', 'sortSelect'].forEach((id) => {
    $(`#${id}`).addEventListener(id === 'searchInput' ? 'input' : 'change', renderTaskList);
  });
  $$('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    $$('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderTaskList();
  }));
  $$('[data-upcoming]').forEach((button) => button.addEventListener('click', () => {
    upcomingFilter = button.dataset.upcoming;
    $$('[data-upcoming]').forEach((item) => item.classList.toggle('active', item === button));
    renderUpcoming();
  }));
  $('#taskList').addEventListener('dragstart', (event) => {
    const card = event.target.closest('.task');
    if (!card) return;
    draggingId = card.dataset.id;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggingId);
  });
  $('#taskList').addEventListener('dragover', (event) => {
    const card = event.target.closest('.task');
    if (!card || !draggingId) return;
    event.preventDefault();
    $$('.task.drag-over', $('#taskList')).forEach((item) => item.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });
  $('#taskList').addEventListener('drop', (event) => {
    const card = event.target.closest('.task');
    if (!card || !draggingId) return;
    event.preventDefault();
    reorderTasks(draggingId, card.dataset.id);
  });
  $('#taskList').addEventListener('dragend', () => {
    draggingId = null;
    $$('.task', $('#taskList')).forEach((card) => card.classList.remove('dragging', 'drag-over'));
  });

  // Calendar
  $('#prevMonth').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar(); });
  $('#nextMonth').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar(); });
  $('#calendarGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-date]');
    if (!button) return;
    selectedDate = button.dataset.date;
    const date = new Date(`${selectedDate}T12:00:00`);
    currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
  });
  $('#selectedDayTasks').addEventListener('change', (event) => {
    const card = event.target.closest('[data-mini-task]');
    if (card && event.target.matches('[data-mini-check]')) toggleTask(card.dataset.miniTask, event.target.checked);
  });
  $('#selectedDayTasks').addEventListener('click', (event) => {
    const card = event.target.closest('[data-mini-task]');
    if (card && event.target.closest('[data-mini-edit]')) openTaskModal(state.tasks.find((task) => task.id === card.dataset.miniTask));
  });
  $('#addSelectedDay').addEventListener('click', () => openTaskModal());

  // Habits
  $('#addHabitBtn').addEventListener('click', () => $('#habitModal').classList.add('show'));
  $('#closeHabitModal').addEventListener('click', () => $('#habitModal').classList.remove('show'));
  $('#cancelHabit').addEventListener('click', () => $('#habitModal').classList.remove('show'));
  $('#habitForm').addEventListener('submit', addHabit);
  $('#habitsGrid').addEventListener('click', (event) => {
    const doneButton = event.target.closest('[data-habit]');
    if (doneButton) {
      const habit = state.habits.find((item) => item.id === doneButton.dataset.habit);
      if (!habit) return;
      const date = todayISO();
      habit.checks = habit.checks.includes(date) ? habit.checks.filter((item) => item !== date) : [...habit.checks, date];
      save();
      renderHabits();
      renderInsights();
      return;
    }
    const deleteButton = event.target.closest('[data-habit-delete]');
    if (deleteButton && confirm('Remove this habit and its check-in history?')) {
      state.habits = state.habits.filter((item) => item.id !== deleteButton.dataset.habitDelete);
      save();
      renderHabits();
      renderInsights();
    }
  });

  // Planner, focus timer, focus mode, and daily goal
  $('#planBtn').addEventListener('click', planDay);
  $('#planSide').addEventListener('click', () => { showPage('today'); planDay(); });
  $('#timerStart').addEventListener('click', () => {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerDeadline = null;
      timerRunning = false;
      $('#timerStart').textContent = 'Resume';
      $('#timerCaption').textContent = 'Paused — come back when ready';
    } else {
      timerRunning = true;
      timerDeadline = Date.now() + timerSeconds * 1000;
      $('#timerStart').textContent = 'Pause';
      $('#timerCaption').textContent = `${timerMode} in progress`;
      timerInterval = setInterval(timerTick, 1000);
    }
  });
  $('#timerReset').addEventListener('click', () => setTimer(timerMode === 'Focus' ? 25 : timerMode === 'Short break' ? 5 : 15, timerMode));
  $$('.focus-modes button').forEach((button) => button.addEventListener('click', () => setTimer(Number(button.dataset.minutes), button.dataset.mode)));
  $('#focusModeBtn').addEventListener('click', toggleFocusMode);
  $('#dailyGoalMinus').addEventListener('click', () => { state.dailyGoal = Math.max(1, state.dailyGoal - 1); save(); renderStats(); });
  $('#dailyGoalPlus').addEventListener('click', () => { state.dailyGoal = Math.min(50, state.dailyGoal + 1); save(); renderStats(); });
  $('#recentList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-task]');
    if (button) openTaskModal(state.tasks.find((task) => task.id === button.dataset.openTask));
  });

  // Appearance, backup, and notifications
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#themeSide').addEventListener('click', toggleTheme);
  $('#exportBtn').addEventListener('click', exportData);
  $('#exportInsights').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (event) => {
    if (event.target.files[0]) importData(event.target.files[0]);
    event.target.value = '';
  });
  $('#notifyBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('Notifications are not supported in this browser.', 'error'); return; }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      toast('Browser reminders need HTTPS or localhost.', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      toast(permission === 'granted' ? 'Reminders enabled while Daylight is open.' : 'Notification permission was not granted.', permission === 'granted' ? 'success' : 'error');
      $('#notifyBtn').setAttribute('aria-label', permission === 'granted' ? 'Reminders enabled' : 'Enable reminders');
    } catch (error) { toast('Could not enable browser reminders.', 'error'); }
  });

  // Modal keyboard support and convenience shortcuts.
  document.addEventListener('keydown', (event) => {
    const taskModalOpen = $('#taskModal').classList.contains('show');
    const habitModalOpen = $('#habitModal').classList.contains('show');
    if (event.key === 'Escape') {
      if (taskModalOpen) closeTaskModal();
      if (habitModalOpen) $('#habitModal').classList.remove('show');
      if (document.body.classList.contains('focus-mode')) toggleFocusMode();
      return;
    }
    const activeTag = document.activeElement?.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || document.activeElement?.isContentEditable;
    if (!typing && !taskModalOpen && !habitModalOpen && event.key.toLowerCase() === 'n') { event.preventDefault(); openTaskModal(); }
    if (!typing && !taskModalOpen && !habitModalOpen && event.key === '/') { event.preventDefault(); showPage('today'); $('#searchInput').focus(); }
    if (taskModalOpen && event.key === 'Tab') {
      const focusable = $$('input:not([type="hidden"]),select,textarea,button', $('#taskModal')).filter((el) => !el.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('online', setConnectionStatus);
  window.addEventListener('offline', setConnectionStatus);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { state = normalizeState(JSON.parse(event.newValue)); renderAll(); toast('Updated from another Daylight tab'); }
    catch (error) { console.warn('Could not sync another tab update.', error); }
  });

  // Start-up. Reminders are checked only while this page is open.
  document.body.classList.toggle('dark', state.dark);
  try {
    const previousReminders = JSON.parse(sessionStorage.getItem('daylight-reminded') || '[]');
    if (Array.isArray(previousReminders)) previousReminders.forEach((key) => sentReminders.add(String(key)));
  } catch (error) { /* Session storage is optional. */ }
  updateThemeButton();
  renderDateGreeting();
  renderAll();
  setConnectionStatus();
  if (storageCorrupt) toast('Existing local data could not be read. Export a recovery copy before importing a known backup.', 'error');
  else if (storageUnavailable) toast('Browser storage is unavailable. Export a backup to protect your changes.', 'error');
  setInterval(checkReminders, 15000);
})();

/* Daylight upgrade: smart quick-add + clear completed. Non-invasive add-on (no edits to app.js). */
(() => {
  'use strict';
  const KEY = 'daylight-todo-v1';
  const $ = (s) => document.querySelector(s);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function parse(text) {
    let t = ' ' + text + ' ';
    const out = { date: '', time: '', priority: 'medium', category: 'Personal', tags: [], repeat: 'none' };
    const take = (re, fn) => { const m = t.match(re); if (m) { fn(m); t = t.replace(m[0], ' '); } };
    const now = new Date();
    const shift = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d); };
    take(/\s!(urgent|high|medium|low)\b/i, (m) => out.priority = m[1].toLowerCase());
    take(/\severy\s+(day|week|month)\b/i, (m) => out.repeat = { day: 'daily', week: 'weekly', month: 'monthly' }[m[1].toLowerCase()]);
    take(/\s@(\w+)/, (m) => out.category = m[1][0].toUpperCase() + m[1].slice(1));
    let m; const tagRe = /\s#([\w-]+)/g;
    while ((m = tagRe.exec(t))) out.tags.push(m[1]);
    t = t.replace(tagRe, ' ');
    take(/\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m) => {
      let h = Number(m[1]) % 12; if (m[3].toLowerCase() === 'pm') h += 12;
      out.time = `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
    });
    if (!out.time) take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\b/i, (m) => out.time = `${m[1].padStart(2, '0')}:${m[2]}`);
    take(/\sin\s(\d+)\s*days?\b/i, (m) => out.date = shift(Number(m[1])));
    take(/\s(today|tomorrow|tmr)\b/i, (m) => out.date = shift(m[1].toLowerCase() === 'today' ? 0 : 1));
    take(/\s(?:next\s)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => {
      const diff = (DAYS.indexOf(m[1].toLowerCase()) - now.getDay() + 7) % 7 || 7;
      out.date = shift(diff);
    });
    if (out.time && !out.date) out.date = iso(now);
    out.title = t.replace(/\s+/g, ' ').trim().replace(/^(at|on|by)\s+|\s+(at|on|by)$/gi, '').slice(0, 100);
    return out;
  }

  function mutate(fn) {
    let state;
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch { return false; }
    if (!state || !Array.isArray(state.tasks)) return false;
    fn(state);
    const value = JSON.stringify(state);
    try { localStorage.setItem(KEY, value); } catch { return false; }
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: value }));
    return true;
  }
  const say = (msg) => setTimeout(() => { const el = $('#toast'); if (el) { el.textContent = msg; el.dataset.type = 'success'; } }, 30);

  function addFromText(text) {
    const p = parse(text);
    if (!p.title) return false;
    const ok = mutate((s) => {
      s.tasks.unshift({ id: uid(), description: '', subtasks: [], done: false, createdAt: Date.now(), order: -1, ...p });
      s.tasks.forEach((t, i) => { t.order = i; });
    });
    if (ok) say(`Added “${p.title}”${p.date ? ' · ' + p.date : ''}${p.time ? ' ' + p.time : ''}`);
    return ok;
  }

  function init() {
    const card = $('.tasks-card');
    if (!card || $('#quickAdd')) return;
    const bar = document.createElement('form');
    bar.className = 'quick-add'; bar.id = 'quickAdd';
    bar.innerHTML = `<input id="quickAddInput" autocomplete="off" aria-label="Quick add task" placeholder="Quick add: “Call mom tomorrow 5pm !high #family @personal”"><button class="primary" type="submit">Add</button>`;
    bar.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#quickAddInput');
      if (addFromText(input.value)) input.value = '';
    });
    card.querySelector('.card-head').after(bar);

    const clear = document.createElement('button');
    clear.className = 'secondary clear-done'; clear.textContent = 'Clear completed';
    clear.addEventListener('click', () => {
      let n = 0; try { n = JSON.parse(localStorage.getItem(KEY)).tasks.filter((t) => t.done).length; } catch { }
      if (!n) return;
      if (!confirm(`Delete ${n} completed task${n > 1 ? 's' : ''}? Tip: export a backup first.`)) return;
      if (mutate((s) => { s.tasks = s.tasks.filter((t) => !t.done); s.tasks.forEach((t, i) => { t.order = i; }); })) say(`Cleared ${n} completed`);
    });
    card.querySelector('.list-hint').before(clear);

    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'q' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); $('#quickAddInput').focus();
      }
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)) : setTimeout(init, 0);
})();