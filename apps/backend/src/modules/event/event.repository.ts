import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  EventChanges,
  EventQuery,
  EventRepository,
  EventWithParticipants,
  NewEvent,
} from './event.repository.interface';

const WITH_PARTICIPANTS = {
  participants: { include: { user: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class PrismaEventRepository implements EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(query: EventQuery): Promise<EventWithParticipants[]> {
    const window: Prisma.DateTimeFilter = {};

    if (query.from) window.gte = query.from;
    if (query.to) window.lte = query.to;

    return this.prisma.event.findMany({
      where: {
        workspaceId: query.workspaceId,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.from || query.to ? { startsAt: window } : {}),
        OR: [
          { authorId: query.authorId },
          { visibility: 'PROJECT', projectId: { in: query.visibleProjectIds } },
          { participants: { some: { userId: query.participantOf } } },
        ],
      },
      orderBy: { startsAt: 'asc' },
      include: WITH_PARTICIPANTS,
    });
  }

  findById(id: string): Promise<EventWithParticipants | null> {
    return this.prisma.event.findUnique({ where: { id }, include: WITH_PARTICIPANTS });
  }

  create(data: NewEvent): Promise<EventWithParticipants> {
    const { participantIds, ...event } = data;

    return this.prisma.event.create({
      data: {
        ...event,
        ...(participantIds === undefined
          ? {}
          : { participants: { create: participantIds.map((userId) => ({ userId })) } }),
      },
      include: WITH_PARTICIPANTS,
    });
  }

  update(id: string, changes: EventChanges): Promise<EventWithParticipants> {
    const { participantIds, ...event } = changes;

    if (participantIds === undefined) {
      return this.prisma.event.update({
        where: { id },
        data: event,
        include: WITH_PARTICIPANTS,
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.eventParticipant.deleteMany({ where: { eventId: id } });

      return transaction.event.update({
        where: { id },
        data: {
          ...event,
          participants: { create: participantIds.map((userId) => ({ userId })) },
        },
        include: WITH_PARTICIPANTS,
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }
}
