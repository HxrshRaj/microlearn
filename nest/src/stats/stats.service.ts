import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../common/constants';
import type { SessionUser } from '../common/current-user.decorator';

@Injectable()
export class StatsService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  private async completed(userId: number | string) {
    const [{ count }] = await this.knex('progress').where({ user_id: userId }).countDistinct('lesson_id as count');
    return Number(count);
  }

  async stats(userId: number | string) {
    const s = await this.knex('user_stats').where({ user_id: userId }).first();
    const [{ count: totalLessons }] = await this.knex('lessons').count('id as count');
    return {
      total_xp: Number(s.total_xp),
      current_streak: Number(s.current_streak),
      longest_streak: Number(s.longest_streak),
      last_activity_date: s.last_activity_date,
      lessonsCompleted: await this.completed(userId),
      totalLessons: Number(totalLessons),
    };
  }

  history(userId: number | string, lessonId?: string) {
    let q = this.knex('progress')
      .join('lessons', 'lessons.id', 'progress.lesson_id')
      .where('progress.user_id', userId)
      .select('progress.id', 'progress.lesson_id', 'lessons.title as lesson_title', 'lessons.category as lesson_category',
        'progress.score', 'progress.xp_earned', 'progress.completed_at')
      .orderBy('progress.completed_at', 'desc');
    if (lessonId) q = q.where('progress.lesson_id', lessonId);
    return q;
  }

  async profile(user: SessionUser) {
    const s = await this.knex('user_stats').where({ user_id: user.id }).first();
    const [{ count: attempts }] = await this.knex('progress').where({ user_id: user.id }).count('id as count');
    return {
      username: user.username,
      email: user.email,
      joinDate: user.created_at,
      totalXp: Number(s.total_xp),
      currentStreak: Number(s.current_streak),
      longestStreak: Number(s.longest_streak),
      lessonsCompleted: await this.completed(user.id),
      totalAttempts: Number(attempts),
    };
  }

  /** Top 20 by XP; ties share a rank. Ranked in application code so it also runs on engines without window functions. */
  async leaderboard(user: SessionUser) {
    const rows = await this.knex('user_stats')
      .join('users', 'users.id', 'user_stats.user_id')
      .select('users.username', 'user_stats.total_xp', 'user_stats.longest_streak')
      .orderBy('user_stats.total_xp', 'desc')
      .orderBy('users.username', 'asc')
      .limit(20);
    let rank = 0;
    let lastXp: number | null = null;
    return rows.map((r: any, i: number) => {
      const totalXp = Number(r.total_xp);
      if (totalXp !== lastXp) { rank = i + 1; lastXp = totalXp; }
      return { rank, username: r.username, totalXp, longestStreak: Number(r.longest_streak), isYou: r.username === user.username };
    });
  }
}
