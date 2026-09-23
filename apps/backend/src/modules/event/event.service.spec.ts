import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Event } from '@prisma/client';
import { EventService } from './event.service';
import {
  EventChanges,
  EventQuery,
  EventRepository,
  EventWithParticipants,
  NewEvent,
} from './event.repository.interface';

function participantsOf(ids: string[] | undefined) {
  return (ids ?? []).map((id) => ({ user: { id, name: `Pessoa ${id}` } }));
}

class FakeEventRepository implements EventRepository {
  events: EventWithParticipants[] = [];

  findVisible(query: EventQuery): Promise<EventWithParticipants[]> {
    return Promise.resolve(
      this.events.filter(
        (event) =>
          event.workspaceId === query.workspaceId &&
          (event.authorId === query.authorId ||
            event.participants.some(
              (participant) => participant.user.id === query.participantOf,
            ) ||
            (event.visibility === 'PROJECT' &&
              event.projectId !== null &&
              query.visibleProjectIds.includes(event.projectId))),
      ),
    );
  }

  findById(id: string): Promise<EventWithParticipants | null> {
    return Promise.resolve(this.events.find((event) => event.id === id) ?? null);
  }

  create(data: NewEvent): Promise<EventWithParticipants> {
    const { participantIds, ...rest } = data;

    const event = {
      id: `e${this.events.length + 1}`,
      description: rest.description ?? null,
      endsAt: rest.endsAt ?? null,
      projectId: rest.projectId ?? null,
      visibility: 'PRIVATE',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...rest,
      participants: participantsOf(participantIds),
    } as EventWithParticipants;

    this.events.push(event);

    return Promise.resolve(event);
  }

  update(id: string, changes: EventChanges): Promise<EventWithParticipants> {
    const event = this.events.find((candidate) => candidate.id === id) as EventWithParticipants;
    const { participantIds, ...rest } = changes;

    Object.assign(event, rest);

    if (participantIds !== undefined) {
      event.participants = participantsOf(participantIds);
    }

    return Promise.resolve(event);
  }

  delete(id: string): Promise<void> {
    this.events = this.events.filter((event) => event.id !== id);

    return Promise.resolve();
  }
}

class FakeWorkspaceRepository {
  members = new Set<string>();

  areMembers(_workspaceId: string, userIds: string[]): Promise<boolean> {
    return Promise.resolve(userIds.every((userId) => this.members.has(userId)));
  }
}

class FakeProjectRepository {
  memberships = new Map<string, string[]>();

  findMembership(projectId: string, userId: string) {
    return Promise.resolve(
      this.memberships.get(userId)?.includes(projectId) ? { projectId, userId } : null,
    );
  }

  listMembershipsOf(userId: string) {
    return Promise.resolve(
      (this.memberships.get(userId) ?? []).map((projectId) => ({ projectId, userId })),
    );
  }
}

describe('EventService', () => {
  let repository: FakeEventRepository;
  let projects: FakeProjectRepository;
  let workspaces: FakeWorkspaceRepository;
  let service: EventService;

  beforeEach(() => {
    repository = new FakeEventRepository();
    projects = new FakeProjectRepository();
    workspaces = new FakeWorkspaceRepository();
    service = new EventService(repository, projects as never, workspaces as never);
  });

  it('recusa evento cujo fim é anterior ao início', async () => {
    await expect(
      service.create('w1', 'u1', {
        title: 'Daily',
        startsAt: '2026-09-10T14:00:00.000Z',
        endsAt: '2026-09-10T13:00:00.000Z',
        allDay: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita evento sem fim', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Dentista',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    expect(event.endsAt).toBeNull();
  });

  it('recusa publicar para o projeto um evento que não tem projeto', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Solo',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await expect(
      service.setVisibility('w1', 'u1', event.id, { visibility: 'PROJECT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa vincular a um projeto de que o autor não participa', async () => {
    await expect(
      service.create('w1', 'u1', {
        title: 'Reunião',
        projectId: 'p9',
        startsAt: '2026-09-10T14:00:00.000Z',
        allDay: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não vaza evento privado de outro membro do mesmo projeto', async () => {
    projects.memberships.set('u1', ['p1']);
    projects.memberships.set('u2', ['p1']);

    await service.create('w1', 'u2', {
      title: 'Terapia',
      projectId: 'p1',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    const visible = await service.list('w1', 'u1');

    expect(visible).toHaveLength(0);
  });

  it('mostra ao time o evento publicado para o projeto', async () => {
    projects.memberships.set('u1', ['p1']);
    projects.memberships.set('u2', ['p1']);

    const event = await service.create('w1', 'u2', {
      title: 'Planning',
      projectId: 'p1',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await service.setVisibility('w1', 'u2', event.id, { visibility: 'PROJECT' });

    const visible = await service.list('w1', 'u1');

    expect(visible).toHaveLength(1);
    expect(visible[0]?.title).toBe('Planning');
  });

  it('recusa edição por quem não é o autor', async () => {
    const event = await service.create('w1', 'u2', {
      title: 'Meu',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await expect(
      service.update('w1', 'u1', event.id, { title: 'Roubado' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recusa evento de outro workspace', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Meu',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await expect(
      service.update('w2', 'u1', event.id, { title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria evento sem projeto e sem descrição com null nos dois campos', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Café',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    expect(event.projectId).toBeNull();
    expect(event.description).toBeNull();
  });

  it('atualização parcial mantém os campos não alterados', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Original',
      description: 'Descrição original',
      startsAt: '2026-09-10T14:00:00.000Z',
      endsAt: '2026-09-10T15:00:00.000Z',
      allDay: false,
    });

    const updated = await service.update('w1', 'u1', event.id, { title: 'Novo título' });

    expect(updated.title).toBe('Novo título');
    expect(updated.description).toBe('Descrição original');
    expect(updated.startsAt).toEqual(new Date('2026-09-10T14:00:00.000Z'));
    expect(updated.endsAt).toEqual(new Date('2026-09-10T15:00:00.000Z'));
    expect(updated.allDay).toBe(false);
  });

  it('recusa atualização cujo fim passa a ser anterior ao início', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Reunião',
      startsAt: '2026-09-10T14:00:00.000Z',
      endsAt: '2026-09-10T15:00:00.000Z',
      allDay: false,
    });

    await expect(
      service.update('w1', 'u1', event.id, { endsAt: '2026-09-10T13:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa mover o evento para um projeto de que o autor não participa', async () => {
    const event = await service.create('w1', 'u1', {
      title: 'Reunião',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await expect(
      service.update('w1', 'u1', event.id, { projectId: 'p9' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa remover o projeto de um evento publicado para a equipe', async () => {
    projects.memberships.set('u1', ['p1']);

    const event = await service.create('w1', 'u1', {
      title: 'Planning',
      projectId: 'p1',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await service.setVisibility('w1', 'u1', event.id, { visibility: 'PROJECT' });

    await expect(
      service.update('w1', 'u1', event.id, { projectId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite remover o projeto de um evento privado', async () => {
    projects.memberships.set('u1', ['p1']);

    const event = await service.create('w1', 'u1', {
      title: 'Solo',
      projectId: 'p1',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    const updated = await service.update('w1', 'u1', event.id, { projectId: null });

    expect(updated.projectId).toBeNull();
  });

  it('recusa exclusão por quem não é o autor', async () => {
    const event = await service.create('w1', 'u2', {
      title: 'Meu',
      startsAt: '2026-09-10T14:00:00.000Z',
      allDay: false,
    });

    await expect(service.remove('w1', 'u1', event.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('inclui na busca os eventos em que o usuário é participante', async () => {
    const events = { findVisible: jest.fn().mockResolvedValue([]) };
    const isolated = new EventService(events as never, projects as never, workspaces as never);

    await isolated.list('workspace-1', 'user-1', {});

    expect(events.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'user-1', participantOf: 'user-1' }),
    );
  });

  it('recusa participante que não é membro do workspace', async () => {
    await expect(
      service.create('w1', 'u1', {
        title: 'Reunião',
        startsAt: '2026-09-10T14:00:00.000Z',
        participantIds: ['estranho'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('participante enxerga o evento privado em que foi incluído', async () => {
    workspaces.members.add('u2');

    await service.create('w1', 'u1', {
      title: 'Alinhamento',
      startsAt: '2026-09-10T14:00:00.000Z',
      participantIds: ['u2'],
    });

    const doAutor = await service.list('w1', 'u1');
    const doParticipante = await service.list('w1', 'u2');
    const deTerceiro = await service.list('w1', 'u3');

    expect(doAutor).toHaveLength(1);
    expect(doParticipante).toHaveLength(1);
    expect(deTerceiro).toHaveLength(0);
  });

  it('a resposta carrega os participantes com id e nome', async () => {
    workspaces.members.add('u2');

    const event = await service.create('w1', 'u1', {
      title: 'Alinhamento',
      startsAt: '2026-09-10T14:00:00.000Z',
      participantIds: ['u2'],
    });

    expect(event.participants).toEqual([{ id: 'u2', name: 'Pessoa u2' }]);
  });

  it('a lista enviada na edição substitui a anterior', async () => {
    workspaces.members.add('u2');
    workspaces.members.add('u3');

    const event = await service.create('w1', 'u1', {
      title: 'Alinhamento',
      startsAt: '2026-09-10T14:00:00.000Z',
      participantIds: ['u2'],
    });

    const updated = await service.update('w1', 'u1', event.id, { participantIds: ['u3'] });

    expect(updated.participants).toEqual([{ id: 'u3', name: 'Pessoa u3' }]);
    expect(await service.list('w1', 'u2')).toHaveLength(0);
    expect(await service.list('w1', 'u3')).toHaveLength(1);
  });

  it('remove todos os participantes quando a lista enviada é vazia', async () => {
    workspaces.members.add('u2');

    const event = await service.create('w1', 'u1', {
      title: 'Alinhamento',
      startsAt: '2026-09-10T14:00:00.000Z',
      participantIds: ['u2'],
    });

    const updated = await service.update('w1', 'u1', event.id, { participantIds: [] });

    expect(updated.participants).toEqual([]);
  });

  it('não consulta o workspace quando não há participante para validar', async () => {
    const spy = jest.spyOn(workspaces, 'areMembers');

    await service.create('w1', 'u1', {
      title: 'Sozinho',
      startsAt: '2026-09-10T14:00:00.000Z',
    });

    expect(spy).not.toHaveBeenCalled();
  });
});
