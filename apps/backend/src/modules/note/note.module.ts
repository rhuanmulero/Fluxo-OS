import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NoteController } from './note.controller';
import { PrismaNoteRepository } from './note.repository';
import { NOTE_REPOSITORY } from './note.repository.interface';
import { NoteService } from './note.service';

@Module({
  imports: [AuthModule, WorkspaceModule, ProjectModule],
  controllers: [NoteController],
  providers: [NoteService, { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository }],
  exports: [NoteService],
})
export class NoteModule {}
