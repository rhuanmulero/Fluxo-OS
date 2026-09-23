import { Injectable } from '@nestjs/common';
import { Roadmap, RoadmapStage } from '@prisma/client';
import { PrismaService } from '../../common/database/prisma.service';
import {
  NewRoadmap,
  NewStage,
  RoadmapChanges,
  RoadmapRepository,
  RoadmapWithStages,
  StageChanges,
} from './roadmap.repository.interface';

@Injectable()
export class PrismaRoadmapRepository implements RoadmapRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyFor(projectId: string): Promise<RoadmapWithStages[]> {
    return this.prisma.roadmap.findMany({
      where: { projectId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  findById(id: string): Promise<Roadmap | null> {
    return this.prisma.roadmap.findUnique({ where: { id } });
  }

  create(data: NewRoadmap): Promise<Roadmap> {
    return this.prisma.roadmap.create({ data });
  }

  update(id: string, changes: RoadmapChanges): Promise<Roadmap> {
    return this.prisma.roadmap.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.roadmap.delete({ where: { id } });
  }

  listStages(roadmapId: string): Promise<RoadmapStage[]> {
    return this.prisma.roadmapStage.findMany({
      where: { roadmapId },
      orderBy: { position: 'asc' },
    });
  }

  findStageById(id: string): Promise<RoadmapStage | null> {
    return this.prisma.roadmapStage.findUnique({ where: { id } });
  }

  createStage(data: NewStage): Promise<RoadmapStage> {
    return this.prisma.roadmapStage.create({ data });
  }

  updateStage(id: string, changes: StageChanges): Promise<RoadmapStage> {
    return this.prisma.roadmapStage.update({ where: { id }, data: changes });
  }

  async deleteStage(id: string): Promise<void> {
    await this.prisma.roadmapStage.delete({ where: { id } });
  }

  async applyStageOrder(orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, position) =>
        this.prisma.roadmapStage.update({ where: { id }, data: { position } }),
      ),
    );
  }
}
