import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KanbanColumnModule } from '../kanban-column/kanban-column.module';
import { ProjectModule } from '../project/project.module';
import { PrismaTaskRepository } from './task.repository';
import { TASK_REPOSITORY } from './task.repository.interface';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [AuthModule, ProjectModule, KanbanColumnModule],
  controllers: [TaskController],
  providers: [TaskService, { provide: TASK_REPOSITORY, useClass: PrismaTaskRepository }],
  exports: [TaskService],
})
export class TaskModule {}
