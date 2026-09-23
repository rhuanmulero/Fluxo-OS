import { SetMetadata } from '@nestjs/common';
import { Action } from './action';
import { ProjectModule } from './project-module';

export const REQUIRED_PERMISSION = 'requiredPermission';

export interface RequiredPermission {
  module: ProjectModule;
  action: Action;
}

export const RequirePermission = (module: ProjectModule, action: Action) =>
  SetMetadata<string, RequiredPermission>(REQUIRED_PERMISSION, { module, action });
