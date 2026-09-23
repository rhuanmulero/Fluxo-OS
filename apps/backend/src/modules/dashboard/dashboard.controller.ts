import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('workspaces/:workspaceId/dashboard')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  of(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: DashboardFilterDto,
  ): Promise<DashboardResponseDto> {
    return this.dashboard.of(workspaceId, user.id, filter);
  }
}
