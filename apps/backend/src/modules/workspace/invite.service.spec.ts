import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkspaceInvite } from '@prisma/client';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';
import { InviteService } from './invite.service';
import { InviteRepository, NewInvite } from './invite.repository.interface';
import { WorkspaceRepository } from './workspace.repository.interface';

class FakeInviteRepository implements InviteRepository {
  invites: WorkspaceInvite[] = [];

  create(data: NewInvite): Promise<WorkspaceInvite> {
    const invite: WorkspaceInvite = {
      id: `i${this.invites.length + 1}`,
      workspaceId: data.workspaceId,
      code: data.code,
      role: data.role,
      email: data.email ?? null,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdById: data.createdById,
      createdAt: new Date(),
    };
    this.invites.push(invite);
    return Promise.resolve(invite);
  }

  findByCode(code: string): Promise<WorkspaceInvite | null> {
    return Promise.resolve(this.invites.find((i) => i.code === code) ?? null);
  }

  listByWorkspace(workspaceId: string): Promise<WorkspaceInvite[]> {
    return Promise.resolve(this.invites.filter((i) => i.workspaceId === workspaceId));
  }

  markUsed(id: string): Promise<WorkspaceInvite> {
    const invite = this.invites.find((i) => i.id === id);
    if (!invite) throw new Error('não encontrado');
    invite.usedAt = new Date();
    return Promise.resolve(invite);
  }

  delete(id: string): Promise<void> {
    this.invites = this.invites.filter((i) => i.id !== id);
    return Promise.resolve();
  }
}

type WorkspaceStub = WorkspaceRepository & { added: Array<[string, WorkspaceRoleName]> };

function workspaceRepositoryStub(): WorkspaceStub {
  const added: Array<[string, WorkspaceRoleName]> = [];

  return {
    added,
    upsertMember: (_workspaceId: string, userId: string, role: WorkspaceRoleName) => {
      added.push([userId, role]);
      return Promise.resolve({} as never);
    },
    findMembership: () => Promise.resolve(null),
  } as unknown as WorkspaceStub;
}

describe('InviteService', () => {
  it('cria convite com código de 8 caracteres maiúsculos', async () => {
    const service = new InviteService(new FakeInviteRepository(), workspaceRepositoryStub());

    const invite = await service.create('w1', 'u1', { role: 'MEMBER' });

    expect(invite.code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('recusa criar convite de OWNER', async () => {
    const service = new InviteService(new FakeInviteRepository(), workspaceRepositoryStub());

    await expect(service.create('w1', 'u1', { role: 'OWNER' as never })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('aceita o convite e concede o papel', async () => {
    const invites = new FakeInviteRepository();
    const workspaces = workspaceRepositoryStub();
    const service = new InviteService(invites, workspaces);

    const invite = await service.create('w1', 'u1', { role: 'ADMIN' });
    await service.accept(invite.code, 'u2');

    expect(workspaces.added).toEqual([['u2', 'ADMIN']]);
  });

  it('recusa código inexistente', async () => {
    const service = new InviteService(new FakeInviteRepository(), workspaceRepositoryStub());

    await expect(service.accept('NAOEXIST', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa convite já usado', async () => {
    const invites = new FakeInviteRepository();
    const service = new InviteService(invites, workspaceRepositoryStub());

    const invite = await service.create('w1', 'u1', { role: 'MEMBER' });
    await service.accept(invite.code, 'u2');

    await expect(service.accept(invite.code, 'u3')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa convite expirado', async () => {
    const invites = new FakeInviteRepository();
    const service = new InviteService(invites, workspaceRepositoryStub());

    const created = await service.create('w1', 'u1', { role: 'MEMBER' });
    const stored = invites.invites.find((invite) => invite.code === created.code);

    if (!stored) {
      throw new Error('convite não foi gravado');
    }

    stored.expiresAt = new Date(Date.now() - 1000);

    await expect(service.accept(created.code, 'u2')).rejects.toBeInstanceOf(BadRequestException);
  });
});
