import { Module } from '@nestjs/common';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { PermissionResolver } from '../../common/authorization/permission.resolver';
import { AuthModule } from '../auth/auth.module';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';
import { PrismaInviteRepository } from './invite.repository';
import { INVITE_REPOSITORY } from './invite.repository.interface';
import { WorkspaceController } from './workspace.controller';
import { PrismaWorkspaceRepository } from './workspace.repository';
import { WORKSPACE_REPOSITORY } from './workspace.repository.interface';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceController, InviteController],
  providers: [
    WorkspaceService,
    InviteService,
    PermissionResolver,
    PermissionGuard,
    { provide: WORKSPACE_REPOSITORY, useClass: PrismaWorkspaceRepository },
    { provide: INVITE_REPOSITORY, useClass: PrismaInviteRepository },
  ],
  exports: [WorkspaceService, PermissionResolver, WORKSPACE_REPOSITORY],
})
export class WorkspaceModule {}
