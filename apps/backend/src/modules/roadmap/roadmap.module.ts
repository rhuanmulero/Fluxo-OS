import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RoadmapController } from './roadmap.controller';
import { PrismaRoadmapRepository } from './roadmap.repository';
import { ROADMAP_REPOSITORY } from './roadmap.repository.interface';
import { RoadmapService } from './roadmap.service';

@Module({
  imports: [AuthModule, WorkspaceModule, ProjectModule],
  controllers: [RoadmapController],
  providers: [
    RoadmapService,
    { provide: ROADMAP_REPOSITORY, useClass: PrismaRoadmapRepository },
  ],
  exports: [RoadmapService],
})
export class RoadmapModule {}
