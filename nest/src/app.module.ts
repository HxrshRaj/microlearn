import { DynamicModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import type { Knex } from 'knex';
import { AuthModule } from './auth/auth.module';
import { SessionMiddleware } from './auth/session.middleware';
import { DatabaseModule } from './db/database.module';
import { LessonsModule } from './lessons/lessons.module';
import { StatsModule } from './stats/stats.module';

// Brute-force guard on the auth endpoints: 20 attempts / 15 min / IP (same limits as the Express server).
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

@Module({})
export class AppModule implements NestModule {
  static forRoot(knex: Knex): DynamicModule {
    return { module: AppModule, imports: [DatabaseModule.forRoot(knex), AuthModule, LessonsModule, StatsModule] };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(authRateLimit).forRoutes('api/auth');
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
