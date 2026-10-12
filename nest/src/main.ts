import 'reflect-metadata';
import knexLib from 'knex';
import { createNestApp } from './create-app';

async function bootstrap() {
  const knex = knexLib({
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgres://microlearn:microlearn@localhost:5432/microlearn',
  });
  const app = await createNestApp(knex);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MicroLearn (NestJS) listening on port ${port}`);
}

bootstrap();
