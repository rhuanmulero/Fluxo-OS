import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface IdBody {
  id: string;
}

interface CodeBody {
  code: string;
}

interface WorkspaceMemberBody {
  userId: string;
  email: string;
}

interface RoadmapBody {
  id: string;
  progress: number;
  stages: StageBody[];
}

interface StageBody {
  id: string;
  position: number;
}

interface NewStage {
  title: string;
  points: number;
  status?: string;
}

describe('Metas (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;

  const password = 'senha-de-teste-123';
  const owner = `roadmap-owner-${Date.now()}@fluxo.local`;
  const member = `roadmap-member-${Date.now()}@fluxo.local`;

  async function signUpAndIn(name: string, email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name, email, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });

    return (signIn.get('Set-Cookie') ?? []).join('; ');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    app.use((req: Request, res: Response, next: NextFunction) =>
      req.originalUrl.startsWith('/api/auth')
        ? next()
        : json({ limit: '1mb' })(req, res, next),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();

    ownerCookie = await signUpAndIn('Dono', owner);
    memberCookie = await signUpAndIn('Membro', member);

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace das Metas' });

    workspaceId = (workspace.body as IdBody).id;

    const invite = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/invites`)
      .set('Cookie', ownerCookie)
      .send({ role: 'MEMBER' });

    await request(app.getHttpServer())
      .post(`/api/invites/${(invite.body as CodeBody).code}/accept`)
      .set('Cookie', memberCookie);

    const project = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Projeto das Metas' });

    projectId = (project.body as IdBody).id;

    const members = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', ownerCookie);

    const target = (members.body as WorkspaceMemberBody[]).find((m) => m.email === member);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Cookie', ownerCookie)
      .send({ userId: target?.userId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite ao MEMBER atualizar etapa e nega criar e excluir sob o paradigma hierárquico', async () => {
    const roadmap = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps`)
      .set('Cookie', ownerCookie)
      .send({ title: 'MVP' })
      .expect(201);

    const roadmapId = (roadmap.body as IdBody).id;

    const stage = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Autenticação', points: 3 })
      .expect(201);

    const stageId = (stage.body as IdBody).id;

    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages/${stageId}`)
      .set('Cookie', memberCookie)
      .send({ status: 'DONE' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages`)
      .set('Cookie', memberCookie)
      .send({ title: 'Proibida' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages/${stageId}`)
      .set('Cookie', memberCookie)
      .expect(403);
  });

  it('calcula o progresso ponderado na resposta', async () => {
    const roadmap = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Pesos' })
      .expect(201);

    const roadmapId = (roadmap.body as IdBody).id;

    const stages: NewStage[] = [
      { title: 'A', points: 3, status: 'DONE' },
      { title: 'B', points: 1 },
    ];

    for (const stage of stages) {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages`)
        .set('Cookie', ownerCookie)
        .send(stage)
        .expect(201);
    }

    const list = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/roadmaps`)
      .set('Cookie', ownerCookie)
      .expect(200);

    const found = (list.body as RoadmapBody[]).find((r) => r.id === roadmapId);

    expect(found?.progress).toBe(75);
  });

  it('trata "stages/order" como reordenação, não como um stageId', async () => {
    const roadmap = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Ordem' })
      .expect(201);

    const roadmapId = (roadmap.body as IdBody).id;

    const first = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Primeira' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Segunda' })
      .expect(201);

    const firstId = (first.body as IdBody).id;
    const secondId = (second.body as IdBody).id;

    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/roadmaps/${roadmapId}/stages/order`)
      .set('Cookie', ownerCookie)
      .send({ orderedIds: [secondId, firstId] })
      .expect(204);

    const list = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/roadmaps`)
      .set('Cookie', ownerCookie)
      .expect(200);

    const found = (list.body as RoadmapBody[]).find((r) => r.id === roadmapId);
    const stages = found?.stages ?? [];
    const bySecond = stages.find((s) => s.id === secondId);
    const byFirst = stages.find((s) => s.id === firstId);

    expect(bySecond?.position).toBe(0);
    expect(byFirst?.position).toBe(1);
  });
});
