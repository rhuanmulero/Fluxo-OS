import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { RecordSessionDto } from './dto/record-session.dto';
import { SessionFilterDto } from './dto/session-filter.dto';
import { PomodoroSummary, SessionResponseDto } from './dto/session-response.dto';
import { PomodoroService } from './pomodoro.service';

@Controller('pomodoro')
@UseGuards(AuthGuard)
export class PomodoroController {
  constructor(private readonly pomodoro: PomodoroService) {}

  @Post('sessions')
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordSessionDto,
  ): Promise<SessionResponseDto> {
    return this.pomodoro.record(user.id, dto);
  }

  @Get('sessions')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: SessionFilterDto,
  ): Promise<SessionResponseDto[]> {
    return this.pomodoro.list(user.id, filter);
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: SessionFilterDto,
  ): Promise<PomodoroSummary> {
    return this.pomodoro.summaryOf(
      user.id,
      filter.from === undefined ? undefined : new Date(filter.from),
      filter.to === undefined ? undefined : new Date(filter.to),
    );
  }
}
