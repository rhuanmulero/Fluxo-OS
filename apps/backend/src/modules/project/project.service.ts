import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project, ProjectModuleSetting } from '@prisma/client';
import { ModuleGovernance } from '../../common/authorization/module-governance';
import { GovernanceMode, ProjectModule } from '../../common/authorization/project-module';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { CreateProjectDto } from './dto/create-project.dto';
import { ModuleSettingResponseDto } from './dto/module-setting-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  DefaultColumn,
  PROJECT_REPOSITORY,
  ProjectMemberWithUser,
  ProjectRepository,
} from './project.repository.interface';

export const DEFAULT_COLUMNS: DefaultColumn[] = [
  { name: 'A Fazer', position: 0, color: '#60a5fa', status: 'TODO' },
  { name: 'Em Progresso', position: 1, color: '#f59e0b', status: 'IN_PROGRESS' },
  { name: 'Concluída', position: 2, color: '#10b981', status: 'DONE' },
];

@Injectable()
export class ProjectService {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const modules = ModuleGovernance.configurableModules().map((module) => ({
      module,
      governance: ModuleGovernance.defaultFor(module),
    }));

    const project = await this.projects.createWithDefaults(
      { workspaceId, createdById: userId, ...dto },
      DEFAULT_COLUMNS,
      modules,
    );

    return ProjectResponseDto.from(project);
  }

  async listFor(workspaceId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.projects.findManyByWorkspace(workspaceId);

    return projects.map(ProjectResponseDto.from);
  }

  async find(projectId: string): Promise<ProjectResponseDto> {
    return ProjectResponseDto.from(await this.require(projectId));
  }

  async rename(projectId: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    await this.require(projectId);

    return ProjectResponseDto.from(await this.projects.update(projectId, dto));
  }

  async remove(projectId: string, actorRole: WorkspaceRole): Promise<void> {
    if (!actorRole.atLeast(WorkspaceRole.SUPERADMIN)) {
      throw new ForbiddenException('Apenas superadministradores podem excluir projetos.');
    }

    await this.require(projectId);
    await this.projects.delete(projectId);
  }

  members(projectId: string): Promise<ProjectMemberWithUser[]> {
    return this.projects.listMembers(projectId);
  }

  async addMember(projectId: string, userId: string): Promise<void> {
    await this.require(projectId);
    await this.projects.addMember(projectId, userId);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.require(projectId);
    await this.projects.removeMember(projectId, userId);
  }

  async moduleSettings(projectId: string): Promise<ModuleSettingResponseDto[]> {
    const saved = await this.projects.listModuleSettings(projectId);
    const byModule = new Map(saved.map((setting) => [setting.module, setting.governance]));

    return Object.values(ProjectModule).map((module) => {
      const configurable = ModuleGovernance.isConfigurable(module);
      const governance = configurable
        ? (byModule.get(module) ?? ModuleGovernance.defaultFor(module))
        : ModuleGovernance.fixedFor(module);

      return new ModuleSettingResponseDto(module, governance, configurable);
    });
  }

  async setGovernance(
    projectId: string,
    module: ProjectModule,
    governance: GovernanceMode,
  ): Promise<ProjectModuleSetting> {
    if (!ModuleGovernance.isConfigurable(module)) {
      throw new BadRequestException(
        `O módulo ${module} tem regra de negócio fixa e não pode ser reconfigurado.`,
      );
    }

    await this.require(projectId);

    return this.projects.setModuleGovernance(projectId, module, governance);
  }

  private async require(projectId: string): Promise<Project> {
    const project = await this.projects.findById(projectId);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    return project;
  }
}
