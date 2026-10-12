import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../common/constants';
import { CurrentUser, SessionUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import { LoginDto, SignupDto } from './auth.dto';
import { AuthService, publicUser } from './auth.service';
import { SessionService } from './session.service';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_TTL_MS,
  path: '/',
});

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(SessionService) private readonly sessions: SessionService) {}

  @Public() @Post('signup') @HttpCode(201)
  async signup(@Body() dto: SignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.signup(dto, req.get('user-agent'));
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    return { user: publicUser(user) };
  }

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto, req.get('user-agent'));
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    return { user: publicUser(user) };
  }

  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy((req as any).cookies?.[SESSION_COOKIE_NAME]);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Public() @Get('me')
  me(@CurrentUser() user: SessionUser | null) {
    return { user: user ? publicUser(user) : null };
  }
}
