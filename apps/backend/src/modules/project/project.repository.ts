import { Injectable } from '@nestjs/common';
import { Project, ProjectMember, ProjectModuleSetting } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { GovernanceMode, ProjectModule } from '../../common/authorization/project-module';
import {
  DefaultColumn,
  NewProject,
  ProjectChanges,
  ProjectMemberWithUser,
  ProjectRepository,
} from './project.repository.interface';

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithDefaults(
    data: NewProject,
    columns: DefaultColumn[],
    modules: Array<{ module: ProjectModule; governance: GovernanceMode }>,
  ): Promise<Project> {
    return this.prisma.project.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description,
        color: data.color,
        createdById: data.createdById,
        members: { create: { userId: data.createdById } },
        columns: { create: columns },
        moduleSettings: { create: modules },
      },
    });
  }

  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  findManyByWorkspace(workspaceId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  update(id: string, changes: ProjectChanges): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  findMembership(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { addedAt: 'asc' },
    });
  }

  listMembershipsOf(userId: string): Promise<ProjectMember[]> {
    return this.prisma.projectMember.findMany({ where: { userId } });
  }

  addMember(projectId: string, userId: string): Promise<ProjectMember> {
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  findModuleSetting(
    projectId: string,
    module: ProjectModule,
  ): Promise<ProjectModuleSetting | null> {
    return this.prisma.projectModuleSetting.findUnique({
      where: { projectId_module: { projectId, module } },
    });
  }

  listModuleSettings(projectId: string): Promise<ProjectModuleSetting[]> {
    return this.prisma.projectModuleSetting.findMany({ where: { projectId } });
  }

  setModuleGovernance(
    projectId: string,
    module: ProjectModule,
    governance: GovernanceMode,
  ): Promise<ProjectModuleSetting> {
    return this.prisma.projectModuleSetting.upsert({
      where: { projectId_module: { projectId, module } },
      create: { projectId, module, governance },
      update: { governance },
    });
  }
}
