import { Controller, Get, Inject, Query } from '@nestjs/common';
import { CurrentUser, SessionUser } from '../common/current-user.decorator';
import { StatsService } from './stats.service';

@Controller('api')
export class StatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get('stats') getStats(@CurrentUser() u: SessionUser) { return this.stats.stats(u.id); }
  @Get('history') history(@CurrentUser() u: SessionUser, @Query('lessonId') lessonId?: string) { return this.stats.history(u.id, lessonId); }
  @Get('profile') profile(@CurrentUser() u: SessionUser) { return this.stats.profile(u); }
  @Get('leaderboard') leaderboard(@CurrentUser() u: SessionUser) { return this.stats.leaderboard(u); }
}
