import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { join } from 'path';
import type { Knex } from 'knex';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/error.filter';

/** Builds the NestJS app around a Knex instance (tests pass an in-memory one). */
export async function createNestApp(knex: Knex): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(knex), { logger: false });
  app.use(cors());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: false }));
  app.useGlobalFilters(new ErrorFilter());
  app.useStaticAssets(join(__dirname, '..', '..', 'public'));
  await app.init();
  return app;
}
