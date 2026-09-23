import { Inject, Injectable } from '@nestjs/common';
import {
  ProfileChanges,
  USER_PROFILE_REPOSITORY,
  UserProfileRepository,
} from './user-profile.repository.interface';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepository,
  ) {}

  async profileOf(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profiles.findByUserId(userId);

    return profile ? ProfileResponseDto.from(profile) : ProfileResponseDto.empty();
  }

  async updateProfile(userId: string, changes: ProfileChanges): Promise<ProfileResponseDto> {
    return ProfileResponseDto.from(await this.profiles.upsert(userId, changes));
  }
}
