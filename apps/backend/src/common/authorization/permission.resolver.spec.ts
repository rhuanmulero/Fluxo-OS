import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceMember } from '@prisma/client';
import { PermissionResolver } from './permission.resolver';
import { WorkspaceRole } from './workspace-role';
import { WorkspaceRepository } from '../../modules/workspace/workspace.repository.interface';

type FakeMembership = Pick<WorkspaceMember, 'workspaceId' | 'userId' | 'role' | 'deactivatedAt'>;

class FakeWorkspaceRepository {
  members: FakeMembership[] = [];

  findMembership(workspaceId: string, userId: string): Promise<FakeMembership | null> {
    return Promise.resolve(
      this.members.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null,
    );
  }

  findActiveMembership(workspaceId: string, userId: string): Promise<FakeMembership | null> {
    return Promise.resolve(
      this.members.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId && m.deactivatedAt === null,
      ) ?? null,
    );
  }
}

function membershipOf(role: WorkspaceMember['role']): WorkspaceMember {
  return {
    id: 'm1',
    workspaceId: 'w1',
    userId: 'u1',
    role,
    joinedAt: new Date(),
    deactivatedAt: null,
  };
}

describe('PermissionResolver', () => {
  let repository: FakeWorkspaceRepository;
  let resolver: PermissionResolver;

  beforeEach(() => {
    repository = new FakeWorkspaceRepository();
    resolver = new PermissionResolver(repository as unknown as WorkspaceRepository);
  });

  it('devolve o papel do membro', async () => {
    repository.members = [membershipOf('ADMIN')];

    await expect(resolver.roleIn('w1', 'u1')).resolves.toBe(WorkspaceRole.ADMIN);
  });

  it('trata quem não é membro como workspace inexistente', async () => {
    await expect(resolver.roleIn('w1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aceita papel exatamente no mínimo exigido', async () => {
    repository.members = [membershipOf('SUPERADMIN')];

    await expect(resolver.assertAtLeast('w1', 'u1', WorkspaceRole.SUPERADMIN)).resolves.toBe(
      WorkspaceRole.SUPERADMIN,
    );
  });

  it('recusa papel abaixo do mínimo exigido', async () => {
    repository.members = [membershipOf('MEMBER')];

    await expect(
      resolver.assertAtLeast('w1', 'u1', WorkspaceRole.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('membro desligado perde o acesso ao workspace', async () => {
    repository.members = [
      { workspaceId: 'w1', userId: 'u1', role: 'MEMBER', deactivatedAt: new Date() },
    ];

    await expect(resolver.roleIn('w1', 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('membro ativo continua entrando', async () => {
    repository.members = [
      { workspaceId: 'w1', userId: 'u1', role: 'MEMBER', deactivatedAt: null },
    ];

    await expect(resolver.roleIn('w1', 'u1')).resolves.toBeDefined();
  });
});
