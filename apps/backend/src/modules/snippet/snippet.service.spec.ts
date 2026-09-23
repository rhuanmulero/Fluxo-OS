import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Snippet } from '@prisma/client';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { SnippetService } from './snippet.service';
import {
  NewSnippet,
  SnippetChanges,
  SnippetQuery,
  SnippetRepository,
} from './snippet.repository.interface';

class FakeSnippetRepository implements SnippetRepository {
  snippets: Snippet[] = [];

  findVisible(query: SnippetQuery): Promise<Snippet[]> {
    return Promise.resolve(
      this.snippets.filter(
        (s) =>
          s.workspaceId === query.workspaceId &&
          (s.authorId === query.authorId ||
            s.visibility === 'PUBLIC' ||
            (query.includePending === true && s.moderationStatus === 'PENDING')),
      ),
    );
  }

  findById(id: string): Promise<Snippet | null> {
    return Promise.resolve(this.snippets.find((s) => s.id === id) ?? null);
  }

  create(data: NewSnippet): Promise<Snippet> {
    const snippet: Snippet = {
      id: `s${this.snippets.length + 1}`,
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      authorId: data.authorId,
      name: data.name,
      folder: data.folder,
      language: data.language,
      code: data.code,
      visibility: data.visibility,
      moderationStatus: data.moderationStatus,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.snippets.push(snippet);
    return Promise.resolve(snippet);
  }

  update(id: string, changes: SnippetChanges): Promise<Snippet> {
    const snippet = this.snippets.find((s) => s.id === id);
    if (!snippet) throw new Error('não encontrado');
    Object.assign(snippet, changes);
    return Promise.resolve(snippet);
  }

  delete(id: string): Promise<void> {
    this.snippets = this.snippets.filter((s) => s.id !== id);
    return Promise.resolve();
  }
}

const valid = {
  name: 'Fetch wrapper',
  folder: 'Frontend',
  language: 'JavaScript',
  code: 'export async function fetchApi() {}',
};

describe('SnippetService', () => {
  let repository: FakeSnippetRepository;
  let service: SnippetService;

  beforeEach(() => {
    repository = new FakeSnippetRepository();
    service = new SnippetService(repository);
  });

  it('MEMBER cria snippet privado sem moderação pedida', async () => {
    const snippet = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    expect(snippet.visibility).toBe('PRIVATE');
    expect(snippet.moderationStatus).toBe('NOT_REQUESTED');
  });

  it('ADMIN cria snippet já público e aprovado', async () => {
    const snippet = await service.create('w1', 'u1', WorkspaceRole.ADMIN, valid);

    expect(snippet.visibility).toBe('PUBLIC');
    expect(snippet.moderationStatus).toBe('APPROVED');
  });

  it('autor pede publicação e o snippet fica pendente', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    const pending = await service.requestPublication('w1', 'u1', created.id);

    expect(pending.moderationStatus).toBe('PENDING');
    expect(pending.visibility).toBe('PRIVATE');
  });

  it('impede pedir publicação de snippet alheio', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    await expect(service.requestPublication('w1', 'u2', created.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aprovação torna o snippet público', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);
    await service.requestPublication('w1', 'u1', created.id);

    const approved = await service.review('w1', 'admin', created.id, { approve: true });

    expect(approved.visibility).toBe('PUBLIC');
    expect(approved.moderationStatus).toBe('APPROVED');
  });

  it('recusa mantém o snippet privado e marcado como rejeitado', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);
    await service.requestPublication('w1', 'u1', created.id);

    const rejected = await service.review('w1', 'admin', created.id, { approve: false });

    expect(rejected.visibility).toBe('PRIVATE');
    expect(rejected.moderationStatus).toBe('REJECTED');
  });

  it('recusa moderar snippet que não pediu publicação', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    await expect(
      service.review('w1', 'admin', created.id, { approve: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ADMIN edita snippet de outra pessoa', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    const updated = await service.update('w1', 'u2', WorkspaceRole.ADMIN, created.id, {
      name: 'Renomeado',
    });

    expect(updated.name).toBe('Renomeado');
  });

  it('MEMBER não edita snippet de outra pessoa', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    await expect(
      service.update('w1', 'u2', WorkspaceRole.MEMBER, created.id, { name: 'Renomeado' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ADMIN enxerga o snippet pendente de outra pessoa para poder moderar', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);
    await service.requestPublication('w1', 'u1', created.id);

    const visible = await service.list('w1', 'admin', WorkspaceRole.ADMIN, {});

    expect(visible.map((s) => s.id)).toContain(created.id);
  });

  it('MEMBER não enxerga o snippet pendente de outra pessoa', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);
    await service.requestPublication('w1', 'u1', created.id);

    const visible = await service.list('w1', 'u2', WorkspaceRole.MEMBER, {});

    expect(visible.map((s) => s.id)).not.toContain(created.id);
  });

  it('recusa snippet de outro workspace', async () => {
    const created = await service.create('w1', 'u1', WorkspaceRole.MEMBER, valid);

    await expect(
      service.update('w2', 'u1', WorkspaceRole.MEMBER, created.id, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
