import { Module } from '@nestjs/common';
import { ModulePermissionGuard } from '../../common/authorization/module-permission.guard';
import { ModulePermissionResolver } from '../../common/authorization/module-permission.resolver';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ProjectController } from './project.controller';
import { PrismaProjectRepository } from './project.repository';
import { PROJECT_REPOSITORY } from './project.repository.interface';
import { ProjectService } from './project.service';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ModulePermissionResolver,
    ModulePermissionGuard,
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
  ],
  exports: [ProjectService, ModulePermissionResolver, PROJECT_REPOSITORY],
})
export class ProjectModule {}
