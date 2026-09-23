import { UserProfile, UserStatus } from '@prisma/client';

export const USER_PROFILE_REPOSITORY = Symbol('UserProfileRepository');

export interface ProfileChanges {
  jobTitle?: string;
  bio?: string;
  stack?: string[];
  bannerUrl?: string;
  themeColor?: string;
  vibe?: string;
  status?: UserStatus;
}

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  upsert(userId: string, changes: ProfileChanges): Promise<UserProfile>;
}
