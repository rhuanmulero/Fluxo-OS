import { Injectable } from '@nestjs/common';
import { PomodoroSession } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { NewSession, PomodoroRepository, SessionQuery } from './pomodoro.repository.interface';

@Injectable()
export class PrismaPomodoroRepository implements PomodoroRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewSession): Promise<PomodoroSession> {
    return this.prisma.pomodoroSession.create({ data });
  }

  findMany(query: SessionQuery): Promise<PomodoroSession[]> {
    return this.prisma.pomodoroSession.findMany({
      where: {
        userId: query.userId,
        taskId: query.taskId,
        startedAt: { gte: query.from, lte: query.to },
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
