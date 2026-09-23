import { WorkspaceInvite } from '@prisma/client';
import { WorkspaceRoleName } from '../../../common/authorization/workspace-role';

export class InviteResponseDto {
  constructor(
    readonly id: string,
    readonly code: string,
    readonly role: WorkspaceRoleName,
    readonly email: string | null,
    readonly expiresAt: Date,
    readonly usedAt: Date | null,
  ) {}

  static from(invite: WorkspaceInvite): InviteResponseDto {
    return new InviteResponseDto(
      invite.id,
      invite.code,
      invite.role,
      invite.email,
      invite.expiresAt,
      invite.usedAt,
    );
  }
}
