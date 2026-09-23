import { WorkspaceInvite } from '@prisma/client';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';

export const INVITE_REPOSITORY = Symbol('InviteRepository');

export interface NewInvite {
  workspaceId: string;
  code: string;
  role: WorkspaceRoleName;
  email?: string;
  expiresAt: Date;
  createdById: string;
}

export interface InviteRepository {
  create(data: NewInvite): Promise<WorkspaceInvite>;
  findByCode(code: string): Promise<WorkspaceInvite | null>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceInvite[]>;
  markUsed(id: string): Promise<WorkspaceInvite>;
  delete(id: string): Promise<void>;
}
