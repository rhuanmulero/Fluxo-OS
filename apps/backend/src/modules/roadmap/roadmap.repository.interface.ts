import { Roadmap, RoadmapStage, RoadmapStageStatus } from '@prisma/client';

export const ROADMAP_REPOSITORY = Symbol('RoadmapRepository');

export type RoadmapWithStages = Roadmap & { stages: RoadmapStage[] };

export interface NewRoadmap {
  projectId: string;
  createdById: string;
  title: string;
  description?: string;
}

export interface RoadmapChanges {
  title?: string;
  description?: string;
}

export interface NewStage {
  roadmapId: string;
  title: string;
  description?: string;
  goal?: string;
  points: number;
  status: RoadmapStageStatus;
  position: number;
  dueDate?: Date;
}

export interface StageChanges {
  title?: string;
  description?: string;
  goal?: string;
  points?: number;
  status?: RoadmapStageStatus;
  dueDate?: Date | null;
}

export interface RoadmapRepository {
  findManyFor(projectId: string): Promise<RoadmapWithStages[]>;
  findById(id: string): Promise<Roadmap | null>;
  create(data: NewRoadmap): Promise<Roadmap>;
  update(id: string, changes: RoadmapChanges): Promise<Roadmap>;
  delete(id: string): Promise<void>;
  listStages(roadmapId: string): Promise<RoadmapStage[]>;
  findStageById(id: string): Promise<RoadmapStage | null>;
  createStage(data: NewStage): Promise<RoadmapStage>;
  updateStage(id: string, changes: StageChanges): Promise<RoadmapStage>;
  deleteStage(id: string): Promise<void>;
  applyStageOrder(orderedIds: string[]): Promise<void>;
}
