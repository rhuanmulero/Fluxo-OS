import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Document } from '@prisma/client';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { UploadedFile } from '../../common/storage/file-storage';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentService } from './document.service';

const arquivo: UploadedFile = {
  originalName: 'arquitetura.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('conteudo'),
};

function gravado(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    workspaceId: 'workspace-1',
    projectId: null,
    authorId: 'user-1',
    name: 'Arquitetura',
    folder: 'Docs',
    scope: 'PRIVATE',
    fileName: 'arquitetura.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 8,
    storageKey: 'workspace-1/uuid.pdf',
    createdAt: new Date('2026-09-09T08:00:00.000Z'),
    updatedAt: new Date('2026-09-09T08:00:00.000Z'),
    ...overrides,
  };
}

describe('DocumentService', () => {
  let documents: {
    findVisible: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let storage: { save: jest.Mock; read: jest.Mock; remove: jest.Mock };
  let projects: { listMembershipsOf: jest.Mock };
  let service: DocumentService;

  beforeEach(() => {
    documents = {
      findVisible: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(gravado()),
      create: jest.fn().mockImplementation((data: unknown) => Promise.resolve(gravado(data as Partial<Document>))),
      update: jest.fn().mockResolvedValue(gravado()),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      save: jest.fn().mockResolvedValue({ storageKey: 'workspace-1/uuid.pdf', sizeBytes: 8 }),
      read: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    projects = { listMembershipsOf: jest.fn().mockResolvedValue([]) };

    service = new DocumentService(
      documents as never,
      storage as never,
      projects as never,
    );
  });

  it('exige projectId quando o escopo é PROJECT', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
        { name: 'Arquitetura', folder: 'Docs', scope: 'PROJECT' },
        arquivo,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('recusa projectId quando o escopo é WORKSPACE', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.ADMIN,
        { name: 'Arquitetura', folder: 'Docs', scope: 'WORKSPACE', projectId: 'project-1' },
        arquivo,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('impede MEMBER de criar documento de workspace', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
        { name: 'Política', folder: 'Docs', scope: 'WORKSPACE' },
        arquivo,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('recusa tipo fora da lista', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
        { name: 'Binário', folder: 'Docs', scope: 'PRIVATE' },
        {
          originalName: 'x.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.alloc(1),
        },
      ),
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });

  it('recusa extensão que não combina com o tipo declarado', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
        { name: 'Disfarçado', folder: 'Docs', scope: 'PRIVATE' },
        { originalName: 'x.exe', mimeType: 'image/png', buffer: Buffer.alloc(1) },
      ),
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });

  it('recusa arquivo acima de 10 MB', async () => {
    await expect(
      service.create(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
        { name: 'Grande', folder: 'Docs', scope: 'PRIVATE' },
        {
          originalName: 'g.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        },
      ),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('grava o arquivo e guarda os metadados sem tocar no nome enviado', async () => {
    await service.create(
      'workspace-1',
      'user-1',
      WorkspaceRole.MEMBER,
      { name: 'Arquitetura', folder: 'Docs', scope: 'PRIVATE' },
      arquivo,
    );

    expect(storage.save).toHaveBeenCalledWith('workspace-1', arquivo);
    expect(documents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'arquitetura.pdf',
        storageKey: 'workspace-1/uuid.pdf',
        sizeBytes: 8,
      }),
    );
  });

  it('não expõe a chave de armazenamento na resposta', () => {
    const dto = DocumentResponseDto.from(gravado());

    expect(Object.keys(dto)).not.toContain('storageKey');
  });

  it('apaga a linha antes do arquivo e propaga falha de disco', async () => {
    storage.remove.mockRejectedValue(new Error('disco cheio'));

    await expect(
      service.remove('workspace-1', 'user-1', WorkspaceRole.MEMBER, 'doc-1'),
    ).rejects.toThrow('disco cheio');

    expect(documents.delete).toHaveBeenCalledWith('doc-1');
  });

  it('esconde documento privado de outra pessoa por trás de 404', async () => {
    documents.findById.mockResolvedValue(gravado({ authorId: 'outra-pessoa' }));

    await expect(
      service.remove('workspace-1', 'user-1', WorkspaceRole.MEMBER, 'doc-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('não deixa MEMBER excluir documento de workspace', async () => {
    documents.findById.mockResolvedValue(
      gravado({ scope: 'WORKSPACE', authorId: 'outra-pessoa' }),
    );

    await expect(
      service.remove('workspace-1', 'user-1', WorkspaceRole.MEMBER, 'doc-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('repassa a busca e o escopo do filtro ao repositório', async () => {
    await service.list('workspace-1', 'user-1', { q: 'arquitetura', scope: 'WORKSPACE' });

    expect(documents.findVisible).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        authorId: 'user-1',
        q: 'arquitetura',
        scope: 'WORKSPACE',
      }),
    );
  });
});
