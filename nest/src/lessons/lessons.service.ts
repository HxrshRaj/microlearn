import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../common/constants';
import { computeXp, scoreQuiz } from '../common/scoring';
import { applyActivity, todayISO } from '../common/streak';

// jsonb comes back parsed from `pg` but as raw text from some Postgres-compatible engines (pg-mem).
const parseOptions = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

@Injectable()
export class LessonsService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  async categories() {
    const rows = await this.knex('lessons').distinct('category').orderBy('category');
    return rows.map((r: any) => r.category);
  }

  async list(userId: number | string, category?: string) {
    let q = this.knex('lessons').select('id', 'title', 'category', 'summary', 'xp_reward').orderBy('sort_order');
    if (category) q = q.where({ category });
    const lessons = await q;
    const done = new Set((await this.knex('progress').where({ user_id: userId }).distinct('lesson_id')).map((r: any) => r.lesson_id));
    return lessons.map((l: any) => ({ ...l, completed: done.has(l.id) }));
  }

  async detail(id: string) {
    const lesson = await this.knex('lessons').where({ id }).first();
    if (!lesson) throw new NotFoundException('Lesson not found.');
    // correct_index is deliberately not selected: answers never leave the server before submit.
    const questions = await this.knex('questions').where({ lesson_id: lesson.id }).orderBy('sort_order').select('id', 'prompt', 'options');
    return { ...lesson, questions: questions.map((q: any) => ({ ...q, options: parseOptions(q.options) })) };
  }

  async submit(userId: number | string, id: string, answers: Record<string, number> = {}) {
    const lesson = await this.knex('lessons').where({ id }).first();
    if (!lesson) throw new NotFoundException('Lesson not found.');
    const questions = await this.knex('questions').where({ lesson_id: lesson.id }).select('id', 'correct_index');
    const { score, results } = scoreQuiz(questions as any, answers);
    const xpEarned = computeXp(score, lesson.xp_reward);

    const stats = await this.knex.transaction(async (trx) => {
      await trx('progress').insert({ user_id: userId, lesson_id: lesson.id, score, xp_earned: xpEarned });
      // Lock the stats row so two concurrent submits from one user cannot race on the streak.
      const current = await trx('user_stats').where({ user_id: userId }).forUpdate().first();
      const updated = applyActivity(
        { currentStreak: current.current_streak, longestStreak: current.longest_streak, lastActivityDate: current.last_activity_date },
        todayISO(),
      );
      const totalXp = Number(current.total_xp) + xpEarned; // Number(): some drivers return ints as strings
      await trx('user_stats').where({ user_id: userId }).update({
        total_xp: totalXp,
        current_streak: updated.currentStreak,
        longest_streak: updated.longestStreak,
        last_activity_date: updated.lastActivityDate,
        updated_at: trx.fn.now(),
      });
      return { total_xp: totalXp, current_streak: updated.currentStreak, longest_streak: updated.longestStreak };
    });
    return { score, xpEarned, results, stats };
  }
}
