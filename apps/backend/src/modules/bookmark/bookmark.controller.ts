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
import { PermissionResolver } from '../../common/authorization/permission.resolver';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { BookmarkFilterDto } from './dto/bookmark-filter.dto';
import { BookmarkResponseDto } from './dto/bookmark-response.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import { BookmarkService } from './bookmark.service';

@Controller('workspaces/:workspaceId/bookmarks')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class BookmarkController {
  constructor(
    private readonly bookmarks: BookmarkService,
    private readonly permissions: PermissionResolver,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: BookmarkFilterDto,
  ): Promise<BookmarkResponseDto[]> {
    return this.bookmarks.list(workspaceId, user.id, filter);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.bookmarks.create(workspaceId, user.id, role, dto);
  }

  @Patch(':bookmarkId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('bookmarkId') bookmarkId: string,
    @Body() dto: UpdateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.bookmarks.update(workspaceId, user.id, role, bookmarkId, dto);
  }

  @Delete(':bookmarkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('bookmarkId') bookmarkId: string,
  ): Promise<void> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    await this.bookmarks.remove(workspaceId, user.id, role, bookmarkId);
  }
}
