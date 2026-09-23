import { SetMetadata } from '@nestjs/common';
import { WorkspaceRoleName } from './workspace-role';

export const REQUIRED_WORKSPACE_ROLE = 'requiredWorkspaceRole';

export const RequireWorkspaceRole = (role: WorkspaceRoleName) =>
  SetMetadata(REQUIRED_WORKSPACE_ROLE, role);
