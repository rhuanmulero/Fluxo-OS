import { UserProfile, UserStatus } from '@prisma/client';

export class ProfileResponseDto {
  jobTitle: string | null = null;
  bio: string | null = null;
  stack: string[] = [];
  bannerUrl: string | null = null;
  themeColor: string | null = null;
  vibe: string | null = null;
  status: UserStatus = 'ONLINE';

  static from(profile: UserProfile): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.jobTitle = profile.jobTitle;
    dto.bio = profile.bio;
    dto.stack = profile.stack;
    dto.bannerUrl = profile.bannerUrl;
    dto.themeColor = profile.themeColor;
    dto.vibe = profile.vibe;
    dto.status = profile.status;
    return dto;
  }

  static empty(): ProfileResponseDto {
    return new ProfileResponseDto();
  }
}
