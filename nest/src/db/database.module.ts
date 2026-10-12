import { DynamicModule, Global, Module } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../common/constants';

/** Provides the Knex instance (real pg in production, injected pg-mem in tests) to every module. */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(knex: Knex): DynamicModule {
    return { module: DatabaseModule, providers: [{ provide: KNEX, useValue: knex }], exports: [KNEX] };
  }
}
