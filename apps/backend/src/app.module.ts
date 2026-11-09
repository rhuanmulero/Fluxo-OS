import { Module } from '@nestjs/common';
import { NamiModule } from './modules/nami/nami.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/database/prisma.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { validateEnvironment } from './common/config/environment-variables';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectModule } from './modules/project/project.module';
import { KanbanColumnModule } from './modules/kanban-column/kanban-column.module';
import { TaskModule } from './modules/task/task.module';
import { NoteModule } from './modules/note/note.module';
import { SnippetModule } from './modules/snippet/snippet.module';
import { PomodoroModule } from './modules/pomodoro/pomodoro.module';
import { EventModule } from './modules/event/event.module';
import { HabitModule } from './modules/habit/habit.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DocumentModule } from './modules/document/document.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    NamiModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      errorMessage: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
    ProjectModule,
    KanbanColumnModule,
    TaskModule,
    NoteModule,
    SnippetModule,
    PomodoroModule,
    EventModule,
    HabitModule,
    RoadmapModule,
    NotificationModule,
    DocumentModule,
    BookmarkModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
