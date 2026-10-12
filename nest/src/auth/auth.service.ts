import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../common/constants';
import { hashPassword, isValidEmail, validatePassword, validateUsername, verifyPassword } from '../common/validators';
import { LoginDto, SignupDto } from './auth.dto';
import { SessionService } from './session.service';

export const publicUser = (u: any) => ({ id: u.id, username: u.username, email: u.email, createdAt: u.created_at });

@Injectable()
export class AuthService {
  constructor(@Inject(KNEX) private readonly knex: Knex, @Inject(SessionService) private readonly sessions: SessionService) {}

  async signup(dto: SignupDto, userAgent?: string) {
    const u = validateUsername(dto.username);
    if (!u.valid) throw new BadRequestException(u.reason);
    if (!isValidEmail(dto.email)) throw new BadRequestException('Please provide a valid email address.');
    const p = validatePassword(dto.password);
    if (!p.valid) throw new BadRequestException(p.reason);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.knex('users').where({ email }).orWhere({ username: dto.username }).first();
    if (existing) throw new ConflictException('An account with that email or username already exists.');

    const passwordHash = await hashPassword(dto.password);
    const user = await this.knex.transaction(async (trx) => {
      const [created] = await trx('users')
        .insert({ username: dto.username, email, password_hash: passwordHash })
        .returning(['id', 'username', 'email', 'created_at']);
      await trx('user_stats').insert({ user_id: created.id });
      return created;
    });
    return { user, token: await this.sessions.create(user.id, userAgent) };
  }

  async login(dto: LoginDto, userAgent?: string) {
    // Same message for unknown email and wrong password: don't help enumerate accounts.
    const generic = new UnauthorizedException('Invalid email or password.');
    const user = await this.knex('users').where({ email: dto.email.trim().toLowerCase() }).first();
    if (!user) throw generic;
    if (!(await verifyPassword(dto.password, user.password_hash))) throw generic;
    return { user, token: await this.sessions.create(user.id, userAgent) };
  }
}
