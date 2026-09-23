import { HabitLog } from '@prisma/client';

export class HabitLogResponseDto {
  constructor(
    readonly habitId: string,
    readonly date: Date,
    readonly value: number,
    readonly note: string | null,
  ) {}

  static from(log: HabitLog): HabitLogResponseDto {
    return new HabitLogResponseDto(log.habitId, log.date, log.value, log.note);
  }
}
