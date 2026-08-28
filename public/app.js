const root = document.getElementById('view-root');
const streakCountEl = document.getElementById('streak-count');
const xpCountEl = document.getElementById('xp-count');
const flameIcon = document.getElementById('flame-icon');

let state = {
  lessons: [],
  stats: null,
  currentLesson: null,
  answers: {},
};

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function updateTopbar(stats) {
  streakCountEl.textContent = stats.current_streak;
  xpCountEl.textContent = stats.total_xp;
}

function pulseFlame() {
  flameIcon.classList.remove('pulse');
  void flameIcon.offsetWidth; // reflow to restart animation
  flameIcon.classList.add('pulse');
}

async function loadDashboard() {
  const [lessons, stats] = await Promise.all([
    fetchJSON('/api/lessons'),
    fetchJSON('/api/stats'),
  ]);
  state.lessons = lessons;
  state.stats = stats;
  updateTopbar(stats);
  renderDashboard();
}

function renderDashboard() {
  const { lessons, stats } = state;
  const pct = stats.totalLessons ? Math.round((stats.lessonsCompleted / stats.totalLessons) * 100) : 0;

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

    <div class="lesson-grid">
      ${lessons.map((l) => `
        <div class="lesson-card ${l.completed ? 'completed' : ''}" data-id="${l.id}">
          <span class="lesson-category">${l.category}</span>
          <h3>${l.title}</h3>
          <p>${l.summary}</p>
          <div class="lesson-footer">
            <span class="xp-tag">+${l.xp_reward} XP</span>
            ${l.completed ? '<span class="completed-check">✓ Done</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  requestAnimationFrame(() => {
    const fill = document.getElementById('xp-fill');
    if (fill) fill.style.width = `${pct}%`;
  });

  document.querySelectorAll('.lesson-card').forEach((card) => {
    card.addEventListener('click', () => openLesson(card.dataset.id));
  });
}

async function openLesson(id) {
  const lesson = await fetchJSON(`/api/lessons/${id}`);
  state.currentLesson = lesson;
  state.answers = {};
  renderQuiz();
}

function renderQuiz() {
  const { currentLesson, answers } = state;
  const allAnswered = currentLesson.questions.every((q) => answers[q.id] !== undefined);

  root.innerHTML = `
    <div class="quiz-header">
      <span class="back-link" id="back-btn">&larr; Back to lessons</span>
      <h2>${currentLesson.title}</h2>
    </div>

    ${currentLesson.questions.map((q, qi) => `
      <div class="question-card">
        <p class="question-prompt">${qi + 1}. ${q.prompt}</p>
        ${q.options.map((opt, oi) => `
          <div class="option ${answers[q.id] === oi ? 'selected' : ''}" data-qid="${q.id}" data-oi="${oi}">
            <span class="option-letter">${String.fromCharCode(65 + oi)}</span>
            <span>${opt}</span>
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
    renderDashboard();
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
  if (submitBtn) {
    submitBtn.addEventListener('click', submitQuiz);
  }
}

async function submitQuiz() {
  const { currentLesson, answers } = state;
  const result = await fetchJSON(`/api/lessons/${currentLesson.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });

  state.stats = { ...state.stats, ...result.stats };
  updateTopbar(state.stats);
  pulseFlame();
  renderResults(result);
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
            ${r.correct ? '✓' : '✕'} Question ${i + 1}: ${currentLesson.questions[i].prompt}
          </div>
        `).join('')}
      </div>
    </div>
    <button class="btn btn-primary" id="continue-btn">Continue learning</button>
  `;

  document.getElementById('continue-btn').addEventListener('click', async () => {
    state.currentLesson = null;
    await loadDashboard();
  });
}

loadDashboard();
