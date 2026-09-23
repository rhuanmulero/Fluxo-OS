import {
  GovernancePolicy,
  HierarchicalPolicy,
  MicromanagementPolicy,
} from './governance-policy';
import { GovernanceMode, ProjectModule } from './project-module';

export class ModuleGovernance {
  private static readonly configurable = new Map<ProjectModule, GovernanceMode>([
    [ProjectModule.TASKS, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.KANBAN, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.ROADMAP, GovernanceMode.HIERARCHICAL],
    [ProjectModule.VAULT, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.BOOKMARKS, GovernanceMode.MICROMANAGEMENT],
  ]);

  private static readonly fixed = new Map<ProjectModule, GovernanceMode>([
    [ProjectModule.NOTES, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.SNIPPETS, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.POMODORO, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.AGENDA, GovernanceMode.MICROMANAGEMENT],
    [ProjectModule.HABITS, GovernanceMode.MICROMANAGEMENT],
  ]);

  private static readonly policies = new Map<GovernanceMode, GovernancePolicy>([
    [GovernanceMode.MICROMANAGEMENT, new MicromanagementPolicy()],
    [GovernanceMode.HIERARCHICAL, new HierarchicalPolicy()],
  ]);

  static isConfigurable(module: ProjectModule): boolean {
    return ModuleGovernance.configurable.has(module);
  }

  static configurableModules(): ProjectModule[] {
    return [...ModuleGovernance.configurable.keys()];
  }

  static defaultFor(module: ProjectModule): GovernanceMode {
    const mode = ModuleGovernance.configurable.get(module);

    if (!mode) {
      throw new Error(`Módulo ${module} não é configurável.`);
    }

    return mode;
  }

  static fixedFor(module: ProjectModule): GovernanceMode {
    const mode = ModuleGovernance.fixed.get(module);

    if (!mode) {
      throw new Error(`Módulo ${module} é configurável e não tem paradigma fixo.`);
    }

    return mode;
  }

  static policyFor(mode: GovernanceMode): GovernancePolicy {
    const policy = ModuleGovernance.policies.get(mode);

    if (!policy) {
      throw new Error(`Paradigma desconhecido: ${mode}`);
    }

    return policy;
  }
}
