export type WorkspaceRoleName = 'OWNER' | 'SUPERADMIN' | 'ADMIN' | 'MEMBER';

export class WorkspaceRole {
  static readonly MEMBER = new WorkspaceRole('MEMBER', 1);
  static readonly ADMIN = new WorkspaceRole('ADMIN', 2);
  static readonly SUPERADMIN = new WorkspaceRole('SUPERADMIN', 3);
  static readonly OWNER = new WorkspaceRole('OWNER', 4);

  private static readonly byName = new Map<WorkspaceRoleName, WorkspaceRole>([
    ['MEMBER', WorkspaceRole.MEMBER],
    ['ADMIN', WorkspaceRole.ADMIN],
    ['SUPERADMIN', WorkspaceRole.SUPERADMIN],
    ['OWNER', WorkspaceRole.OWNER],
  ]);

  private constructor(
    readonly name: WorkspaceRoleName,
    private readonly rank: number,
  ) {}

  static from(name: WorkspaceRoleName): WorkspaceRole {
    const role = WorkspaceRole.byName.get(name);

    if (!role) {
      throw new Error(`Papel desconhecido: ${name}`);
    }

    return role;
  }

  atLeast(other: WorkspaceRole): boolean {
    return this.rank >= other.rank;
  }

  outranks(other: WorkspaceRole): boolean {
    return this.rank > other.rank;
  }
}
