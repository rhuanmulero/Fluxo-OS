import { RoadmapStage, RoadmapStageStatus } from '@prisma/client';

export class StageResponseDto {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly description: string | null,
    readonly goal: string | null,
    readonly points: number,
    readonly status: RoadmapStageStatus,
    readonly position: number,
    readonly dueDate: Date | null,
  ) {}

  static from(stage: RoadmapStage): StageResponseDto {
    return new StageResponseDto(
      stage.id,
      stage.title,
      stage.description,
      stage.goal,
      stage.points,
      stage.status,
      stage.position,
      stage.dueDate,
    );
  }
}
