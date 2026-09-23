import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Roadmap, RoadmapStage } from '@prisma/client';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { StageResponseDto } from './dto/stage-response.dto';
import { UpdateRoadmapDto } from './dto/update-roadmap.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ROADMAP_REPOSITORY, RoadmapRepository } from './roadmap.repository.interface';

@Injectable()
export class RoadmapService {
  constructor(@Inject(ROADMAP_REPOSITORY) private readonly roadmaps: RoadmapRepository) {}

  async listFor(projectId: string): Promise<RoadmapResponseDto[]> {
    const found = await this.roadmaps.findManyFor(projectId);

    return found.map((roadmap) =>
      RoadmapResponseDto.from(roadmap, roadmap.stages, this.progressOf(roadmap.stages)),
    );
  }

  async create(
    projectId: string,
    userId: string,
    dto: CreateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    const roadmap = await this.roadmaps.create({
      projectId,
      createdById: userId,
      title: dto.title,
      description: dto.description,
    });

    return RoadmapResponseDto.from(roadmap, [], 0);
  }

  async update(
    projectId: string,
    roadmapId: string,
    dto: UpdateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    await this.require(projectId, roadmapId);

    const roadmap = await this.roadmaps.update(roadmapId, dto);
    const stages = await this.roadmaps.listStages(roadmapId);

    return RoadmapResponseDto.from(roadmap, stages, this.progressOf(stages));
  }

  async remove(projectId: string, roadmapId: string): Promise<void> {
    await this.require(projectId, roadmapId);
    await this.roadmaps.delete(roadmapId);
  }

  async addStage(
    projectId: string,
    roadmapId: string,
    dto: CreateStageDto,
  ): Promise<StageResponseDto> {
    await this.require(projectId, roadmapId);

    const stages = await this.roadmaps.listStages(roadmapId);

    const stage = await this.roadmaps.createStage({
      roadmapId,
      title: dto.title,
      description: dto.description,
      goal: dto.goal,
      points: dto.points ?? 1,
      status: dto.status ?? 'PLANNED',
      position: stages.length,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    return StageResponseDto.from(stage);
  }

  async updateStage(
    projectId: string,
    roadmapId: string,
    stageId: string,
    dto: UpdateStageDto,
  ): Promise<StageResponseDto> {
    await this.requireStage(projectId, roadmapId, stageId);

    const stage = await this.roadmaps.updateStage(stageId, {
      title: dto.title,
      description: dto.description,
      goal: dto.goal,
      points: dto.points,
      status: dto.status,
      dueDate:
        dto.dueDate === undefined ? undefined : dto.dueDate === null ? null : new Date(dto.dueDate),
    });

    return StageResponseDto.from(stage);
  }

  async removeStage(projectId: string, roadmapId: string, stageId: string): Promise<void> {
    await this.requireStage(projectId, roadmapId, stageId);
    await this.roadmaps.deleteStage(stageId);
  }

  async reorderStages(
    projectId: string,
    roadmapId: string,
    orderedIds: string[],
  ): Promise<void> {
    await this.require(projectId, roadmapId);

    const stages = await this.roadmaps.listStages(roadmapId);
    const known = new Set(stages.map((stage) => stage.id));

    if (orderedIds.length !== stages.length || orderedIds.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'A ordem enviada não corresponde às etapas deste roadmap.',
      );
    }

    await this.roadmaps.applyStageOrder(orderedIds);
  }

  private progressOf(stages: RoadmapStage[]): number {
    const total = stages.reduce((sum, stage) => sum + stage.points, 0);

    if (total === 0) {
      return 0;
    }

    const done = stages
      .filter((stage) => stage.status === 'DONE')
      .reduce((sum, stage) => sum + stage.points, 0);

    return Math.round((done / total) * 100);
  }

  private async require(projectId: string, roadmapId: string): Promise<Roadmap> {
    const roadmap = await this.roadmaps.findById(roadmapId);

    if (!roadmap || roadmap.projectId !== projectId) {
      throw new NotFoundException('Roadmap não encontrado.');
    }

    return roadmap;
  }

  private async requireStage(
    projectId: string,
    roadmapId: string,
    stageId: string,
  ): Promise<RoadmapStage> {
    await this.require(projectId, roadmapId);

    const stage = await this.roadmaps.findStageById(stageId);

    if (!stage || stage.roadmapId !== roadmapId) {
      throw new NotFoundException('Etapa não encontrada.');
    }

    return stage;
  }
}
