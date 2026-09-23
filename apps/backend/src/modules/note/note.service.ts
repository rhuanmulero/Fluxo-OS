import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Note } from '@prisma/client';
import { PROJECT_REPOSITORY, ProjectRepository } from '../project/project.repository.interface';
import { CreateNoteDto } from './dto/create-note.dto';
import { NoteFilterDto } from './dto/note-filter.dto';
import { NoteResponseDto } from './dto/note-response.dto';
import { SetNoteVisibilityDto } from './dto/set-note-visibility.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NOTE_REPOSITORY, NoteRepository } from './note.repository.interface';

const MIN_BODY = 1;
const MAX_BODY = 7000;

@Injectable()
export class NoteService {
  constructor(
    @Inject(NOTE_REPOSITORY) private readonly notes: NoteRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filter: NoteFilterDto = {},
  ): Promise<NoteResponseDto[]> {
    const memberships = await this.projects.listMembershipsOf(userId);

    const notes = await this.notes.findVisible({
      workspaceId,
      authorId: userId,
      visibleProjectIds: memberships.map((membership) => membership.projectId),
      ...filter,
    });

    return notes.map(NoteResponseDto.from);
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    this.assertBody(dto.body);
    await this.assertProjectMembership(userId, dto.projectId);

    const note = await this.notes.create({
      workspaceId,
      authorId: userId,
      projectId: dto.projectId,
      title: dto.title,
      body: dto.body,
      color: dto.color,
      isPinned: dto.isPinned ?? false,
    });

    return NoteResponseDto.from(note);
  }

  async update(
    workspaceId: string,
    userId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    await this.requireOwn(workspaceId, userId, noteId);

    if (dto.body !== undefined) {
      this.assertBody(dto.body);
    }

    await this.assertProjectMembership(userId, dto.projectId);

    return NoteResponseDto.from(await this.notes.update(noteId, dto));
  }

  async remove(workspaceId: string, userId: string, noteId: string): Promise<void> {
    await this.requireOwn(workspaceId, userId, noteId);
    await this.notes.delete(noteId);
  }

  async setVisibility(
    workspaceId: string,
    userId: string,
    noteId: string,
    dto: SetNoteVisibilityDto,
  ): Promise<NoteResponseDto> {
    const note = await this.requireOwn(workspaceId, userId, noteId);

    if (dto.visibility === 'PROJECT' && !note.projectId) {
      throw new BadRequestException(
        'Vincule a nota a um projeto antes de publicá-la para a equipe.',
      );
    }

    return NoteResponseDto.from(
      await this.notes.update(noteId, { visibility: dto.visibility }),
    );
  }

  private assertBody(body: string): void {
    if (body.length < MIN_BODY || body.length > MAX_BODY) {
      throw new BadRequestException(
        `A nota deve ter entre ${MIN_BODY} e ${MAX_BODY} caracteres.`,
      );
    }
  }

  private async assertProjectMembership(
    userId: string,
    projectId: string | undefined,
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
    noteId: string,
  ): Promise<Note> {
    const note = await this.notes.findById(noteId);

    if (!note || note.workspaceId !== workspaceId) {
      throw new NotFoundException('Nota não encontrada.');
    }

    if (note.authorId !== userId) {
      throw new ForbiddenException('Esta nota pertence a outro usuário.');
    }

    return note;
  }
}
