import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Project, ProjectMember, ProjectModuleSetting } from '@prisma/client';
import { GovernanceMode, ProjectModule } from '../../common/authorization/project-module';
import { WorkspaceRole } from '../../common/authorization/workspace-role';
import { ProjectService } from './project.service';
import {
  DefaultColumn,
  NewProject,
  ProjectChanges,
  ProjectMemberWithUser,
  ProjectRepository,
} from './project.repository.interface';

class FakeProjectRepository implements ProjectRepository {
  projects: Project[] = [];
  members: ProjectMember[] = [];
  settings: ProjectModuleSetting[] = [];
  lastColumns: DefaultColumn[] = [];

  createWithDefaults(
    data: NewProject,
    columns: DefaultColumn[],
    modules: Array<{ module: ProjectModule; governance: GovernanceMode }>,
  ): Promise<Project> {
    const project: Project = {
      id: `p${this.projects.length + 1}`,
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.push(project);
    this.lastColumns = columns;
    this.members.push({
      id: `pm${this.members.length + 1}`,
      projectId: project.id,
      userId: data.createdById,
      addedAt: new Date(),
    });
    for (const entry of modules) {
      this.settings.push({
        id: `s${this.settings.length + 1}`,
        projectId: project.id,
        module: entry.module,
        governance: entry.governance,
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(project);
  }

  findById(id: string): Promise<Project | null> {
    return Promise.resolve(this.projects.find((p) => p.id === id) ?? null);
  }

  findManyByWorkspace(workspaceId: string): Promise<Project[]> {
    return Promise.resolve(this.projects.filter((p) => p.workspaceId === workspaceId));
  }

  update(id: string, changes: ProjectChanges): Promise<Project> {
    const project = this.projects.find((p) => p.id === id);
    if (!project) throw new Error('não encontrado');
    Object.assign(project, changes);
    return Promise.resolve(project);
  }

  delete(id: string): Promise<void> {
    this.projects = this.projects.filter((p) => p.id !== id);
    return Promise.resolve();
  }

  findMembership(projectId: string, userId: string): Promise<ProjectMember | null> {
    return Promise.resolve(
      this.members.find((m) => m.projectId === projectId && m.userId === userId) ?? null,
    );
  }

  listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return Promise.resolve(
      this.members
        .filter((m) => m.projectId === projectId)
        .map((m) => ({
          ...m,
          user: { id: m.userId, name: m.userId, email: `${m.userId}@t.local` },
        })),
    );
  }

  listMembershipsOf(userId: string): Promise<ProjectMember[]> {
    return Promise.resolve(this.members.filter((m) => m.userId === userId));
  }

  addMember(projectId: string, userId: string): Promise<ProjectMember> {
    const created: ProjectMember = {
      id: `pm${this.members.length + 1}`,
      projectId,
      userId,
      addedAt: new Date(),
    };
    this.members.push(created);
    return Promise.resolve(created);
  }

  removeMember(projectId: string, userId: string): Promise<void> {
    this.members = this.members.filter(
      (m) => !(m.projectId === projectId && m.userId === userId),
    );
    return Promise.resolve();
  }

  findModuleSetting(
    projectId: string,
    module: ProjectModule,
  ): Promise<ProjectModuleSetting | null> {
    return Promise.resolve(
      this.settings.find((s) => s.projectId === projectId && s.module === module) ?? null,
    );
  }

  listModuleSettings(projectId: string): Promise<ProjectModuleSetting[]> {
    return Promise.resolve(this.settings.filter((s) => s.projectId === projectId));
  }

  setModuleGovernance(
    projectId: string,
    module: ProjectModule,
    governance: GovernanceMode,
  ): Promise<ProjectModuleSetting> {
    const existing = this.settings.find(
      (s) => s.projectId === projectId && s.module === module,
    );
    if (existing) {
      existing.governance = governance;
      return Promise.resolve(existing);
    }
    const created: ProjectModuleSetting = {
      id: `s${this.settings.length + 1}`,
      projectId,
      module,
      governance,
      updatedAt: new Date(),
    };
    this.settings.push(created);
    return Promise.resolve(created);
  }
}

describe('ProjectService', () => {
  let repository: FakeProjectRepository;
  let service: ProjectService;

  beforeEach(() => {
    repository = new FakeProjectRepository();
    service = new ProjectService(repository);
  });

  it('cria o projeto com as três colunas padrão', async () => {
    await service.create('w1', 'u1', { name: 'API Backend' });

    expect(repository.lastColumns.map((c) => c.status)).toEqual([
      'TODO',
      'IN_PROGRESS',
      'DONE',
    ]);
    expect(repository.lastColumns.map((c) => c.name)).toEqual([
      'A Fazer',
      'Em Progresso',
      'Concluída',
    ]);
  });

  it('cria o projeto com o autor já como membro', async () => {
    const project = await service.create('w1', 'u1', { name: 'API Backend' });

    await expect(repository.findMembership(project.id, 'u1')).resolves.not.toBeNull();
  });

  it('cria configuração apenas para os módulos configuráveis', async () => {
    const project = await service.create('w1', 'u1', { name: 'API Backend' });
    const settings = await repository.listModuleSettings(project.id);

    expect(settings.map((s) => s.module).sort()).toEqual([
      'BOOKMARKS',
      'KANBAN',
      'ROADMAP',
      'TASKS',
      'VAULT',
    ]);

    const byModule = new Map(settings.map((s) => [s.module, s.governance]));

    expect(byModule.get(ProjectModule.TASKS)).toBe(GovernanceMode.MICROMANAGEMENT);
    expect(byModule.get(ProjectModule.KANBAN)).toBe(GovernanceMode.MICROMANAGEMENT);
    expect(byModule.get(ProjectModule.ROADMAP)).toBe(GovernanceMode.HIERARCHICAL);
  });

  it('troca o paradigma de um módulo configurável', async () => {
    const project = await service.create('w1', 'u1', { name: 'API Backend' });

    await service.setGovernance(project.id, ProjectModule.TASKS, GovernanceMode.HIERARCHICAL);

    const setting = await repository.findModuleSetting(project.id, ProjectModule.TASKS);
    expect(setting?.governance).toBe(GovernanceMode.HIERARCHICAL);
  });

  it('recusa trocar o paradigma de um módulo de regra fixa', async () => {
    const project = await service.create('w1', 'u1', { name: 'API Backend' });

    await expect(
      service.setGovernance(project.id, ProjectModule.NOTES, GovernanceMode.HIERARCHICAL),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('impede um MEMBER de excluir o projeto', async () => {
    const project = await service.create('w1', 'u1', { name: 'API Backend' });

    await expect(service.remove(project.id, WorkspaceRole.MEMBER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('recusa projeto inexistente', async () => {
    await expect(service.find('p999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista todos os módulos, e não só os configuráveis', async () => {
    const project = await service.create('w1', 'u1', { name: 'Fluxo' });

    const settings = await service.moduleSettings(project.id);
    const names = settings.map((setting) => setting.module).sort();

    expect(names).toEqual([
      'AGENDA',
      'BOOKMARKS',
      'HABITS',
      'KANBAN',
      'NOTES',
      'POMODORO',
      'ROADMAP',
      'SNIPPETS',
      'TASKS',
      'VAULT',
    ]);
  });

  it('marca como configurável apenas o que ModuleGovernance permite reconfigurar', async () => {
    const project = await service.create('w1', 'u1', { name: 'Fluxo' });

    const settings = await service.moduleSettings(project.id);
    const configurable = settings.filter((setting) => setting.configurable);

    expect(configurable.map((setting) => setting.module).sort()).toEqual([
      'BOOKMARKS',
      'KANBAN',
      'ROADMAP',
      'TASKS',
      'VAULT',
    ]);
  });

  it('devolve o paradigma fixo dos módulos que não são configuráveis', async () => {
    const project = await service.create('w1', 'u1', { name: 'Fluxo' });

    const settings = await service.moduleSettings(project.id);
    const notes = settings.find((setting) => setting.module === 'NOTES');

    expect(notes?.governance).toBe('MICROMANAGEMENT');
    expect(notes?.configurable).toBe(false);
  });

  it('reflete o paradigma gravado depois de reconfigurar um módulo', async () => {
    const project = await service.create('w1', 'u1', { name: 'Fluxo' });

    await service.setGovernance(project.id, ProjectModule.TASKS, GovernanceMode.HIERARCHICAL);

    const settings = await service.moduleSettings(project.id);
    const tasks = settings.find((setting) => setting.module === 'TASKS');

    expect(tasks?.governance).toBe('HIERARCHICAL');
  });
});
