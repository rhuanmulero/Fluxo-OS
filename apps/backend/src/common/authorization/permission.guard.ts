import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionResolver } from './permission.resolver';
import { REQUIRED_WORKSPACE_ROLE } from './require-workspace-role.decorator';
import { WorkspaceRole, WorkspaceRoleName } from './workspace-role';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WorkspaceRoleName | undefined>(
      REQUIRED_WORKSPACE_ROLE,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const routeParam = request.params.workspaceId ?? request.params.id;
    const workspaceId = typeof routeParam === 'string' ? routeParam : undefined;

    if (!workspaceId) {
      throw new BadRequestException('Workspace não informado na rota.');
    }

    if (!request.user) {
      return false;
    }

    await this.permissions.assertAtLeast(
      workspaceId,
      request.user.id,
      WorkspaceRole.from(required),
    );

    return true;
  }
}
