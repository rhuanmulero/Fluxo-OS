import { Action } from './action';
import { GovernanceMode, ProjectModule } from './project-module';
import { HierarchicalPolicy, MicromanagementPolicy } from './governance-policy';
import { ModuleGovernance } from './module-governance';
import { WorkspaceRole } from './workspace-role';

describe('MicromanagementPolicy', () => {
  const policy = new MicromanagementPolicy();

  it('dá CRUD completo até ao MEMBER', () => {
    for (const action of Object.values(Action)) {
      expect(policy.allows(WorkspaceRole.MEMBER, action)).toBe(true);
    }
  });
});

describe('HierarchicalPolicy', () => {
  const policy = new HierarchicalPolicy();

  it('deixa o MEMBER ler e atualizar', () => {
    expect(policy.allows(WorkspaceRole.MEMBER, Action.READ)).toBe(true);
    expect(policy.allows(WorkspaceRole.MEMBER, Action.UPDATE)).toBe(true);
  });

  it('impede o MEMBER de criar e excluir', () => {
    expect(policy.allows(WorkspaceRole.MEMBER, Action.CREATE)).toBe(false);
    expect(policy.allows(WorkspaceRole.MEMBER, Action.DELETE)).toBe(false);
  });

  it('libera o ADMIN e acima para tudo', () => {
    for (const role of [WorkspaceRole.ADMIN, WorkspaceRole.SUPERADMIN, WorkspaceRole.OWNER]) {
      for (const action of Object.values(Action)) {
        expect(policy.allows(role, action)).toBe(true);
      }
    }
  });
});

describe('ModuleGovernance', () => {
  it('trata tarefas e kanban como configuráveis', () => {
    expect(ModuleGovernance.isConfigurable(ProjectModule.TASKS)).toBe(true);
    expect(ModuleGovernance.isConfigurable(ProjectModule.KANBAN)).toBe(true);
  });

  it('trata notas, snippets e pomodoro como paradigma fixo', () => {
    for (const module of [
      ProjectModule.NOTES,
      ProjectModule.SNIPPETS,
      ProjectModule.POMODORO,
    ]) {
      expect(ModuleGovernance.isConfigurable(module)).toBe(false);
      expect(ModuleGovernance.fixedFor(module)).toBe(GovernanceMode.MICROMANAGEMENT);
    }
  });

  it('trata AGENDA e HABITS como módulos de paradigma fixo', () => {
    expect(ModuleGovernance.isConfigurable(ProjectModule.AGENDA)).toBe(false);
    expect(ModuleGovernance.isConfigurable(ProjectModule.HABITS)).toBe(false);
    expect(ModuleGovernance.fixedFor(ProjectModule.AGENDA)).toBe(GovernanceMode.MICROMANAGEMENT);
    expect(ModuleGovernance.fixedFor(ProjectModule.HABITS)).toBe(GovernanceMode.MICROMANAGEMENT);
  });

  it('trata ROADMAP como configurável, com padrão hierárquico', () => {
    expect(ModuleGovernance.isConfigurable(ProjectModule.ROADMAP)).toBe(true);
    expect(ModuleGovernance.defaultFor(ProjectModule.ROADMAP)).toBe(GovernanceMode.HIERARCHICAL);
  });

  it('deixa VAULT e BOOKMARKS configuráveis, com micromanagement por padrão', () => {
    for (const module of [ProjectModule.VAULT, ProjectModule.BOOKMARKS]) {
      expect(ModuleGovernance.isConfigurable(module)).toBe(true);
      expect(ModuleGovernance.defaultFor(module)).toBe(GovernanceMode.MICROMANAGEMENT);
    }
  });

  it('sob o paradigma hierárquico, MEMBER atualiza mas não cria nem exclui', () => {
    const policy = ModuleGovernance.policyFor(GovernanceMode.HIERARCHICAL);

    expect(policy.allows(WorkspaceRole.MEMBER, Action.UPDATE)).toBe(true);
    expect(policy.allows(WorkspaceRole.MEMBER, Action.READ)).toBe(true);
    expect(policy.allows(WorkspaceRole.MEMBER, Action.CREATE)).toBe(false);
    expect(policy.allows(WorkspaceRole.MEMBER, Action.DELETE)).toBe(false);
    expect(policy.allows(WorkspaceRole.ADMIN, Action.CREATE)).toBe(true);
  });

  it('lista exatamente os módulos configuráveis', () => {
    expect(ModuleGovernance.configurableModules()).toEqual([
      ProjectModule.TASKS,
      ProjectModule.KANBAN,
      ProjectModule.ROADMAP,
      ProjectModule.VAULT,
      ProjectModule.BOOKMARKS,
    ]);
  });

  it('usa microgerenciamento como padrão dos configuráveis', () => {
    expect(ModuleGovernance.defaultFor(ProjectModule.TASKS)).toBe(
      GovernanceMode.MICROMANAGEMENT,
    );
  });

  it('recusa pedir paradigma fixo de módulo configurável', () => {
    expect(() => ModuleGovernance.fixedFor(ProjectModule.TASKS)).toThrow(/configurável/);
  });

  it('devolve a política correspondente ao modo', () => {
    expect(ModuleGovernance.policyFor(GovernanceMode.HIERARCHICAL)).toBeInstanceOf(
      HierarchicalPolicy,
    );
    expect(ModuleGovernance.policyFor(GovernanceMode.MICROMANAGEMENT)).toBeInstanceOf(
      MicromanagementPolicy,
    );
  });
});
