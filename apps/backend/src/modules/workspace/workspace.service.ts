import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, WorkspaceRoleName } from '../../common/authorization/workspace-role';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';
import { WORKSPACE_REPOSITORY, WorkspaceRepository } from './workspace.repository.interface';

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
    const slug = await this.availableSlug(dto.name);
    const workspace = await this.workspaces.createWithOwner({
      name: dto.name,
      slug,
      ownerId: userId,
    });

    return WorkspaceResponseDto.from(workspace);
  }

  async listFor(userId: string): Promise<WorkspaceResponseDto[]> {
    const workspaces = await this.workspaces.findManyForUser(userId);

    return workspaces.map(WorkspaceResponseDto.from);
  }

  async findFor(userId: string, workspaceId: string): Promise<WorkspaceResponseDto> {
    await this.roleOf(workspaceId, userId);
    const workspace = await this.workspaces.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace não encontrado.');
    }

    return WorkspaceResponseDto.from(workspace);
  }

  async rename(workspaceId: string, dto: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    return WorkspaceResponseDto.from(await this.workspaces.update(workspaceId, dto));
  }

  async remove(workspaceId: string): Promise<void> {
    await this.workspaces.delete(workspaceId);
  }

  async members(workspaceId: string): Promise<MemberResponseDto[]> {
    const members = await this.workspaces.listMembers(workspaceId);

    return members.map(MemberResponseDto.from);
  }

  async roleOf(workspaceId: string, userId: string): Promise<WorkspaceRoleName> {
    const membership = await this.workspaces.findActiveMembership(workspaceId, userId);

    if (!membership) {
      throw new NotFoundException('Workspace não encontrado.');
    }

    return membership.role;
  }

  async changeRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: WorkspaceRoleName,
  ): Promise<MemberResponseDto> {
    if (role === 'OWNER') {
      throw new BadRequestException('O dono do workspace não pode ser trocado por aqui.');
    }

    const target = await this.requireRole(workspaceId, targetUserId);

    if (target === 'OWNER') {
      throw new BadRequestException('O dono do workspace não pode ser rebaixado.');
    }

    await this.requireAuthorityOver(workspaceId, actorId, target);
    await this.workspaces.upsertMember(workspaceId, targetUserId, role);

    const members = await this.workspaces.listMembers(workspaceId);
    const updated = members.find((member) => member.userId === targetUserId);

    if (!updated) {
      throw new NotFoundException('Membro não encontrado.');
    }

    return MemberResponseDto.from(updated);
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    const target = await this.requireRole(workspaceId, targetUserId);

    if (target === 'OWNER') {
      throw new BadRequestException('O dono não pode ser removido do workspace.');
    }

    await this.requireAuthorityOver(workspaceId, actorId, target);
    await this.workspaces.removeMember(workspaceId, targetUserId);
  }

  async deactivateMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    active: boolean,
  ): Promise<MemberResponseDto> {
    const target = await this.requireRole(workspaceId, targetUserId);

    if (target === 'OWNER') {
      throw new BadRequestException('O dono do workspace não pode ser desligado.');
    }

    await this.requireAuthorityOver(workspaceId, actorId, target);
    await this.workspaces.setMemberActive(workspaceId, targetUserId, active);

    const members = await this.workspaces.listMembers(workspaceId);
    const updated = members.find((member) => member.userId === targetUserId);

    if (!updated) {
      throw new NotFoundException('Membro não encontrado.');
    }

    return MemberResponseDto.from(updated);
  }

  private async requireRole(workspaceId: string, userId: string): Promise<WorkspaceRoleName> {
    const membership = await this.workspaces.findMembership(workspaceId, userId);

    if (!membership) {
      throw new NotFoundException('Membro não encontrado neste workspace.');
    }

    return membership.role;
  }

  private async requireAuthorityOver(
    workspaceId: string,
    actorId: string,
    targetRole: WorkspaceRoleName,
  ): Promise<void> {
    const actorRole = await this.requireRole(workspaceId, actorId);

    if (!WorkspaceRole.from(actorRole).outranks(WorkspaceRole.from(targetRole))) {
      throw new ForbiddenException('Você não tem autoridade sobre este membro.');
    }
  }

  private async availableSlug(name: string): Promise<string> {
    const base = name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!(await this.workspaces.findBySlug(base))) {
      return base;
    }

    return `${base}-${Date.now().toString(36)}`;
  }
}
