import { Injectable } from '@nestjs/common';
import { UserProfile } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import { ProfileChanges, UserProfileRepository } from './user-profile.repository.interface';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  upsert(userId: string, changes: ProfileChanges): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...changes },
      update: changes,
    });
  }
}
