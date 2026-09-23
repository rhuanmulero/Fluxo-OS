import { Injectable } from '@nestjs/common';
import { WorkspaceInvite } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { InviteRepository, NewInvite } from './invite.repository.interface';

@Injectable()
export class PrismaInviteRepository implements InviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewInvite): Promise<WorkspaceInvite> {
    return this.prisma.workspaceInvite.create({ data });
  }

  findByCode(code: string): Promise<WorkspaceInvite | null> {
    return this.prisma.workspaceInvite.findUnique({ where: { code } });
  }

  listByWorkspace(workspaceId: string): Promise<WorkspaceInvite[]> {
    return this.prisma.workspaceInvite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markUsed(id: string): Promise<WorkspaceInvite> {
    return this.prisma.workspaceInvite.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workspaceInvite.delete({ where: { id } });
  }
}
