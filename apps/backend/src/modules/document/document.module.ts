import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DocumentController } from './document.controller';
import { PrismaDocumentRepository } from './document.repository';
import { DOCUMENT_REPOSITORY } from './document.repository.interface';
import { DocumentService } from './document.service';

@Module({
  imports: [AuthModule, WorkspaceModule, ProjectModule, StorageModule],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
  ],
  exports: [DocumentService],
})
export class DocumentModule {}
