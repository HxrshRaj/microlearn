const { Router } = require('express');
const c = require('../controllers/lessonController');
const requireAuth = require('../middleware/auth');

const r = Router();
r.use(requireAuth);
r.get('/categories', c.categories);
r.get('/lessons', c.list);
r.get('/lessons/:id', c.getOne);
r.post('/lessons/:id/submit', c.submit);
r.get('/history', c.history);
r.get('/stats', c.stats);
r.get('/leaderboard', c.leaderboard);
module.exports = r;
