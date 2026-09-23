import { UserProfile, Workspace, WorkspaceMember } from '@prisma/client';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';

export const WORKSPACE_REPOSITORY = Symbol('WorkspaceRepository');

export interface NewWorkspace {
  name: string;
  slug: string;
  ownerId: string;
}

export interface WorkspaceChanges {
  name?: string;
}

export type MemberWithUser = WorkspaceMember & {
  user: { id: string; name: string; email: string; profile: UserProfile | null };
};

export interface WorkspaceRepository {
  createWithOwner(data: NewWorkspace): Promise<Workspace>;
  findManyForUser(userId: string): Promise<Workspace[]>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  update(id: string, changes: WorkspaceChanges): Promise<Workspace>;
  delete(id: string): Promise<void>;
  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findActiveMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  setMemberActive(
    workspaceId: string,
    userId: string,
    active: boolean,
  ): Promise<WorkspaceMember>;
  areMembers(workspaceId: string, userIds: string[]): Promise<boolean>;
  listMembers(workspaceId: string): Promise<MemberWithUser[]>;
  upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRoleName,
  ): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  countByRole(workspaceId: string, role: WorkspaceRoleName): Promise<number>;
}

type AssertSame<A extends B, B extends C, C = A> = true;

export type RoleNamesMatch = AssertSame<
  WorkspaceRoleName,
  import('@prisma/client').WorkspaceRoleName
>;
