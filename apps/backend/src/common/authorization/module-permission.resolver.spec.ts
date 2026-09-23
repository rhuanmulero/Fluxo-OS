import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Project, ProjectMember, ProjectModuleSetting } from '@prisma/client';
import { Action } from './action';
import { ModulePermissionResolver } from './module-permission.resolver';
import { PermissionResolver } from './permission.resolver';
import { GovernanceMode, ProjectModule } from './project-module';
import { WorkspaceRole } from './workspace-role';
import { ProjectRepository } from '../../modules/project/project.repository.interface';

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  name: 'API',
  description: null,
  color: null,
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function permissionsReturning(role: WorkspaceRole): PermissionResolver {
  return { roleIn: () => Promise.resolve(role) } as unknown as PermissionResolver;
}

function projectsWith(options: {
  found?: Project | null;
  member?: ProjectMember | null;
  setting?: ProjectModuleSetting | null;
}): ProjectRepository {
  return {
    findById: () => Promise.resolve(options.found === undefined ? project : options.found),
    findMembership: () => Promise.resolve(options.member ?? null),
    findModuleSetting: () => Promise.resolve(options.setting ?? null),
  } as unknown as ProjectRepository;
}

const membership: ProjectMember = {
  id: 'pm1',
  projectId: 'p1',
  userId: 'u1',
  addedAt: new Date(),
};

function settingOf(governance: GovernanceMode): ProjectModuleSetting {
  return {
    id: 's1',
    projectId: 'p1',
    module: ProjectModule.TASKS,
    governance,
    updatedAt: new Date(),
  };
}

describe('ModulePermissionResolver', () => {
  it('libera MEMBER do projeto sob microgerenciamento', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.MEMBER),
      projectsWith({ member: membership, setting: settingOf(GovernanceMode.MICROMANAGEMENT) }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.DELETE),
    ).resolves.toBeUndefined();
  });

  it('impede MEMBER de excluir sob gerenciamento hierárquico', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.MEMBER),
      projectsWith({ member: membership, setting: settingOf(GovernanceMode.HIERARCHICAL) }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.DELETE),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deixa MEMBER atualizar sob gerenciamento hierárquico', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.MEMBER),
      projectsWith({ member: membership, setting: settingOf(GovernanceMode.HIERARCHICAL) }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.UPDATE),
    ).resolves.toBeUndefined();
  });

  it('esconde o projeto de um ADMIN que não participa dele', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.ADMIN),
      projectsWith({ member: null, setting: settingOf(GovernanceMode.MICROMANAGEMENT) }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.READ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('dá alcance total ao SUPERADMIN mesmo sem ser membro do projeto', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.SUPERADMIN),
      projectsWith({ member: null, setting: settingOf(GovernanceMode.HIERARCHICAL) }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.DELETE),
    ).resolves.toBeUndefined();
  });

  it('usa o paradigma fixo quando o módulo não é configurável', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.MEMBER),
      projectsWith({ member: membership, setting: null }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.NOTES, Action.DELETE),
    ).resolves.toBeUndefined();
  });

  it('cai no padrão quando o módulo é configurável mas não tem configuração', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.MEMBER),
      projectsWith({ member: membership, setting: null }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.CREATE),
    ).resolves.toBeUndefined();
  });

  it('recusa projeto inexistente', async () => {
    const resolver = new ModulePermissionResolver(
      permissionsReturning(WorkspaceRole.OWNER),
      projectsWith({ found: null }),
    );

    await expect(
      resolver.assert('p1', 'u1', ProjectModule.TASKS, Action.READ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
