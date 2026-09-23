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

interface ColumnBody {
  id: string;
  status: string;
}

interface TaskBody {
  id: string;
  status: string;
}

interface WorkspaceMemberBody {
  userId: string;
  email: string;
}

interface ErrorBody {
  message: string;
}

describe('Tarefa (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;
  let todoColumnId: string;
  let doneColumnId: string;
  let taskId: string;

  const password = 'senha-de-teste-123';
  const owner = `task-owner-${Date.now()}@fluxo.local`;
  const member = `task-member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace de Tarefas' });

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
      .send({ name: 'Projeto de Tarefas' });

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

  it('cria a tarefa com o status da coluna', async () => {
    const columns = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie);

    const list = columns.body as ColumnBody[];

    todoColumnId = list.find((c) => c.status === 'TODO')?.id ?? '';
    doneColumnId = list.find((c) => c.status === 'DONE')?.id ?? '';

    const created = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Escrever a introdução',
        priority: 'HIGH',
        type: 'FEATURE',
      });

    expect(created.status).toBe(201);
    expect((created.body as TaskBody).status).toBe('TODO');
    taskId = (created.body as TaskBody).id;
  });

  it('muda o status ao mover o cartão', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${taskId}/move`)
      .set('Cookie', ownerCookie)
      .send({ columnId: doneColumnId, position: 0 });

    expect(response.status).toBe(200);
    expect((response.body as TaskBody).status).toBe('DONE');
  });

  it('filtra por prioridade', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks?priority=LOW`)
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  it('deixa o MEMBER criar tarefa sob microgerenciamento', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', memberCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Tarefa do membro',
        priority: 'LOW',
        type: 'BUG',
      });

    expect(response.status).toBe(201);
  });

  it('impede o MEMBER de criar tarefa sob gerenciamento hierárquico', async () => {
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/module-settings/TASKS`)
      .set('Cookie', ownerCookie)
      .send({ governance: 'HIERARCHICAL' });

    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', memberCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Não deveria entrar',
        priority: 'LOW',
        type: 'BUG',
      });

    expect(response.status).toBe(403);
  });

  it('ainda deixa o MEMBER mover cartão sob gerenciamento hierárquico', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${taskId}/move`)
      .set('Cookie', memberCookie)
      .send({ columnId: todoColumnId, position: 0 });

    expect(response.status).toBe(200);
  });

  it('recusa responsável de fora do projeto', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({
        kanbanColumnId: todoColumnId,
        title: 'Com responsável inválido',
        priority: 'LOW',
        type: 'BUG',
        assigneeId: '00000000-0000-4000-8000-000000000000',
      });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).message).toContain('participar do projeto');
  });
});
