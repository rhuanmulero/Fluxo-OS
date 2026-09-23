import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PomodoroModule } from '../pomodoro/pomodoro.module';
import { EventModule } from '../event/event.module';
import { HabitModule } from '../habit/habit.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DashboardController } from './dashboard.controller';
import { PrismaDashboardRepository } from './dashboard.repository';
import { DASHBOARD_REPOSITORY } from './dashboard.repository.interface';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, WorkspaceModule, PomodoroModule, EventModule, HabitModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: DASHBOARD_REPOSITORY, useClass: PrismaDashboardRepository },
  ],
  exports: [DashboardService, DASHBOARD_REPOSITORY],
})
export class DashboardModule {}
