import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Bookmark } from '@prisma/client';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { BookmarkService } from './bookmark.service';

function gravado(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bookmark-1',
    workspaceId: 'workspace-1',
    projectId: null,
    authorId: 'user-1',
    name: 'Documentação do Nest',
    folder: 'Links',
    url: 'https://docs.nestjs.com',
    scope: 'PRIVATE',
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    updatedAt: new Date('2026-09-09T08:00:00.000Z'),
    ...overrides,
  };
}

describe('BookmarkService', () => {
  let bookmarks: {
    findVisible: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let projects: { listMembershipsOf: jest.Mock };
  let service: BookmarkService;

  beforeEach(() => {
    bookmarks = {
      findVisible: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(gravado()),
      create: jest
        .fn()
        .mockImplementation((data: unknown) => Promise.resolve(gravado(data as Partial<Bookmark>))),
      update: jest.fn().mockResolvedValue(gravado()),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    projects = { listMembershipsOf: jest.fn().mockResolvedValue([]) };

    service = new BookmarkService(bookmarks as never, projects as never);
  });

  it('exige projectId quando o escopo é PROJECT', async () => {
    await expect(
      service.create('workspace-1', 'user-1', WorkspaceRole.MEMBER, {
        name: 'Ref',
        folder: 'Links',
        url: 'https://exemplo.com',
        scope: 'PROJECT',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa projectId quando o escopo é WORKSPACE', async () => {
    await expect(
      service.create('workspace-1', 'user-1', WorkspaceRole.ADMIN, {
        name: 'Ref',
        folder: 'Links',
        url: 'https://exemplo.com',
        scope: 'WORKSPACE',
        projectId: 'project-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('impede MEMBER de criar link de workspace', async () => {
    await expect(
      service.create('workspace-1', 'user-1', WorkspaceRole.MEMBER, {
        name: 'Política',
        folder: 'Links',
        url: 'https://exemplo.com',
        scope: 'WORKSPACE',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('recusa endereço com protocolo javascript', async () => {
    await expect(
      service.create('workspace-1', 'user-1', WorkspaceRole.MEMBER, {
        name: 'Ruim',
        folder: 'Links',
        url: 'javascript:alert(1)',
        scope: 'PRIVATE',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa endereço sem protocolo', async () => {
    await expect(
      service.create('workspace-1', 'user-1', WorkspaceRole.MEMBER, {
        name: 'Sem protocolo',
        folder: 'Links',
        url: 'exemplo.com',
        scope: 'PRIVATE',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('grava o link privado com o autor da requisição', async () => {
    await service.create('workspace-1', 'user-1', WorkspaceRole.MEMBER, {
      name: 'Documentação do Nest',
      folder: 'Links',
      url: 'https://docs.nestjs.com',
      scope: 'PRIVATE',
    });

    expect(bookmarks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        authorId: 'user-1',
        url: 'https://docs.nestjs.com',
        scope: 'PRIVATE',
      }),
    );
  });

  it('esconde link privado de outra pessoa por trás de 404', async () => {
    bookmarks.findById.mockResolvedValue(gravado({ authorId: 'outra-pessoa' }));

    await expect(
      service.remove('workspace-1', 'user-1', WorkspaceRole.MEMBER, 'bookmark-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('não deixa MEMBER excluir link de workspace', async () => {
    bookmarks.findById.mockResolvedValue(
      gravado({ scope: 'WORKSPACE', authorId: 'outra-pessoa' }),
    );

    await expect(
      service.remove('workspace-1', 'user-1', WorkspaceRole.MEMBER, 'bookmark-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('repassa a busca ao repositório', async () => {
    await service.list('workspace-1', 'user-1', { q: 'nest' });

    expect(bookmarks.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-1', authorId: 'user-1', q: 'nest' }),
    );
  });
});
