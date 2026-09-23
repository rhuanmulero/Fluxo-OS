import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Bookmark } from '@prisma/client';
import { assertKnowledgeScope } from '../../common/authorization/knowledge-scope';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { PROJECT_REPOSITORY, ProjectRepository } from '../project/project.repository.interface';
import { BookmarkFilterDto } from './dto/bookmark-filter.dto';
import { BookmarkResponseDto } from './dto/bookmark-response.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import { BOOKMARK_REPOSITORY, BookmarkRepository } from './bookmark.repository.interface';

const ACCEPTED_PROTOCOLS = ['http:', 'https:'];

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY) private readonly bookmarks: BookmarkRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filter: BookmarkFilterDto,
  ): Promise<BookmarkResponseDto[]> {
    const bookmarks = await this.bookmarks.findVisible({
      workspaceId,
      authorId: userId,
      visibleProjectIds: await this.visibleProjectIds(userId),
      ...filter,
    });

    return bookmarks.map(BookmarkResponseDto.from);
  }

  async create(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    dto: CreateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    assertKnowledgeScope('Link', dto.scope, dto.projectId, role);
    this.assertUrl(dto.url);

    const bookmark = await this.bookmarks.create({
      workspaceId,
      authorId: userId,
      name: dto.name,
      folder: dto.folder,
      url: dto.url,
      scope: dto.scope,
      ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
    });

    return BookmarkResponseDto.from(bookmark);
  }

  async update(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    id: string,
    dto: UpdateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    const current = await this.requireWritable(workspaceId, userId, role, id);

    const scope = dto.scope ?? current.scope;
    const projectId = dto.projectId === undefined ? current.projectId : dto.projectId;

    assertKnowledgeScope('Link', scope, projectId, role);

    if (dto.url !== undefined) {
      this.assertUrl(dto.url);
    }

    return BookmarkResponseDto.from(
      await this.bookmarks.update(id, {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.folder === undefined ? {} : { folder: dto.folder }),
        ...(dto.url === undefined ? {} : { url: dto.url }),
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
    const bookmark = await this.requireWritable(workspaceId, userId, role, id);

    await this.bookmarks.delete(bookmark.id);
  }

  private assertUrl(url: string): void {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(
        'Informe um endereço que comece com http:// ou https://.',
      );
    }

    if (!ACCEPTED_PROTOCOLS.includes(parsed.protocol)) {
      throw new BadRequestException(
        'Informe um endereço que comece com http:// ou https://.',
      );
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
  ): Promise<Bookmark> {
    const bookmark = await this.bookmarks.findById(id);

    if (!bookmark || bookmark.workspaceId !== workspaceId) {
      throw new NotFoundException('Link não encontrado.');
    }

    if (bookmark.scope === 'PRIVATE' && bookmark.authorId !== userId) {
      throw new NotFoundException('Link não encontrado.');
    }

    if (bookmark.scope === 'PROJECT') {
      const visible = await this.visibleProjectIds(userId);

      if (!bookmark.projectId || !visible.includes(bookmark.projectId)) {
        throw new NotFoundException('Link não encontrado.');
      }
    }

    return bookmark;
  }

  private async requireWritable(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    id: string,
  ): Promise<Bookmark> {
    const bookmark = await this.requireReadable(workspaceId, userId, id);

    if (bookmark.scope === 'WORKSPACE' && !role.atLeast(WorkspaceRole.ADMIN)) {
      throw new ForbiddenException('Só administradores gerenciam links do workspace.');
    }

    return bookmark;
  }
}
