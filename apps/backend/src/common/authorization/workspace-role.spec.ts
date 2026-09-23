import { WorkspaceRole } from './workspace-role';

describe('WorkspaceRole', () => {
  it('ordena os quatro níveis', () => {
    expect(WorkspaceRole.OWNER.outranks(WorkspaceRole.SUPERADMIN)).toBe(true);
    expect(WorkspaceRole.SUPERADMIN.outranks(WorkspaceRole.ADMIN)).toBe(true);
    expect(WorkspaceRole.ADMIN.outranks(WorkspaceRole.MEMBER)).toBe(true);
    expect(WorkspaceRole.MEMBER.outranks(WorkspaceRole.ADMIN)).toBe(false);
  });

  it('considera atLeast verdadeiro para o próprio nível', () => {
    expect(WorkspaceRole.ADMIN.atLeast(WorkspaceRole.ADMIN)).toBe(true);
    expect(WorkspaceRole.ADMIN.atLeast(WorkspaceRole.MEMBER)).toBe(true);
    expect(WorkspaceRole.ADMIN.atLeast(WorkspaceRole.SUPERADMIN)).toBe(false);
  });

  it('reconstrói o papel a partir do nome persistido', () => {
    expect(WorkspaceRole.from('SUPERADMIN')).toBe(WorkspaceRole.SUPERADMIN);
  });

  it('recusa nome desconhecido', () => {
    expect(() => WorkspaceRole.from('CHEFE' as never)).toThrow(/CHEFE/);
  });
});
