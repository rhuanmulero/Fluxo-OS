import { Project, ProjectMember, ProjectModuleSetting } from '@prisma/client';
import { GovernanceMode, ProjectModule } from '../../common/authorization/project-module';

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');

export interface NewProject {
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  createdById: string;
}

export interface ProjectChanges {
  name?: string;
  description?: string;
  color?: string;
}

export interface DefaultColumn {
  name: string;
  position: number;
  color: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
}

export type ProjectMemberWithUser = ProjectMember & {
  user: { id: string; name: string; email: string };
};

export interface ProjectRepository {
  createWithDefaults(
    data: NewProject,
    columns: DefaultColumn[],
    modules: Array<{ module: ProjectModule; governance: GovernanceMode }>,
  ): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findManyByWorkspace(workspaceId: string): Promise<Project[]>;
  update(id: string, changes: ProjectChanges): Promise<Project>;
  delete(id: string): Promise<void>;
  findMembership(projectId: string, userId: string): Promise<ProjectMember | null>;
  listMembers(projectId: string): Promise<ProjectMemberWithUser[]>;
  listMembershipsOf(userId: string): Promise<ProjectMember[]>;
  addMember(projectId: string, userId: string): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  findModuleSetting(
    projectId: string,
    module: ProjectModule,
  ): Promise<ProjectModuleSetting | null>;
  listModuleSettings(projectId: string): Promise<ProjectModuleSetting[]>;
  setModuleGovernance(
    projectId: string,
    module: ProjectModule,
    governance: GovernanceMode,
  ): Promise<ProjectModuleSetting>;
}
