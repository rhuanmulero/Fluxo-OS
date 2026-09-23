import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { CreateNoteDto } from './dto/create-note.dto';
import { NoteFilterDto } from './dto/note-filter.dto';
import { NoteResponseDto } from './dto/note-response.dto';
import { SetNoteVisibilityDto } from './dto/set-note-visibility.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteService } from './note.service';

@Controller('workspaces/:workspaceId/notes')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: NoteFilterDto,
  ): Promise<NoteResponseDto[]> {
    return this.notes.list(workspaceId, user.id, filter);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notes.create(workspaceId, user.id, dto);
  }

  @Patch(':noteId/visibility')
  setVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Body() dto: SetNoteVisibilityDto,
  ): Promise<NoteResponseDto> {
    return this.notes.setVisibility(workspaceId, user.id, noteId, dto);
  }

  @Patch(':noteId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notes.update(workspaceId, user.id, noteId, dto);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    return this.notes.remove(workspaceId, user.id, noteId);
  }
}
