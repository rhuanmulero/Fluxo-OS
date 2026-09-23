import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Roadmap, RoadmapStage } from '@prisma/client';
import { RoadmapService } from './roadmap.service';
import {
  NewRoadmap,
  NewStage,
  RoadmapChanges,
  RoadmapRepository,
  RoadmapWithStages,
  StageChanges,
} from './roadmap.repository.interface';

function applyDefined<T extends object>(target: T, changes: Partial<T>): void {
  (Object.keys(changes) as Array<keyof T>).forEach((key) => {
    const value = changes[key];

    if (value !== undefined) {
      target[key] = value;
    }
  });
}

class FakeRoadmapRepository implements RoadmapRepository {
  roadmaps: Roadmap[] = [];
  stages: RoadmapStage[] = [];
  private nextRoadmapId = 1;
  private nextStageId = 1;

  findManyFor(projectId: string): Promise<RoadmapWithStages[]> {
    return Promise.resolve(
      this.roadmaps
        .filter((roadmap) => roadmap.projectId === projectId)
        .map((roadmap) => ({
          ...roadmap,
          stages: this.stages
            .filter((stage) => stage.roadmapId === roadmap.id)
            .sort((a, b) => a.position - b.position),
        })),
    );
  }

  findById(id: string): Promise<Roadmap | null> {
    return Promise.resolve(this.roadmaps.find((roadmap) => roadmap.id === id) ?? null);
  }

  create(data: NewRoadmap): Promise<Roadmap> {
    const roadmap: Roadmap = {
      id: `r${this.nextRoadmapId++}`,
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roadmaps.push(roadmap);
    return Promise.resolve(roadmap);
  }

  update(id: string, changes: RoadmapChanges): Promise<Roadmap> {
    const roadmap = this.roadmaps.find((item) => item.id === id);

    if (!roadmap) {
      throw new Error('roadmap não encontrado');
    }

    applyDefined(roadmap, changes);
    return Promise.resolve(roadmap);
  }

  delete(id: string): Promise<void> {
    this.roadmaps = this.roadmaps.filter((roadmap) => roadmap.id !== id);
    this.stages = this.stages.filter((stage) => stage.roadmapId !== id);
    return Promise.resolve();
  }

  listStages(roadmapId: string): Promise<RoadmapStage[]> {
    return Promise.resolve(
      this.stages
        .filter((stage) => stage.roadmapId === roadmapId)
        .sort((a, b) => a.position - b.position),
    );
  }

  findStageById(id: string): Promise<RoadmapStage | null> {
    return Promise.resolve(this.stages.find((stage) => stage.id === id) ?? null);
  }

  createStage(data: NewStage): Promise<RoadmapStage> {
    const stage: RoadmapStage = {
      id: `s${this.nextStageId++}`,
      roadmapId: data.roadmapId,
      title: data.title,
      description: data.description ?? null,
      goal: data.goal ?? null,
      points: data.points,
      status: data.status,
      position: data.position,
      dueDate: data.dueDate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stages.push(stage);
    return Promise.resolve(stage);
  }

  updateStage(id: string, changes: StageChanges): Promise<RoadmapStage> {
    const stage = this.stages.find((item) => item.id === id);

    if (!stage) {
      throw new Error('etapa não encontrada');
    }

    applyDefined(stage, changes);
    return Promise.resolve(stage);
  }

  deleteStage(id: string): Promise<void> {
    this.stages = this.stages.filter((stage) => stage.id !== id);
    return Promise.resolve();
  }

  applyStageOrder(orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, position) => {
      const stage = this.stages.find((item) => item.id === id);

      if (stage) {
        stage.position = position;
      }
    });
    return Promise.resolve();
  }
}

describe('RoadmapService', () => {
  let repository: FakeRoadmapRepository;
  let service: RoadmapService;

  beforeEach(() => {
    repository = new FakeRoadmapRepository();
    service = new RoadmapService(repository);
  });

  it('roadmap sem etapa tem progresso zero, e não divisão por zero', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    const [found] = await service.listFor('p1');

    expect(found?.progress).toBe(0);
    expect(roadmap.progress).toBe(0);
  });

  it('etapas com zero pontos cada mantêm o progresso em zero, mesmo havendo etapas', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    await service.addStage('p1', roadmap.id, { title: 'A', points: 0, status: 'DONE' });
    await service.addStage('p1', roadmap.id, { title: 'B', points: 0 });

    const [found] = await service.listFor('p1');

    expect(found?.progress).toBe(0);
  });

  it('pondera o progresso pelos pontos, e não pela contagem de etapas', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    await service.addStage('p1', roadmap.id, { title: 'Grande', points: 8, status: 'DONE' });
    await service.addStage('p1', roadmap.id, { title: 'Pequena A', points: 1 });
    await service.addStage('p1', roadmap.id, { title: 'Pequena B', points: 1 });

    const [found] = await service.listFor('p1');

    expect(found?.progress).toBe(80);
  });

  it('conta como concluído somente o que está DONE', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    await service.addStage('p1', roadmap.id, { title: 'A', points: 1, status: 'DONE' });
    await service.addStage('p1', roadmap.id, { title: 'B', points: 1, status: 'IN_PROGRESS' });

    const [found] = await service.listFor('p1');

    expect(found?.progress).toBe(50);
  });

  it('dá à etapa nova a última posição', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    await service.addStage('p1', roadmap.id, { title: 'A' });
    const second = await service.addStage('p1', roadmap.id, { title: 'B' });

    expect(second.position).toBe(1);
  });

  it('recusa reordenar com um id que não pertence ao roadmap', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });
    const first = await service.addStage('p1', roadmap.id, { title: 'A' });
    await service.addStage('p1', roadmap.id, { title: 'B' });

    await expect(
      service.reorderStages('p1', roadmap.id, [first.id, 'intruso']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa reordenar deixando etapa de fora', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });
    const stage = await service.addStage('p1', roadmap.id, { title: 'A' });

    await service.addStage('p1', roadmap.id, { title: 'B' });

    await expect(service.reorderStages('p1', roadmap.id, [stage.id])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mantém o prazo da etapa quando o campo não é enviado na atualização', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });
    const stage = await service.addStage('p1', roadmap.id, {
      title: 'A',
      dueDate: '2026-01-01T00:00:00.000Z',
    });

    const updated = await service.updateStage('p1', roadmap.id, stage.id, { title: 'A revisada' });

    expect(updated.dueDate).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('limpa o prazo da etapa quando o campo é enviado como null', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });
    const stage = await service.addStage('p1', roadmap.id, {
      title: 'A',
      dueDate: '2026-01-01T00:00:00.000Z',
    });

    const updated = await service.updateStage('p1', roadmap.id, stage.id, { dueDate: null });

    expect(updated.dueDate).toBeNull();
  });

  it('define o prazo da etapa quando enviada uma data', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });
    const stage = await service.addStage('p1', roadmap.id, { title: 'A' });

    const updated = await service.updateStage('p1', roadmap.id, stage.id, {
      dueDate: '2026-03-15T00:00:00.000Z',
    });

    expect(updated.dueDate).toEqual(new Date('2026-03-15T00:00:00.000Z'));
  });

  it('recusa mexer em roadmap de outro projeto', async () => {
    const roadmap = await service.create('p1', 'u1', { title: 'MVP' });

    await expect(service.remove('p2', roadmap.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.addStage('p2', roadmap.id, { title: 'Intrusa' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
