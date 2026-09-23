import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectModuleSetting } from '@prisma/client';
import { Action } from '../../common/authorization/action';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { ModulePermissionGuard } from '../../common/authorization/module-permission.guard';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { PermissionResolver } from '../../common/authorization/permission.resolver';
import { ProjectModule as ProjectModuleName } from '../../common/authorization/project-module';
import { RequirePermission } from '../../common/authorization/require-permission.decorator';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ModuleSettingResponseDto } from './dto/module-setting-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { SetGovernanceDto } from './dto/set-governance.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMemberWithUser } from './project.repository.interface';
import { ProjectService } from './project.service';

@Controller()
@UseGuards(AuthGuard, PermissionGuard, ModulePermissionGuard)
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly permissions: PermissionResolver,
  ) {}

  @Get('workspaces/:workspaceId/projects')
  @RequireWorkspaceRole('MEMBER')
  list(@Param('workspaceId') workspaceId: string): Promise<ProjectResponseDto[]> {
    return this.projects.listFor(workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  @RequireWorkspaceRole('SUPERADMIN')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projects.create(workspaceId, user.id, dto);
  }

  @Get('projects/:projectId')
  @RequirePermission(ProjectModuleName.TASKS, Action.READ)
  find(@Param('projectId') projectId: string): Promise<ProjectResponseDto> {
    return this.projects.find(projectId);
  }

  @Patch('projects/:projectId')
  @RequirePermission(ProjectModuleName.TASKS, Action.UPDATE)
  rename(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projects.rename(projectId, dto);
  }

  @Delete('projects/:projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ): Promise<void> {
    const project = await this.projects.find(projectId);
    const role = await this.permissions.roleIn(project.workspaceId, user.id);

    return this.projects.remove(projectId, role);
  }

  @Get('projects/:projectId/members')
  @RequirePermission(ProjectModuleName.TASKS, Action.READ)
  members(@Param('projectId') projectId: string): Promise<ProjectMemberWithUser[]> {
    return this.projects.members(projectId);
  }

  @Post('projects/:projectId/members')
  @RequirePermission(ProjectModuleName.TASKS, Action.CREATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<void> {
    return this.projects.addMember(projectId, dto.userId);
  }

  @Delete('projects/:projectId/members/:userId')
  @RequirePermission(ProjectModuleName.TASKS, Action.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.projects.removeMember(projectId, userId);
  }

  @Get('projects/:projectId/module-settings')
  @RequirePermission(ProjectModuleName.TASKS, Action.READ)
  moduleSettings(@Param('projectId') projectId: string): Promise<ModuleSettingResponseDto[]> {
    return this.projects.moduleSettings(projectId);
  }

  @Patch('projects/:projectId/module-settings/:module')
  @RequirePermission(ProjectModuleName.TASKS, Action.UPDATE)
  setGovernance(
    @Param('projectId') projectId: string,
    @Param('module', new ParseEnumPipe(ProjectModuleName)) module: ProjectModuleName,
    @Body() dto: SetGovernanceDto,
  ): Promise<ProjectModuleSetting> {
    return this.projects.setGovernance(projectId, module, dto.governance);
  }
}
