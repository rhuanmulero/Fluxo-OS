import { EventVisibility } from '@prisma/client';
import {
  EventParticipantSummary,
  EventWithParticipants,
} from '../event.repository.interface';

export class EventResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly authorId: string,
    readonly projectId: string | null,
    readonly title: string,
    readonly description: string | null,
    readonly startsAt: Date,
    readonly endsAt: Date | null,
    readonly allDay: boolean,
    readonly visibility: EventVisibility,
    readonly participants: EventParticipantSummary[],
  ) {}

  static from(event: EventWithParticipants): EventResponseDto {
    return new EventResponseDto(
      event.id,
      event.workspaceId,
      event.authorId,
      event.projectId,
      event.title,
      event.description,
      event.startsAt,
      event.endsAt,
      event.allDay,
      event.visibility,
      event.participants.map((participant) => participant.user),
    );
  }
}
