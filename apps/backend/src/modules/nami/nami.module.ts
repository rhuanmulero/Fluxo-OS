import { ProjectModule } from '../project/project.module';
import { NamiProjectContextService } from './nami-project-context.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NamiController } from './nami.controller';
import { NamiService } from './nami.service';
import { NamiKeyService } from './nami-key.service';
import { GeminiService } from './gemini.service';

@Module({ imports: [AuthModule, ProjectModule], controllers: [NamiController], providers: [NamiService, NamiKeyService, GeminiService, NamiProjectContextService] })
export class NamiModule {}
