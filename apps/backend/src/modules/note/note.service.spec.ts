import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Note, ProjectMember } from '@prisma/client';
import { NoteService } from './note.service';
import { NewNote, NoteChanges, NoteQuery, NoteRepository } from './note.repository.interface';
import { ProjectRepository } from '../project/project.repository.interface';

class FakeNoteRepository implements NoteRepository {
  notes: Note[] = [];

  findVisible(query: NoteQuery): Promise<Note[]> {
    return Promise.resolve(
      this.notes.filter(
        (note) =>
          note.workspaceId === query.workspaceId &&
          (note.authorId === query.authorId ||
            (note.visibility === 'PROJECT' &&
              note.projectId !== null &&
              query.visibleProjectIds.includes(note.projectId))),
      ),
    );
  }

  findById(id: string): Promise<Note | null> {
    return Promise.resolve(this.notes.find((note) => note.id === id) ?? null);
  }

  create(data: NewNote): Promise<Note> {
    const note: Note = {
      id: `n${this.notes.length + 1}`,
      workspaceId: data.workspaceId,
      authorId: data.authorId,
      projectId: data.projectId ?? null,
      title: data.title,
      body: data.body,
      color: data.color ?? null,
      isPinned: data.isPinned,
      visibility: 'PRIVATE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notes.push(note);
    return Promise.resolve(note);
  }

  update(id: string, changes: NoteChanges): Promise<Note> {
    const note = this.notes.find((n) => n.id === id);
    if (!note) throw new Error('não encontrada');
    Object.assign(note, changes);
    return Promise.resolve(note);
  }

  delete(id: string): Promise<void> {
    this.notes = this.notes.filter((n) => n.id !== id);
    return Promise.resolve();
  }
}

const membership: ProjectMember = {
  id: 'pm1',
  projectId: 'p1',
  userId: 'u1',
  addedAt: new Date(),
};

function projectsWith(memberships: ProjectMember[]): ProjectRepository {
  return {
    findMembership: (projectId: string, userId: string) =>
      Promise.resolve(
        memberships.find((m) => m.projectId === projectId && m.userId === userId) ?? null,
      ),
    listMembershipsOf: (userId: string) =>
      Promise.resolve(memberships.filter((m) => m.userId === userId)),
  } as unknown as ProjectRepository;
}

const validNote = { title: 'Arquitetura', body: 'Camadas do backend.' };

describe('NoteService', () => {
  let notes: FakeNoteRepository;
  let service: NoteService;

  beforeEach(() => {
    notes = new FakeNoteRepository();
    service = new NoteService(notes, projectsWith([membership]));
  });

  it('cria a nota privada por padrão', async () => {
    const note = await service.create('w1', 'u1', validNote);

    expect(note.visibility).toBe('PRIVATE');
    expect(note.projectId).toBeNull();
  });

  it('recusa corpo vazio', async () => {
    await expect(
      service.create('w1', 'u1', { ...validNote, body: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa corpo com mais de 7000 caracteres', async () => {
    await expect(
      service.create('w1', 'u1', { ...validNote, body: 'a'.repeat(7001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita corpo com exatamente 7000 caracteres', async () => {
    const note = await service.create('w1', 'u1', { ...validNote, body: 'a'.repeat(7000) });

    expect(note.id).toBeDefined();
  });

  it('recusa vincular a projeto do qual o autor não participa', async () => {
    await expect(
      service.create('w1', 'u1', { ...validNote, projectId: 'p2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('impede editar a nota de outra pessoa', async () => {
    const note = await service.create('w1', 'u1', validNote);

    await expect(
      service.update('w1', 'u2', note.id, { title: 'Sequestrada' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('impede excluir a nota de outra pessoa', async () => {
    const note = await service.create('w1', 'u1', validNote);

    await expect(service.remove('w1', 'u2', note.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('exige projeto ao publicar a nota', async () => {
    const note = await service.create('w1', 'u1', validNote);

    await expect(
      service.setVisibility('w1', 'u1', note.id, { visibility: 'PROJECT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publica a nota vinculada a um projeto', async () => {
    const note = await service.create('w1', 'u1', { ...validNote, projectId: 'p1' });

    const published = await service.setVisibility('w1', 'u1', note.id, {
      visibility: 'PROJECT',
    });

    expect(published.visibility).toBe('PROJECT');
  });

  it('mostra a nota publicada a outro membro do projeto', async () => {
    const note = await service.create('w1', 'u1', { ...validNote, projectId: 'p1' });
    await service.setVisibility('w1', 'u1', note.id, { visibility: 'PROJECT' });

    const outro = new NoteService(
      notes,
      projectsWith([membership, { ...membership, id: 'pm2', userId: 'u2' }]),
    );

    await expect(outro.list('w1', 'u2')).resolves.toHaveLength(1);
  });

  it('esconde a nota privada de outro membro do projeto', async () => {
    await service.create('w1', 'u1', { ...validNote, projectId: 'p1' });

    const outro = new NoteService(
      notes,
      projectsWith([membership, { ...membership, id: 'pm2', userId: 'u2' }]),
    );

    await expect(outro.list('w1', 'u2')).resolves.toHaveLength(0);
  });

  it('recusa nota de outro workspace', async () => {
    const note = await service.create('w1', 'u1', validNote);

    await expect(service.update('w2', 'u1', note.id, { title: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('repassa a busca ao repositório em vez de filtrar no serviço', async () => {
    const repository = { findVisible: jest.fn().mockResolvedValue([]) };
    const isolated = new NoteService(repository as never, projectsWith([]) as never);

    await isolated.list('workspace-1', 'user-1', { q: 'arquitetura' });

    expect(repository.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-1', authorId: 'user-1', q: 'arquitetura' }),
    );
  });
});
