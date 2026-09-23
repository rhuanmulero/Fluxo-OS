import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserProfile, Workspace, WorkspaceMember } from '@prisma/client';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';
import { WorkspaceService } from './workspace.service';
import {
  MemberWithUser,
  NewWorkspace,
  WorkspaceChanges,
  WorkspaceRepository,
} from './workspace.repository.interface';

type ProfileSeed = Pick<
  UserProfile,
  'jobTitle' | 'bio' | 'stack' | 'bannerUrl' | 'themeColor' | 'vibe' | 'status'
>;

class FakeWorkspaceRepository implements WorkspaceRepository {
  workspaces: Workspace[] = [];
  memberships: WorkspaceMember[] = [];
  profiles = new Map<string, ProfileSeed>();

  createWithOwner(data: NewWorkspace): Promise<Workspace> {
    const workspace: Workspace = {
      id: `w${this.workspaces.length + 1}`,
      name: data.name,
      slug: data.slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaces.push(workspace);
    this.memberships.push({
      id: `m${this.memberships.length + 1}`,
      workspaceId: workspace.id,
      userId: data.ownerId,
      role: 'OWNER',
      joinedAt: new Date(),
      deactivatedAt: null,
    });
    return Promise.resolve(workspace);
  }

  findManyForUser(userId: string): Promise<Workspace[]> {
    const ids = this.memberships
      .filter((m) => m.userId === userId && m.deactivatedAt === null)
      .map((m) => m.workspaceId);
    return Promise.resolve(this.workspaces.filter((w) => ids.includes(w.id)));
  }

  findById(id: string): Promise<Workspace | null> {
    return Promise.resolve(this.workspaces.find((w) => w.id === id) ?? null);
  }

  findBySlug(slug: string): Promise<Workspace | null> {
    return Promise.resolve(this.workspaces.find((w) => w.slug === slug) ?? null);
  }

  update(id: string, changes: WorkspaceChanges): Promise<Workspace> {
    const workspace = this.workspaces.find((w) => w.id === id);
    if (!workspace) throw new Error('não encontrado');
    Object.assign(workspace, changes);
    return Promise.resolve(workspace);
  }

  delete(id: string): Promise<void> {
    this.workspaces = this.workspaces.filter((w) => w.id !== id);
    return Promise.resolve();
  }

  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return Promise.resolve(
      this.memberships.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null,
    );
  }

  async setMemberActive(workspaceId: string, userId: string, active: boolean) {
    const member = this.memberships.find(
      (candidate) => candidate.workspaceId === workspaceId && candidate.userId === userId,
    )!;

    member.deactivatedAt = active ? null : new Date();

    return member;
  }

  async findActiveMembership(workspaceId: string, userId: string) {
    const member = await this.findMembership(workspaceId, userId);

    return member === null || member.deactivatedAt !== null ? null : member;
  }

  areMembers(workspaceId: string, userIds: string[]): Promise<boolean> {
    return Promise.resolve(
      userIds.every((userId) =>
        this.memberships.some(
          (m) => m.workspaceId === workspaceId && m.userId === userId && m.deactivatedAt === null,
        ),
      ),
    );
  }

  listMembers(workspaceId: string): Promise<MemberWithUser[]> {
    return Promise.resolve(
      this.memberships
        .filter((m) => m.workspaceId === workspaceId)
        .map((m) => {
          const seed = this.profiles.get(m.userId);
          const profile: UserProfile | null = seed
            ? { id: m.userId, userId: m.userId, createdAt: new Date(), updatedAt: new Date(), ...seed }
            : null;

          return {
            ...m,
            user: {
              id: m.userId,
              name: m.userId,
              email: `${m.userId}@t.local`,
              profile,
            },
          };
        }),
    );
  }

  upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRoleName,
  ): Promise<WorkspaceMember> {
    const existing = this.memberships.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId,
    );
    if (existing) {
      existing.role = role;
      return Promise.resolve(existing);
    }
    const created: WorkspaceMember = {
      id: `m${this.memberships.length + 1}`,
      workspaceId,
      userId,
      role,
      joinedAt: new Date(),
      deactivatedAt: null,
    };
    this.memberships.push(created);
    return Promise.resolve(created);
  }

  removeMember(workspaceId: string, userId: string): Promise<void> {
    this.memberships = this.memberships.filter(
      (m) => !(m.workspaceId === workspaceId && m.userId === userId),
    );
    return Promise.resolve();
  }

  countByRole(workspaceId: string, role: WorkspaceRoleName): Promise<number> {
    return Promise.resolve(
      this.memberships.filter((m) => m.workspaceId === workspaceId && m.role === role).length,
    );
  }
}

describe('WorkspaceService', () => {
  let repository: FakeWorkspaceRepository;
  let service: WorkspaceService;

  beforeEach(() => {
    repository = new FakeWorkspaceRepository();
    service = new WorkspaceService(repository);
  });

  it('cria o workspace já com o criador como OWNER', async () => {
    const workspace = await service.create('u1', { name: 'Equipe Fluxo' });

    expect(workspace.slug).toBe('equipe-fluxo');
    await expect(service.roleOf(workspace.id, 'u1')).resolves.toBe('OWNER');
  });

  it('gera slug único quando o nome se repete', async () => {
    await service.create('u1', { name: 'Equipe Fluxo' });
    const segundo = await service.create('u2', { name: 'Equipe Fluxo' });

    expect(segundo.slug).not.toBe('equipe-fluxo');
    expect(segundo.slug).toMatch(/^equipe-fluxo-/);
  });

  it('lista apenas os workspaces do usuário', async () => {
    await service.create('u1', { name: 'Um' });
    await service.create('u2', { name: 'Dois' });

    await expect(service.listFor('u1')).resolves.toHaveLength(1);
  });

  it('recusa acesso de quem não é membro', async () => {
    const workspace = await service.create('u1', { name: 'Um' });

    await expect(service.findFor('u2', workspace.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('impede promover alguém a OWNER', async () => {
    const workspace = await service.create('u1', { name: 'Um' });
    await repository.upsertMember(workspace.id, 'u2', 'MEMBER');

    await expect(service.changeRole(workspace.id, 'u1', 'u2', 'OWNER')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impede rebaixar o próprio OWNER', async () => {
    const workspace = await service.create('u1', { name: 'Um' });

    await expect(service.changeRole(workspace.id, 'u1', 'u1', 'ADMIN')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impede remover o OWNER do workspace', async () => {
    const workspace = await service.create('u1', { name: 'Um' });

    await expect(service.removeMember(workspace.id, 'u1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impede que um papel altere alguém de nível igual ou maior', async () => {
    const workspace = await service.create('u1', { name: 'Um' });
    await repository.upsertMember(workspace.id, 'u2', 'SUPERADMIN');
    await repository.upsertMember(workspace.id, 'u3', 'SUPERADMIN');

    await expect(service.changeRole(workspace.id, 'u2', 'u3', 'MEMBER')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('permite que o SUPERADMIN rebaixe um ADMIN', async () => {
    const workspace = await service.create('u1', { name: 'Um' });
    await repository.upsertMember(workspace.id, 'u2', 'SUPERADMIN');
    await repository.upsertMember(workspace.id, 'u3', 'ADMIN');

    await service.changeRole(workspace.id, 'u2', 'u3', 'MEMBER');

    await expect(service.roleOf(workspace.id, 'u3')).resolves.toBe('MEMBER');
  });

  it('devolve o perfil do membro junto dos dados de associação', async () => {
    const workspace = await service.create('u1', { name: 'Acme' });

    repository.profiles.set('u1', {
      jobTitle: 'Tech Lead',
      bio: 'Gosta de Postgres.',
      stack: ['TypeScript', 'Prisma'],
      bannerUrl: 'https://exemplo.com/b.jpg',
      themeColor: '#8b5cf6',
      vibe: 'Ouvindo Lo-Fi',
      status: 'DEEP_WORK',
    });

    const [member] = await service.members(workspace.id);

    if (!member) {
      throw new Error('membro não encontrado no workspace de teste');
    }

    expect(member.profile.jobTitle).toBe('Tech Lead');
    expect(member.profile.bio).toBe('Gosta de Postgres.');
    expect(member.profile.stack).toEqual(['TypeScript', 'Prisma']);
    expect(member.profile.bannerUrl).toBe('https://exemplo.com/b.jpg');
    expect(member.profile.themeColor).toBe('#8b5cf6');
    expect(member.profile.vibe).toBe('Ouvindo Lo-Fi');
    expect(member.profile.status).toBe('DEEP_WORK');
  });

  it('devolve um perfil vazio e status ONLINE quando o membro nunca preencheu', async () => {
    const workspace = await service.create('u2', { name: 'Beta' });

    const [member] = await service.members(workspace.id);

    if (!member) {
      throw new Error('membro não encontrado no workspace de teste');
    }

    expect(member.profile.jobTitle).toBeNull();
    expect(member.profile.bio).toBeNull();
    expect(member.profile.stack).toEqual([]);
    expect(member.profile.bannerUrl).toBeNull();
    expect(member.profile.themeColor).toBeNull();
    expect(member.profile.vibe).toBeNull();
    expect(member.profile.status).toBe('ONLINE');
  });

  describe('deactivateMember', () => {
    beforeEach(async () => {
      await repository.createWithOwner({ name: 'W1', slug: 'w1', ownerId: 'owner-1' });
      await repository.upsertMember('w1', 'u2', 'MEMBER');
    });

    it('desligar mantem o vinculo e marca a data', async () => {
      const member = await service.deactivateMember('w1', 'owner-1', 'u2', false);

      expect(member.active).toBe(false);
      await expect(repository.findMembership('w1', 'u2')).resolves.not.toBeNull();
    });

    it('membro desligado continua listado, para preservar o historico', async () => {
      await service.deactivateMember('w1', 'owner-1', 'u2', false);

      const members = await service.members('w1');

      expect(members.map((member) => member.userId)).toContain('u2');
      expect(members.find((member) => member.userId === 'u2')?.active).toBe(false);
    });

    it('o dono nao pode ser desligado', async () => {
      await expect(service.deactivateMember('w1', 'owner-1', 'owner-1', false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('reativar limpa a data e devolve o acesso', async () => {
      await service.deactivateMember('w1', 'owner-1', 'u2', false);
      const member = await service.deactivateMember('w1', 'owner-1', 'u2', true);

      expect(member.active).toBe(true);
    });
  });
});
