import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface IdBody {
  id: string;
}

interface ColumnBody {
  id: string;
  status: string;
}

interface DashboardBody {
  metrics: { completed: number; pending: number; overdue: number };
  todayTasks: Array<{ title: string }>;
  byProject: Array<{ projectId: string }>;
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let workspaceId: string;
  let projectId: string;
  let todoColumnId: string;
  let doneColumnId: string;

  const password = 'senha-de-teste-123';
  const owner = `dash-${Date.now()}@fluxo.local`;

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

    ownerCookie = await signUpAndIn('Dono do Dashboard', owner);

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace do Dashboard' });

    workspaceId = (workspace.body as IdBody).id;

    const project = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Projeto do Dashboard' });

    projectId = (project.body as IdBody).id;

    const columns = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie);

    const list = columns.body as ColumnBody[];
    todoColumnId = list.find((c) => c.status === 'TODO')?.id ?? '';
    doneColumnId = list.find((c) => c.status === 'DONE')?.id ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige sessão', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/workspaces/${workspaceId}/dashboard`,
    );

    expect(response.status).toBe(401);
  });

  it('conta pendentes e concluídas pelo status da coluna', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({ kanbanColumnId: todoColumnId, title: 'Pendente', priority: 'LOW', type: 'BUG' });

    const concluida = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Vai concluir',
        priority: 'LOW',
        type: 'BUG',
      });

    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${(concluida.body as IdBody).id}/move`)
      .set('Cookie', ownerCookie)
      .send({ columnId: doneColumnId, position: 0 });

    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/dashboard`)
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect((response.body as DashboardBody).metrics.completed).toBe(1);
    expect((response.body as DashboardBody).metrics.pending).toBe(1);
  });

  it('lista as tarefas com prazo para hoje', async () => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Entregar hoje',
        priority: 'HIGH',
        type: 'FEATURE',
        dueDate: hoje.toISOString(),
      });

    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/dashboard`)
      .set('Cookie', ownerCookie);

    const body = response.body as DashboardBody;

    expect(body.todayTasks).toHaveLength(1);
    expect(body.todayTasks[0]?.title).toBe('Entregar hoje');
  });

  it('filtra as métricas por projeto', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/dashboard?projectId=${projectId}`)
      .set('Cookie', ownerCookie);

    const body = response.body as DashboardBody;

    expect(response.status).toBe(200);
    expect(body.byProject).toHaveLength(1);
    expect(body.byProject[0]?.projectId).toBe(projectId);
  });
});
