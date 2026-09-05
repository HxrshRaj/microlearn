const root = document.getElementById('view-root');
const streakCountEl = document.getElementById('streak-count');
const xpCountEl = document.getElementById('xp-count');
const flameIcon = document.getElementById('flame-icon');
const topnav = document.getElementById('topnav');
const topbarStats = document.getElementById('topbar-stats');
const logoutBtn = document.getElementById('logout-btn');

let state = {
  user: null,
  authMode: 'login', // 'login' | 'signup'
  lessons: [],
  categories: [],
  activeCategory: null,
  stats: null,
  currentLesson: null,
  answers: {},
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function fetchJSON(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...opts });
  } catch (networkErr) {
    const err = new Error('Network error — check your connection and try again.');
    err.isNetworkError = true;
    throw err;
  }

  let body = null;
  try {
    body = await res.json();
  } catch (parseErr) {
    body = null;
  }

  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return body;
}

function setChromeVisible(visible) {
  topnav.hidden = !visible;
  topbarStats.hidden = !visible;
  logoutBtn.hidden = !visible;
}

function updateTopbar(stats) {
  if (!stats) return;
  const streak = stats.current_streak ?? stats.currentStreak;
  const xp = stats.total_xp ?? stats.totalXp;
  if (streak !== undefined) streakCountEl.textContent = streak;
  if (xp !== undefined) xpCountEl.textContent = xp;
}

function setActiveNav(view) {
  document.querySelectorAll('.nav-link[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === view);
  });
}

function pulseFlame() {
  flameIcon.classList.remove('pulse');
  void flameIcon.offsetWidth; // reflow to restart animation
  flameIcon.classList.add('pulse');
}

function renderErrorState(message, { onRetry } = {}) {
  root.innerHTML = `
    <div class="error-state">
      <span class="error-icon">⚠️</span>
      <h3>Something went wrong</h3>
      <p>${escapeHtml(message)}</p>
      ${onRetry ? '<button class="btn btn-primary" id="retry-btn">Try again</button>' : ''}
    </div>
  `;
  if (onRetry) document.getElementById('retry-btn').addEventListener('click', onRetry);
}

async function handleAuthFailure(err) {
  if (err.status === 401) {
    state.user = null;
    setChromeVisible(false);
    renderAuth();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- Auth ----

function renderAuth() {
  const isLogin = state.authMode === 'login';
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>${isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p class="auth-subtitle">${isLogin ? 'Log in to keep your streak alive.' : 'Your own XP, streaks, and lesson history — start fresh.'}</p>
        <div id="auth-error-slot"></div>
        <form id="auth-form" novalidate>
          ${isLogin ? '' : `
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" autocomplete="username" minlength="3" maxlength="20" required />
            <p class="field-hint">3-20 characters: letters, numbers, underscores, or hyphens.</p>
          </div>`}
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" minlength="8" required />
            ${isLogin ? '' : '<p class="field-hint">At least 8 characters, with a letter and a number.</p>'}
          </div>
          <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Log in' : 'Sign up'}</button>
        </form>
        <div class="auth-switch">
          ${isLogin ? 'New here?' : 'Already have an account?'}
          <button type="button" id="auth-switch-btn">${isLogin ? 'Create an account' : 'Log in'}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('auth-switch-btn').addEventListener('click', () => {
    state.authMode = isLogin ? 'signup' : 'login';
    renderAuth();
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const { user } = await fetchJSON(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.user = user;
      setChromeVisible(true);
      await goToDashboard();
    } catch (err) {
      const slot = document.getElementById('auth-error-slot');
      slot.innerHTML = `<div class="auth-error">${escapeHtml(err.message)}</div>`;
      submitBtn.disabled = false;
    }
  });
}

async function logout() {
  try {
    await fetchJSON('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // logging out client-side regardless — a failed logout call shouldn't trap the user
  }
  state = { ...state, user: null, lessons: [], stats: null, currentLesson: null, answers: {} };
  setChromeVisible(false);
  state.authMode = 'login';
  renderAuth();
}

// ----------------------------------------------------------- Dashboard ----

async function goToDashboard() {
  setActiveNav('dashboard');
  root.innerHTML = '<div class="empty-state"><p>Loading your lessons…</p></div>';
  try {
    const [lessons, stats, categories] = await Promise.all([
      fetchJSON(`/api/lessons${state.activeCategory ? `?category=${encodeURIComponent(state.activeCategory)}` : ''}`),
      fetchJSON('/api/stats'),
      fetchJSON('/api/categories'),
    ]);
    state.lessons = lessons;
    state.stats = stats;
    state.categories = categories;
    updateTopbar(stats);
    renderDashboard();
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: goToDashboard });
  }
}

function renderDashboard() {
  const { lessons, stats, categories, activeCategory } = state;
  const pct = stats.totalLessons ? Math.round((stats.lessonsCompleted / stats.totalLessons) * 100) : 0;

  const filterChips = ['All', ...categories]
    .map((cat) => {
      const isAll = cat === 'All';
      const isActive = isAll ? !activeCategory : activeCategory === cat;
      return `<button class="category-chip ${isActive ? 'active' : ''}" data-category="${isAll ? '' : escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    })
    .join('');

  const lessonGrid = lessons.length
    ? `<div class="lesson-grid">
        ${lessons.map((l) => `
          <div class="lesson-card ${l.completed ? 'completed' : ''}" data-id="${l.id}">
            <span class="lesson-category">${escapeHtml(l.category)}</span>
            <h3>${escapeHtml(l.title)}</h3>
            <p>${escapeHtml(l.summary)}</p>
            <div class="lesson-footer">
              <span class="xp-tag">+${l.xp_reward} XP</span>
              ${l.completed ? '<span class="completed-check">✓ Done</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>`
    : `<div class="empty-state">
        <span class="empty-icon">🔍</span>
        <h3>No lessons in this category yet</h3>
        <p>Try a different filter, or come back to "All" to see everything.</p>
      </div>`;

  root.innerHTML = `
    <div class="hero">
      <h1>Keep the streak alive</h1>
      <p>Short lessons, real retention. A few minutes a day builds real skill.</p>
    </div>

    <div class="xp-bar-wrap">
      <div class="xp-bar-header">
        <span>${stats.lessonsCompleted} of ${stats.totalLessons} lessons complete</span>
        <span>${pct}%</span>
      </div>
      <div class="xp-track">
        <div class="xp-fill" id="xp-fill" style="width: 0%"></div>
      </div>
    </div>

    <div class="category-filters">${filterChips}</div>

    ${lessonGrid}
  `;

  requestAnimationFrame(() => {
    const fill = document.getElementById('xp-fill');
    if (fill) fill.style.width = `${pct}%`;
  });

  document.querySelectorAll('.category-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.activeCategory = chip.dataset.category || null;
      goToDashboard();
    });
  });

  document.querySelectorAll('.lesson-card').forEach((card) => {
    card.addEventListener('click', () => openLesson(card.dataset.id));
  });
}

// --------------------------------------------------------------- Quiz -----

async function openLesson(id) {
  try {
    const lesson = await fetchJSON(`/api/lessons/${id}`);
    state.currentLesson = lesson;
    state.answers = {};
    renderQuiz();
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: () => openLesson(id) });
  }
}

function renderQuiz() {
  const { currentLesson, answers } = state;
  const allAnswered = currentLesson.questions.every((q) => answers[q.id] !== undefined);

  root.innerHTML = `
    <div class="quiz-header">
      <span class="back-link" id="back-btn">&larr; Back to lessons</span>
      <h2>${escapeHtml(currentLesson.title)}</h2>
    </div>

    ${currentLesson.questions.map((q, qi) => `
      <div class="question-card">
        <p class="question-prompt">${qi + 1}. ${escapeHtml(q.prompt)}</p>
        ${q.options.map((opt, oi) => `
          <div class="option ${answers[q.id] === oi ? 'selected' : ''}" data-qid="${q.id}" data-oi="${oi}">
            <span class="option-letter">${String.fromCharCode(65 + oi)}</span>
            <span>${escapeHtml(opt)}</span>
          </div>
        `).join('')}
      </div>
    `).join('')}

    <button class="btn btn-primary" id="submit-btn" ${allAnswered ? '' : 'disabled'}>
      Submit answers
    </button>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    state.currentLesson = null;
    goToDashboard();
  });

  document.querySelectorAll('.option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const qid = Number(opt.dataset.qid);
      const oi = Number(opt.dataset.oi);
      state.answers[qid] = oi;
      renderQuiz();
    });
  });

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.addEventListener('click', submitQuiz);
}

async function submitQuiz() {
  const { currentLesson, answers } = state;
  try {
    const result = await fetchJSON(`/api/lessons/${currentLesson.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    state.stats = { ...state.stats, ...result.stats };
    updateTopbar(result.stats);
    pulseFlame();
    renderResults(result);
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: submitQuiz });
  }
}

function renderResults(result) {
  const { currentLesson } = state;

  root.innerHTML = `
    <div class="result-hero">
      <p class="result-score">${result.score}%</p>
      <p class="result-xp">+${result.xpEarned} XP earned</p>
      <div class="result-breakdown">
        ${result.results.map((r, i) => `
          <div class="result-row ${r.correct ? 'correct' : 'incorrect'}">
            ${r.correct ? '✓' : '✕'} Question ${i + 1}: ${escapeHtml(currentLesson.questions[i].prompt)}
          </div>
        `).join('')}
      </div>
    </div>
    <button class="btn btn-primary" id="continue-btn">Continue learning</button>
  `;

  document.getElementById('continue-btn').addEventListener('click', () => {
    state.currentLesson = null;
    goToDashboard();
  });
}

// ------------------------------------------------------------ History -----

async function goToHistory() {
  setActiveNav('history');
  root.innerHTML = '<div class="empty-state"><p>Loading your history…</p></div>';
  try {
    const history = await fetchJSON('/api/history');
    renderHistory(history);
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: goToHistory });
  }
}

function scoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function renderHistory(history) {
  const body = history.length
    ? `<div class="history-list">
        ${history.map((h) => `
          <div class="history-row">
            <div class="history-row-main">
              <p class="history-row-title">${escapeHtml(h.lesson_title)}</p>
              <p class="history-row-meta">${escapeHtml(h.lesson_category)} · ${new Date(h.completed_at).toLocaleString()}</p>
            </div>
            <div class="history-row-xp">+${h.xp_earned} XP</div>
            <div class="history-row-score ${scoreClass(h.score)}">${h.score}%</div>
          </div>
        `).join('')}
      </div>`
    : `<div class="empty-state">
        <span class="empty-icon">📈</span>
        <h3>No attempts yet</h3>
        <p>Complete a lesson and it'll show up here, with your score over time.</p>
        <button class="btn btn-primary" id="empty-cta">Go to dashboard</button>
      </div>`;

  root.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Learning history</h1>
        <p>Every attempt you've made, most recent first.</p>
      </div>
    </div>
    ${body}
  `;

  const cta = document.getElementById('empty-cta');
  if (cta) cta.addEventListener('click', goToDashboard);
}

// ------------------------------------------------------------ Profile -----

async function goToProfile() {
  setActiveNav('profile');
  root.innerHTML = '<div class="empty-state"><p>Loading your profile…</p></div>';
  try {
    const profile = await fetchJSON('/api/profile');
    renderProfile(profile);
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: goToProfile });
  }
}

function renderProfile(profile) {
  const initial = profile.username.slice(0, 1).toUpperCase();
  const joined = new Date(profile.joinDate).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  root.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${escapeHtml(initial)}</div>
      <div>
        <h1>${escapeHtml(profile.username)}</h1>
        <p>Joined ${joined}</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${profile.totalXp}</div>
        <div class="stat-name">Total XP</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${profile.currentStreak}</div>
        <div class="stat-name">Current streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${profile.longestStreak}</div>
        <div class="stat-name">Longest streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${profile.lessonsCompleted}</div>
        <div class="stat-name">Lessons completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${profile.totalAttempts}</div>
        <div class="stat-name">Total attempts</div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------- Leaderboard ----

async function goToLeaderboard() {
  setActiveNav('leaderboard');
  root.innerHTML = '<div class="empty-state"><p>Loading the leaderboard…</p></div>';
  try {
    const leaderboard = await fetchJSON('/api/leaderboard');
    renderLeaderboard(leaderboard);
  } catch (err) {
    if (await handleAuthFailure(err)) return;
    renderErrorState(err.message, { onRetry: goToLeaderboard });
  }
}

function renderLeaderboard(leaderboard) {
  const body = leaderboard.length
    ? `<div class="leaderboard-list">
        ${leaderboard.map((row) => `
          <div class="leaderboard-row ${row.isYou ? 'is-you' : ''}">
            <div class="leaderboard-rank">#${row.rank}</div>
            <div class="leaderboard-name">${escapeHtml(row.username)}${row.isYou ? '<span class="leaderboard-you-tag">YOU</span>' : ''}</div>
            <div class="leaderboard-streak">🔥 ${row.longestStreak} best</div>
            <div class="leaderboard-xp">${row.totalXp} XP</div>
          </div>
        `).join('')}
      </div>`
    : `<div class="empty-state">
        <span class="empty-icon">🏆</span>
        <h3>No one's on the board yet</h3>
        <p>Complete a lesson to claim the top spot.</p>
      </div>`;

  root.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Leaderboard</h1>
        <p>Top learners by total XP.</p>
      </div>
    </div>
    ${body}
  `;
}

// --------------------------------------------------------------- Init -----

topnav.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-link[data-nav]');
  if (!btn) return;
  const dest = btn.dataset.nav;
  if (dest === 'dashboard') goToDashboard();
  else if (dest === 'history') goToHistory();
  else if (dest === 'profile') goToProfile();
  else if (dest === 'leaderboard') goToLeaderboard();
});

logoutBtn.addEventListener('click', logout);

async function init() {
  try {
    const { user } = await fetchJSON('/api/auth/me');
    if (user) {
      state.user = user;
      setChromeVisible(true);
      await goToDashboard();
    } else {
      setChromeVisible(false);
      renderAuth();
    }
  } catch (err) {
    setChromeVisible(false);
    renderErrorState('Could not reach the server. Please refresh the page.', { onRetry: init });
  }
}

init();
