import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, SessionUser } from '../common/current-user.decorator';
import { LessonsService } from './lessons.service';

@Controller('api')
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessons: LessonsService) {}

  @Get('categories') categories() { return this.lessons.categories(); }

  @Get('lessons')
  list(@CurrentUser() user: SessionUser, @Query('category') category?: string) {
    return this.lessons.list(user.id, category);
  }

  @Get('lessons/:id') detail(@Param('id') id: string) { return this.lessons.detail(id); }

  @Post('lessons/:id/submit') @HttpCode(200)
  submit(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() body: { answers?: Record<string, number> }) {
    return this.lessons.submit(user.id, id, body?.answers || {});
  }
}
