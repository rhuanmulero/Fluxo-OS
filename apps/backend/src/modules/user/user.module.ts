import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { PomodoroModule } from '../pomodoro/pomodoro.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaUserProfileRepository } from './user-profile.repository';
import { USER_PROFILE_REPOSITORY } from './user-profile.repository.interface';
import { UserStatsService } from './user-stats.service';

@Module({
  imports: [AuthModule, DashboardModule, PomodoroModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserStatsService,
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
  ],
  exports: [UserService],
})
export class UserModule {}
