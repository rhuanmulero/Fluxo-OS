import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { BookmarkController } from './bookmark.controller';
import { PrismaBookmarkRepository } from './bookmark.repository';
import { BOOKMARK_REPOSITORY } from './bookmark.repository.interface';
import { BookmarkService } from './bookmark.service';

@Module({
  imports: [AuthModule, WorkspaceModule, ProjectModule],
  controllers: [BookmarkController],
  providers: [
    BookmarkService,
    { provide: BOOKMARK_REPOSITORY, useClass: PrismaBookmarkRepository },
  ],
  exports: [BookmarkService],
})
export class BookmarkModule {}
