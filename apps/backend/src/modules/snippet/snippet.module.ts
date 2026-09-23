import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SnippetController } from './snippet.controller';
import { PrismaSnippetRepository } from './snippet.repository';
import { SNIPPET_REPOSITORY } from './snippet.repository.interface';
import { SnippetService } from './snippet.service';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [SnippetController],
  providers: [
    SnippetService,
    { provide: SNIPPET_REPOSITORY, useClass: PrismaSnippetRepository },
  ],
  exports: [SnippetService],
})
export class SnippetModule {}
