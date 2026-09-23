import { Injectable } from '@nestjs/common';
import { Workspace, WorkspaceMember } from '@prisma/client';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';
import { PrismaService } from '../../common/database/prisma.service';
import {
  MemberWithUser,
  NewWorkspace,
  WorkspaceChanges,
  WorkspaceRepository,
} from './workspace.repository.interface';

@Injectable()
export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithOwner(data: NewWorkspace): Promise<Workspace> {
    return this.prisma.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        members: { create: { userId: data.ownerId, role: 'OWNER' } },
      },
    });
  }

  findManyForUser(userId: string): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId, deactivatedAt: null } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { slug } });
  }

  update(id: string, changes: WorkspaceChanges): Promise<Workspace> {
    return this.prisma.workspace.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { id } });
  }

  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  findActiveMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deactivatedAt: null },
    });
  }

  setMemberActive(
    workspaceId: string,
    userId: string,
    active: boolean,
  ): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { deactivatedAt: active ? null : new Date() },
    });
  }

  async areMembers(workspaceId: string, userIds: string[]): Promise<boolean> {
    const found = await this.prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: userIds }, deactivatedAt: null },
    });

    return found === userIds.length;
  }

  listMembers(workspaceId: string): Promise<MemberWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, profile: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRoleName,
  ): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, role },
      update: { role },
    });
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  countByRole(workspaceId: string, role: WorkspaceRoleName): Promise<number> {
    return this.prisma.workspaceMember.count({ where: { workspaceId, role } });
  }
}
