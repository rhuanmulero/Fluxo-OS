import { Action } from './action';
import { WorkspaceRole } from './workspace-role';

export interface GovernancePolicy {
  allows(role: WorkspaceRole, action: Action): boolean;
}

export class MicromanagementPolicy implements GovernancePolicy {
  allows(_role: WorkspaceRole, _action: Action): boolean {
    return true;
  }
}

export class HierarchicalPolicy implements GovernancePolicy {
  allows(role: WorkspaceRole, action: Action): boolean {
    if (action === Action.READ || action === Action.UPDATE) {
      return true;
    }

    return role.atLeast(WorkspaceRole.ADMIN);
  }
}
