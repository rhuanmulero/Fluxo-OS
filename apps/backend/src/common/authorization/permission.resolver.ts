import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY,
  WorkspaceRepository,
} from '../../modules/workspace/workspace.repository.interface';
import { WorkspaceRole } from './workspace-role';

@Injectable()
export class PermissionResolver {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
  ) {}

  async roleIn(workspaceId: string, userId: string): Promise<WorkspaceRole> {
    const membership = await this.workspaces.findMembership(workspaceId, userId);

    if (!membership) {
      throw new NotFoundException('Workspace não encontrado.');
    }

    if (membership.deactivatedAt !== null) {
      throw new ForbiddenException('Seu acesso a este workspace foi desligado.');
    }

    return WorkspaceRole.from(membership.role);
  }

  async assertAtLeast(
    workspaceId: string,
    userId: string,
    minimum: WorkspaceRole,
  ): Promise<WorkspaceRole> {
    const role = await this.roleIn(workspaceId, userId);

    if (!role.atLeast(minimum)) {
      throw new ForbiddenException('Seu papel não permite esta ação.');
    }

    return role;
  }
}
