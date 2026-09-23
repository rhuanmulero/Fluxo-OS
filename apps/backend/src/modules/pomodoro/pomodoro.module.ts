import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PomodoroController } from './pomodoro.controller';
import { PrismaPomodoroRepository } from './pomodoro.repository';
import { POMODORO_REPOSITORY } from './pomodoro.repository.interface';
import { PomodoroService } from './pomodoro.service';

@Module({
  imports: [AuthModule],
  controllers: [PomodoroController],
  providers: [
    PomodoroService,
    { provide: POMODORO_REPOSITORY, useClass: PrismaPomodoroRepository },
  ],
  exports: [PomodoroService],
})
export class PomodoroModule {}
