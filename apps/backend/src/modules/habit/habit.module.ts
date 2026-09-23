import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { HabitController } from './habit.controller';
import { PrismaHabitRepository } from './habit.repository';
import { HABIT_REPOSITORY } from './habit.repository.interface';
import { HabitService } from './habit.service';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [HabitController],
  providers: [HabitService, { provide: HABIT_REPOSITORY, useClass: PrismaHabitRepository }],
  exports: [HabitService],
})
export class HabitModule {}
