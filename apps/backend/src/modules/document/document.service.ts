import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Document } from '@prisma/client';
import { ReadStream } from 'node:fs';
import { extname } from 'node:path';
import { assertKnowledgeScope } from '../../common/authorization/knowledge-scope';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { FILE_STORAGE, FileStorage, UploadedFile } from '../../common/storage/file-storage';
import { PROJECT_REPOSITORY, ProjectRepository } from '../project/project.repository.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFilterDto } from './dto/document-filter.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DOCUMENT_REPOSITORY, DocumentRepository } from './document.repository.interface';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ACCEPTED = new Map<string, string[]>([
  ['application/pdf', ['.pdf']],
  ['text/markdown', ['.md']],
  ['text/plain', ['.txt', '.md']],
  ['text/csv', ['.csv']],
  ['application/json', ['.json']],
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/webp', ['.webp']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']],
  ['application/zip', ['.zip']],
]);

export interface DocumentDownload {
  document: Document;
  stream: ReadStream;
}

@Injectable()
export class DocumentService {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filter: DocumentFilterDto,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documents.findVisible({
      workspaceId,
      authorId: userId,
      visibleProjectIds: await this.visibleProjectIds(userId),
      ...filter,
    });

    return documents.map(DocumentResponseDto.from);
  }

  async create(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    dto: CreateDocumentDto,
    file: UploadedFile,
  ): Promise<DocumentResponseDto> {
    assertKnowledgeScope('Documento', dto.scope, dto.projectId, role);
    this.assertFile(file);

    const stored = await this.storage.save(workspaceId, file);

    const document = await this.documents.create({
      workspaceId,
      authorId: userId,
      name: dto.name,
      folder: dto.folder,
      scope: dto.scope,
      fileName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
    });

    return DocumentResponseDto.from(document);
  }

  async openDownload(workspaceId: string, userId: string, id: string): Promise<DocumentDownload> {
    const document = await this.requireReadable(workspaceId, userId, id);

    return { document, stream: this.storage.read(document.storageKey) };
  }

  async update(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    id: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const current = await this.requireWritable(workspaceId, userId, role, id);

    const scope = dto.scope ?? current.scope;
    const projectId = dto.projectId === undefined ? current.projectId : dto.projectId;

    assertKnowledgeScope('Documento', scope, projectId, role);

    return DocumentResponseDto.from(
      await this.documents.update(id, {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.folder === undefined ? {} : { folder: dto.folder }),
        ...(dto.scope === undefined ? {} : { scope: dto.scope }),
        ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
      }),
    );
  }

  async remove(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    id: string,
  ): Promise<void> {
    const document = await this.requireWritable(workspaceId, userId, role, id);

    await this.documents.delete(document.id);
    await this.storage.remove(document.storageKey);
  }

  private assertFile(file: UploadedFile): void {
    if (file.buffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException('O arquivo excede o limite de 10 MB.');
    }

    const extensions = ACCEPTED.get(file.mimeType);
    const extension = extname(file.originalName).toLowerCase();

    if (!extensions || !extensions.includes(extension)) {
      throw new UnsupportedMediaTypeException('Tipo de arquivo não aceito no Vault.');
    }
  }

  private async visibleProjectIds(userId: string): Promise<string[]> {
    const memberships = await this.projects.listMembershipsOf(userId);

    return memberships.map((membership) => membership.projectId);
  }

  private async requireReadable(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<Document> {
    const document = await this.documents.findById(id);

    if (!document || document.workspaceId !== workspaceId) {
      throw new NotFoundException('Documento não encontrado.');
    }

    if (document.scope === 'PRIVATE' && document.authorId !== userId) {
      throw new NotFoundException('Documento não encontrado.');
    }

    if (document.scope === 'PROJECT') {
      const visible = await this.visibleProjectIds(userId);

      if (!document.projectId || !visible.includes(document.projectId)) {
        throw new NotFoundException('Documento não encontrado.');
      }
    }

    return document;
  }

  private async requireWritable(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    id: string,
  ): Promise<Document> {
    const document = await this.requireReadable(workspaceId, userId, id);

    if (document.scope === 'WORKSPACE' && !role.atLeast(WorkspaceRole.ADMIN)) {
      throw new ForbiddenException('Só administradores gerenciam documentos do workspace.');
    }

    return document;
  }
}
