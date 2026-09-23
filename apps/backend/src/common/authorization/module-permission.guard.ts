import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ModulePermissionResolver } from './module-permission.resolver';
import { REQUIRED_PERMISSION, RequiredPermission } from './require-permission.decorator';

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: ModulePermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const routeParam = request.params.projectId;
    const projectId = typeof routeParam === 'string' ? routeParam : undefined;

    if (!projectId) {
      throw new BadRequestException('Projeto não informado na rota.');
    }

    if (!request.user) {
      return false;
    }

    await this.permissions.assert(projectId, request.user.id, required.module, required.action);

    return true;
  }
}
