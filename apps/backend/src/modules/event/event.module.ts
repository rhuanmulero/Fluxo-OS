import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { EventController } from './event.controller';
import { PrismaEventRepository } from './event.repository';
import { EVENT_REPOSITORY } from './event.repository.interface';
import { EventService } from './event.service';

@Module({
  imports: [AuthModule, WorkspaceModule, ProjectModule],
  controllers: [EventController],
  providers: [EventService, { provide: EVENT_REPOSITORY, useClass: PrismaEventRepository }],
  exports: [EventService],
})
export class EventModule {}
