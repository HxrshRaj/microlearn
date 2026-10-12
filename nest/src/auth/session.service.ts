import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Knex } from 'knex';
import { KNEX, SESSION_TTL_MS } from '../common/constants';

/** Opaque random token in the cookie; only its SHA-256 is stored, so a DB leak yields no usable sessions. */
@Injectable()
export class SessionService {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  private hash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(userId: number | string, userAgent?: string) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.knex('sessions').insert({
      id: this.hash(token),
      user_id: userId,
      expires_at: new Date(Date.now() + SESSION_TTL_MS),
      user_agent: userAgent || null,
    });
    return token;
  }

  async userForToken(token?: string) {
    if (!token) return null;
    const id = this.hash(token);
    const row = await this.knex('sessions')
      .join('users', 'users.id', 'sessions.user_id')
      .where('sessions.id', id)
      .select('users.id', 'users.username', 'users.email', 'users.created_at', 'sessions.expires_at')
      .first();
    if (!row) return null;
    if (new Date(row.expires_at) <= new Date()) {
      await this.knex('sessions').where({ id }).del();
      return null;
    }
    const { expires_at: _drop, ...user } = row;
    return user;
  }

  async destroy(token?: string) {
    if (token) await this.knex('sessions').where({ id: this.hash(token) }).del();
  }
}
