import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../../modules/project/project.repository.interface';
import { Action } from './action';
import { ModuleGovernance } from './module-governance';
import { PermissionResolver } from './permission.resolver';
import { GovernanceMode, ProjectModule } from './project-module';
import { WorkspaceRole } from './workspace-role';

@Injectable()
export class ModulePermissionResolver {
  constructor(
    private readonly permissions: PermissionResolver,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
  ) {}

  async assert(
    projectId: string,
    userId: string,
    module: ProjectModule,
    action: Action,
  ): Promise<void> {
    const project = await this.projects.findById(projectId);

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    const role = await this.permissions.roleIn(project.workspaceId, userId);

    if (!role.atLeast(WorkspaceRole.SUPERADMIN)) {
      const membership = await this.projects.findMembership(projectId, userId);

      if (!membership) {
        throw new NotFoundException('Projeto não encontrado.');
      }
    }

    const governance = await this.governanceOf(projectId, module);

    if (!ModuleGovernance.policyFor(governance).allows(role, action)) {
      throw new ForbiddenException('A regra de negócio deste módulo não permite esta ação.');
    }
  }

  private async governanceOf(
    projectId: string,
    module: ProjectModule,
  ): Promise<GovernanceMode> {
    if (!ModuleGovernance.isConfigurable(module)) {
      return ModuleGovernance.fixedFor(module);
    }

    const setting = await this.projects.findModuleSetting(projectId, module);

    return setting
      ? (setting.governance as GovernanceMode)
      : ModuleGovernance.defaultFor(module);
  }
}
