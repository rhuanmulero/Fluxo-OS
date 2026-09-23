import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { KanbanColumnController } from './kanban-column.controller';
import { PrismaKanbanColumnRepository } from './kanban-column.repository';
import { KANBAN_COLUMN_REPOSITORY } from './kanban-column.repository.interface';
import { KanbanColumnService } from './kanban-column.service';

@Module({
  imports: [AuthModule, ProjectModule],
  controllers: [KanbanColumnController],
  providers: [
    KanbanColumnService,
    { provide: KANBAN_COLUMN_REPOSITORY, useClass: PrismaKanbanColumnRepository },
  ],
  exports: [KanbanColumnService, KANBAN_COLUMN_REPOSITORY],
})
export class KanbanColumnModule {}
