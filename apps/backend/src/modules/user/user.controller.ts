import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';
import { UserStats, UserStatsService } from './user-stats.service';

@Controller('me')
@UseGuards(AuthGuard)
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly userStats: UserStatsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { ...user, profile: await this.users.profileOf(user.id) };
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser): Promise<UserStats> {
    return this.userStats.of(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.users.updateProfile(user.id, dto);
  }
}
