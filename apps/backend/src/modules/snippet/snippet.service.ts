import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Snippet } from '@prisma/client';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { ReviewSnippetDto } from './dto/review-snippet.dto';
import { SnippetFilterDto } from './dto/snippet-filter.dto';
import { SnippetResponseDto } from './dto/snippet-response.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { SNIPPET_REPOSITORY, SnippetRepository } from './snippet.repository.interface';

@Injectable()
export class SnippetService {
  constructor(@Inject(SNIPPET_REPOSITORY) private readonly snippets: SnippetRepository) {}

  async list(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    filter: SnippetFilterDto,
  ): Promise<SnippetResponseDto[]> {
    const snippets = await this.snippets.findVisible({
      workspaceId,
      authorId: userId,
      includePending: role.atLeast(WorkspaceRole.ADMIN),
      ...filter,
    });

    return snippets.map(SnippetResponseDto.from);
  }

  async create(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    dto: CreateSnippetDto,
  ): Promise<SnippetResponseDto> {
    const moderated = role.atLeast(WorkspaceRole.ADMIN);

    const snippet = await this.snippets.create({
      workspaceId,
      authorId: userId,
      projectId: dto.projectId,
      name: dto.name,
      folder: dto.folder,
      language: dto.language,
      code: dto.code,
      visibility: moderated ? 'PUBLIC' : 'PRIVATE',
      moderationStatus: moderated ? 'APPROVED' : 'NOT_REQUESTED',
    });

    return SnippetResponseDto.from(snippet);
  }

  async update(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    snippetId: string,
    dto: UpdateSnippetDto,
  ): Promise<SnippetResponseDto> {
    await this.requireWritable(workspaceId, userId, role, snippetId);

    return SnippetResponseDto.from(await this.snippets.update(snippetId, dto));
  }

  async remove(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    snippetId: string,
  ): Promise<void> {
    await this.requireWritable(workspaceId, userId, role, snippetId);
    await this.snippets.delete(snippetId);
  }

  async requestPublication(
    workspaceId: string,
    userId: string,
    snippetId: string,
  ): Promise<SnippetResponseDto> {
    const snippet = await this.require(workspaceId, snippetId);

    if (snippet.authorId !== userId) {
      throw new ForbiddenException('Apenas o autor pode pedir a publicação.');
    }

    if (snippet.visibility === 'PUBLIC') {
      throw new BadRequestException('Este snippet já é público.');
    }

    return SnippetResponseDto.from(
      await this.snippets.update(snippetId, { moderationStatus: 'PENDING' }),
    );
  }

  async review(
    workspaceId: string,
    reviewerId: string,
    snippetId: string,
    dto: ReviewSnippetDto,
  ): Promise<SnippetResponseDto> {
    const snippet = await this.require(workspaceId, snippetId);

    if (snippet.moderationStatus !== 'PENDING') {
      throw new BadRequestException('Este snippet não está aguardando moderação.');
    }

    const reviewed = await this.snippets.update(snippetId, {
      visibility: dto.approve ? 'PUBLIC' : 'PRIVATE',
      moderationStatus: dto.approve ? 'APPROVED' : 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    });

    return SnippetResponseDto.from(reviewed);
  }

  private async require(workspaceId: string, snippetId: string): Promise<Snippet> {
    const snippet = await this.snippets.findById(snippetId);

    if (!snippet || snippet.workspaceId !== workspaceId) {
      throw new NotFoundException('Snippet não encontrado.');
    }

    return snippet;
  }

  private async requireWritable(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    snippetId: string,
  ): Promise<Snippet> {
    const snippet = await this.require(workspaceId, snippetId);

    if (snippet.authorId !== userId && !role.atLeast(WorkspaceRole.ADMIN)) {
      throw new ForbiddenException('Este snippet pertence a outro usuário.');
    }

    return snippet;
  }
}
