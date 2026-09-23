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
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { ReviewSnippetDto } from './dto/review-snippet.dto';
import { SnippetFilterDto } from './dto/snippet-filter.dto';
import { SnippetResponseDto } from './dto/snippet-response.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { SnippetService } from './snippet.service';

@Controller('workspaces/:workspaceId/snippets')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class SnippetController {
  constructor(
    private readonly snippets: SnippetService,
    private readonly permissions: PermissionResolver,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: SnippetFilterDto,
  ): Promise<SnippetResponseDto[]> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.snippets.list(workspaceId, user.id, role, filter);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateSnippetDto,
  ): Promise<SnippetResponseDto> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.snippets.create(workspaceId, user.id, role, dto);
  }

  @Post(':snippetId/publish-request')
  requestPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
  ): Promise<SnippetResponseDto> {
    return this.snippets.requestPublication(workspaceId, user.id, snippetId);
  }

  @Post(':snippetId/review')
  @RequireWorkspaceRole('ADMIN')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
    @Body() dto: ReviewSnippetDto,
  ): Promise<SnippetResponseDto> {
    return this.snippets.review(workspaceId, user.id, snippetId, dto);
  }

  @Patch(':snippetId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
    @Body() dto: UpdateSnippetDto,
  ): Promise<SnippetResponseDto> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.snippets.update(workspaceId, user.id, role, snippetId, dto);
  }

  @Delete(':snippetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
  ): Promise<void> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.snippets.remove(workspaceId, user.id, role, snippetId);
  }
}
