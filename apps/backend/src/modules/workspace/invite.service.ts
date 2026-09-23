import { randomInt } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRoleName } from '../../common/authorization/workspace-role';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteResponseDto } from './dto/invite-response.dto';
import { INVITE_REPOSITORY, InviteRepository } from './invite.repository.interface';
import { WORKSPACE_REPOSITORY, WorkspaceRepository } from './workspace.repository.interface';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const VALID_FOR_DAYS = 7;

@Injectable()
export class InviteService {
  constructor(
    @Inject(INVITE_REPOSITORY) private readonly invites: InviteRepository,
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaces: WorkspaceRepository,
  ) {}

  async create(
    workspaceId: string,
    creatorId: string,
    dto: CreateInviteDto,
  ): Promise<InviteResponseDto> {
    const role = dto.role as WorkspaceRoleName;

    if (role === 'OWNER') {
      throw new BadRequestException('Não é possível convidar alguém como dono.');
    }

    const invite = await this.invites.create({
      workspaceId,
      code: this.generateCode(),
      role,
      email: dto.email,
      expiresAt: new Date(Date.now() + VALID_FOR_DAYS * 24 * 60 * 60 * 1000),
      createdById: creatorId,
    });

    return InviteResponseDto.from(invite);
  }

  async listFor(workspaceId: string): Promise<InviteResponseDto[]> {
    const invites = await this.invites.listByWorkspace(workspaceId);

    return invites.map(InviteResponseDto.from);
  }

  async revoke(inviteId: string): Promise<void> {
    await this.invites.delete(inviteId);
  }

  async accept(code: string, userId: string): Promise<InviteResponseDto> {
    const invite = await this.invites.findByCode(code.toUpperCase());

    if (!invite) {
      throw new NotFoundException('Convite não encontrado.');
    }

    if (invite.usedAt) {
      throw new BadRequestException('Este convite já foi utilizado.');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Este convite expirou.');
    }

    await this.workspaces.upsertMember(invite.workspaceId, userId, invite.role);

    return InviteResponseDto.from(await this.invites.markUsed(invite.id));
  }

  private generateCode(): string {
    let code = '';

    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }

    return code;
  }
}
