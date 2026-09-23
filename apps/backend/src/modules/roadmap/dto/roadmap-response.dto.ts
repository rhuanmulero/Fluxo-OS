import { Roadmap, RoadmapStage } from '@prisma/client';
import { StageResponseDto } from './stage-response.dto';

export class RoadmapResponseDto {
  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly title: string,
    readonly description: string | null,
    readonly progress: number,
    readonly stages: StageResponseDto[],
  ) {}

  static from(roadmap: Roadmap, stages: RoadmapStage[], progress: number): RoadmapResponseDto {
    return new RoadmapResponseDto(
      roadmap.id,
      roadmap.projectId,
      roadmap.title,
      roadmap.description,
      progress,
      stages.map(StageResponseDto.from),
    );
  }
}
