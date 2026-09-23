import { Event, EventVisibility } from '@prisma/client';

export const EVENT_REPOSITORY = Symbol('EventRepository');

export interface EventParticipantSummary {
  id: string;
  name: string;
}

export type EventWithParticipants = Event & {
  participants: { user: EventParticipantSummary }[];
};

export interface NewEvent {
  workspaceId: string;
  authorId: string;
  projectId?: string;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  allDay: boolean;
  participantIds?: string[];
}

export interface EventChanges {
  title?: string;
  description?: string;
  startsAt?: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  projectId?: string | null;
  visibility?: EventVisibility;
  participantIds?: string[];
}

export interface EventQuery {
  workspaceId: string;
  authorId: string;
  participantOf: string;
  visibleProjectIds: string[];
  projectId?: string;
  from?: Date;
  to?: Date;
}

export interface EventRepository {
  findVisible(query: EventQuery): Promise<EventWithParticipants[]>;
  findById(id: string): Promise<EventWithParticipants | null>;
  create(data: NewEvent): Promise<EventWithParticipants>;
  update(id: string, changes: EventChanges): Promise<EventWithParticipants>;
  delete(id: string): Promise<void>;
}
