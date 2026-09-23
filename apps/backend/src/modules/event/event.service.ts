import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventVisibility } from '@prisma/client';
import { PROJECT_REPOSITORY, ProjectRepository } from '../project/project.repository.interface';
import {
  WORKSPACE_REPOSITORY,
  WorkspaceRepository,
} from '../workspace/workspace.repository.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { EventFilterDto } from './dto/event-filter.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { SetEventVisibilityDto } from './dto/set-event-visibility.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  EVENT_REPOSITORY,
  EventRepository,
  EventWithParticipants,
} from './event.repository.interface';

@Injectable()
export class EventService {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filter: EventFilterDto = {},
  ): Promise<EventResponseDto[]> {
    const memberships = await this.projects.listMembershipsOf(userId);

    const events = await this.events.findVisible({
      workspaceId,
      authorId: userId,
      participantOf: userId,
      visibleProjectIds: memberships.map((membership) => membership.projectId),
      projectId: filter.projectId,
      from: filter.from ? new Date(filter.from) : undefined,
      to: filter.to ? new Date(filter.to) : undefined,
    });

    return events.map(EventResponseDto.from);
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : undefined;

    this.assertInterval(startsAt, endsAt);
    await this.assertProjectMembership(userId, dto.projectId);
    await this.assertParticipants(workspaceId, dto.participantIds);

    const event = await this.events.create({
      workspaceId,
      authorId: userId,
      title: dto.title,
      startsAt,
      allDay: dto.allDay ?? false,
      ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(endsAt === undefined ? {} : { endsAt }),
      ...(dto.participantIds === undefined ? {} : { participantIds: dto.participantIds }),
    });

    return EventResponseDto.from(event);
  }

  async update(
    workspaceId: string,
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    const current = await this.requireOwn(workspaceId, userId, eventId);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt === undefined ? current.endsAt : new Date(dto.endsAt);
    const projectId = dto.projectId === undefined ? current.projectId : dto.projectId;

    this.assertInterval(startsAt, endsAt ?? undefined);
    await this.assertProjectMembership(userId, dto.projectId);
    await this.assertParticipants(workspaceId, dto.participantIds);
    this.assertProjectRequiredForVisibility(current.visibility, projectId);

    return EventResponseDto.from(
      await this.events.update(eventId, {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.startsAt === undefined ? {} : { startsAt }),
        ...(dto.endsAt === undefined ? {} : { endsAt }),
        ...(dto.allDay === undefined ? {} : { allDay: dto.allDay }),
        ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
        ...(dto.participantIds === undefined ? {} : { participantIds: dto.participantIds }),
      }),
    );
  }

  async remove(workspaceId: string, userId: string, eventId: string): Promise<void> {
    await this.requireOwn(workspaceId, userId, eventId);
    await this.events.delete(eventId);
  }

  async setVisibility(
    workspaceId: string,
    userId: string,
    eventId: string,
    dto: SetEventVisibilityDto,
  ): Promise<EventResponseDto> {
    const event = await this.requireOwn(workspaceId, userId, eventId);

    this.assertProjectRequiredForVisibility(dto.visibility, event.projectId);

    return EventResponseDto.from(
      await this.events.update(eventId, { visibility: dto.visibility }),
    );
  }

  private async assertParticipants(
    workspaceId: string,
    participantIds?: string[],
  ): Promise<void> {
    if (!participantIds || participantIds.length === 0) {
      return;
    }

    const unique = [...new Set(participantIds)];

    if (!(await this.workspaces.areMembers(workspaceId, unique))) {
      throw new BadRequestException('Só é possível convidar membros deste workspace.');
    }
  }

  private assertProjectRequiredForVisibility(
    visibility: EventVisibility,
    projectId: string | null,
  ): void {
    if (visibility === 'PROJECT' && !projectId) {
      throw new BadRequestException(
        'Vincule o evento a um projeto antes de publicá-lo para a equipe.',
      );
    }
  }

  private assertInterval(startsAt: Date, endsAt: Date | undefined): void {
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new BadRequestException('O término do evento não pode ser antes do início.');
    }
  }

  private async assertProjectMembership(
    userId: string,
    projectId: string | null | undefined,
  ): Promise<void> {
    if (!projectId) {
      return;
    }

    const membership = await this.projects.findMembership(projectId, userId);

    if (!membership) {
      throw new BadRequestException('Você não participa deste projeto.');
    }
  }

  private async requireOwn(
    workspaceId: string,
    userId: string,
    eventId: string,
  ): Promise<EventWithParticipants> {
    const event = await this.events.findById(eventId);

    if (!event || event.workspaceId !== workspaceId) {
      throw new NotFoundException('Evento não encontrado.');
    }

    if (event.authorId !== userId) {
      throw new ForbiddenException('Este evento pertence a outro usuário.');
    }

    return event;
  }
}
