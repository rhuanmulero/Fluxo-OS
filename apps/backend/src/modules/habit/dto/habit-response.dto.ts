import { Habit, HabitFrequency } from '@prisma/client';

export class HabitResponseDto {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly frequency: HabitFrequency,
    readonly targetPerPeriod: number,
    readonly color: string | null,
    readonly projectId: string | null,
    readonly archived: boolean,
    readonly doneToday: boolean,
  ) {}

  static from(habit: Habit, doneToday: boolean): HabitResponseDto {
    return new HabitResponseDto(
      habit.id,
      habit.name,
      habit.frequency,
      habit.targetPerPeriod,
      habit.color,
      habit.projectId,
      habit.archivedAt !== null,
      doneToday,
    );
  }
}
