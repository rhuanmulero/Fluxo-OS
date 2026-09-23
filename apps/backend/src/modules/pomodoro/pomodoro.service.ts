import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RecordSessionDto } from './dto/record-session.dto';
import { SessionFilterDto } from './dto/session-filter.dto';
import { PomodoroSummary, SessionResponseDto } from './dto/session-response.dto';
import { POMODORO_REPOSITORY, PomodoroRepository } from './pomodoro.repository.interface';

const TOLERANCE_MINUTES = 1;

@Injectable()
export class PomodoroService {
  constructor(@Inject(POMODORO_REPOSITORY) private readonly sessions: PomodoroRepository) {}

  async record(userId: string, dto: RecordSessionDto): Promise<SessionResponseDto> {
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);

    if (endedAt.getTime() <= startedAt.getTime()) {
      throw new BadRequestException('O fim do ciclo deve ser posterior ao início.');
    }

    const elapsed = (endedAt.getTime() - startedAt.getTime()) / 60_000;

    if (Math.abs(elapsed - dto.durationMinutes) > TOLERANCE_MINUTES) {
      throw new BadRequestException(
        'A duração informada não corresponde ao intervalo do ciclo.',
      );
    }

    const session = await this.sessions.create({
      userId,
      projectId: dto.projectId,
      taskId: dto.taskId,
      mode: dto.mode,
      startedAt,
      endedAt,
      durationMinutes: dto.durationMinutes,
    });

    return SessionResponseDto.from(session);
  }

  async list(userId: string, filter: SessionFilterDto): Promise<SessionResponseDto[]> {
    const sessions = await this.sessions.findMany({
      userId,
      taskId: filter.taskId,
      from: filter.from === undefined ? undefined : new Date(filter.from),
      to: filter.to === undefined ? undefined : new Date(filter.to),
    });

    return sessions.map(SessionResponseDto.from);
  }

  async summaryOf(userId: string, from?: Date, to?: Date): Promise<PomodoroSummary> {
    const sessions = await this.sessions.findMany({ userId, from, to });

    const summary: PomodoroSummary = {
      focusMinutes: 0,
      breakMinutes: 0,
      completedCycles: 0,
      byTask: {},
    };

    for (const session of sessions) {
      if (session.mode === 'FOCUS') {
        summary.focusMinutes += session.durationMinutes;
        summary.completedCycles += 1;

        if (session.taskId) {
          summary.byTask[session.taskId] =
            (summary.byTask[session.taskId] ?? 0) + session.durationMinutes;
        }
      } else {
        summary.breakMinutes += session.durationMinutes;
      }
    }

    return summary;
  }
}
