import { UserProfile, UserStatus } from '@prisma/client';
import { WorkspaceRoleName } from '../../../common/authorization/workspace-role';
import { MemberWithUser } from '../workspace.repository.interface';

export class MemberProfileDto {
  constructor(
    readonly jobTitle: string | null,
    readonly bio: string | null,
    readonly stack: string[],
    readonly bannerUrl: string | null,
    readonly themeColor: string | null,
    readonly vibe: string | null,
    readonly status: UserStatus,
  ) {}

  static from(profile: UserProfile | null): MemberProfileDto {
    return new MemberProfileDto(
      profile?.jobTitle ?? null,
      profile?.bio ?? null,
      profile?.stack ?? [],
      profile?.bannerUrl ?? null,
      profile?.themeColor ?? null,
      profile?.vibe ?? null,
      profile?.status ?? 'ONLINE',
    );
  }
}

export class MemberResponseDto {
  constructor(
    readonly userId: string,
    readonly name: string,
    readonly email: string,
    readonly role: WorkspaceRoleName,
    readonly joinedAt: Date,
    readonly active: boolean,
    readonly profile: MemberProfileDto,
  ) {}

  static from(member: MemberWithUser): MemberResponseDto {
    return new MemberResponseDto(
      member.user.id,
      member.user.name,
      member.user.email,
      member.role,
      member.joinedAt,
      member.deactivatedAt === null,
      MemberProfileDto.from(member.user.profile),
    );
  }
}
