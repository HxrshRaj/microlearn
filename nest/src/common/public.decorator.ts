import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Marks a route as reachable without a session (signup, login, logout, /auth/me). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
