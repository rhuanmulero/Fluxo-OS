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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { SetMemberActiveDto } from './dto/set-member-active.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(AuthGuard, PermissionGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceResponseDto[]> {
    return this.workspaces.listFor(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaces.create(user.id, dto);
  }

  @Get(':id')
  find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaces.findFor(user.id, id);
  }

  @Patch(':id')
  @RequireWorkspaceRole('SUPERADMIN')
  rename(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaces.rename(id, dto);
  }

  @Delete(':id')
  @RequireWorkspaceRole('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.workspaces.remove(id);
  }

  @Get(':id/members')
  @RequireWorkspaceRole('MEMBER')
  members(@Param('id') id: string): Promise<MemberResponseDto[]> {
    return this.workspaces.members(id);
  }

  @Patch(':id/members/:userId')
  @RequireWorkspaceRole('SUPERADMIN')
  changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeMemberRoleDto,
  ): Promise<MemberResponseDto> {
    return this.workspaces.changeRole(id, user.id, userId, dto.role);
  }

  @Patch(':id/members/:userId/status')
  @RequireWorkspaceRole('SUPERADMIN')
  setMemberActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: SetMemberActiveDto,
  ): Promise<MemberResponseDto> {
    return this.workspaces.deactivateMember(id, user.id, userId, dto.active);
  }

  @Delete(':id/members/:userId')
  @RequireWorkspaceRole('SUPERADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.workspaces.removeMember(id, user.id, userId);
  }
}
