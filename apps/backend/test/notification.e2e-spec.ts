import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DeadlineScanner } from '../src/modules/notification/deadline-scanner.service';

interface IdBody {
  id: string;
}

interface ColumnBody {
  id: string;
  status: string;
}

interface MeBody {
  id: string;
}

interface NotificationBody {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId: string | null;
  readAt: string | null;
}

interface ErrorBody {
  message: string;
}

describe('Notificacao (e2e)', () => {
  let app: INestApplication;
  let scanner: DeadlineScanner;
  let ownerCookie: string;
  let projectId: string;
  let openColumnId: string;
  let doneColumnId: string;
  let ownerId: string;

  const password = 'senha-de-teste-123';
  const owner = `notification-owner-${Date.now()}@fluxo.local`;

  function inHours(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }

  async function createTask(title: string, dueDate: string, assigneeId?: string): Promise<string> {
    const task = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .send({
        title,
        kanbanColumnId: openColumnId,
        priority: 'MEDIUM',
        type: 'FEATURE',
        dueDate,
        ...(assigneeId ? { assigneeId } : {}),
      });

    return (task.body as IdBody).id;
  }

  function listNotifications(unreadOnly = false): request.Test {
    return request(app.getHttpServer())
      .get(`/api/me/notifications?unreadOnly=${unreadOnly}`)
      .set('Cookie', ownerCookie);
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

    scanner = app.get(DeadlineScanner);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name: 'Dono dos Avisos', email: owner, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: owner, password });

    ownerCookie = (signIn.get('Set-Cookie') ?? []).join('; ');

    const me = await request(app.getHttpServer()).get('/api/me').set('Cookie', ownerCookie);

    ownerId = (me.body as MeBody).id;

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace de Avisos' });

    const project = await request(app.getHttpServer())
      .post(`/api/workspaces/${(workspace.body as IdBody).id}/projects`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Projeto de Avisos' });

    projectId = (project.body as IdBody).id;

    const columns = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie);

    const list = columns.body as ColumnBody[];

    openColumnId = list.find((column) => column.status !== 'DONE')!.id;
    doneColumnId = list.find((column) => column.status === 'DONE')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('começa sem nenhum aviso', async () => {
    const response = await listNotifications();

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('a varredura cria o aviso da tarefa que vence dentro de 48 horas', async () => {
    const taskId = await createTask('Entregar a sprint I', inHours(24), ownerId);

    expect(await scanner.scan(new Date())).toBeGreaterThanOrEqual(1);

    const response = await listNotifications();
    const notifications = response.body as NotificationBody[];
    const created = notifications.find((notification) => notification.taskId === taskId);

    expect(created).toBeDefined();
    expect(created?.type).toBe('TASK_DUE_SOON');
    expect(created?.title).toBe('Prazo próximo');
    expect(created?.body).toContain('Entregar a sprint I');
    expect(created?.body).toContain('Projeto de Avisos');
    expect(created?.readAt).toBeNull();
  });

  it('duas varreduras seguidas produzem um aviso só', async () => {
    const before = ((await listNotifications()).body as NotificationBody[]).length;

    expect(await scanner.scan(new Date())).toBe(0);

    const after = ((await listNotifications()).body as NotificationBody[]).length;

    expect(after).toBe(before);
  });

  it('ignora tarefa fora da janela, sem responsável e em coluna concluída', async () => {
    await createTask('Vence semana que vem', inHours(24 * 7), ownerId);
    await createTask('Sem responsável', inHours(12));

    const concluida = await createTask('Já concluída', inHours(10), ownerId);

    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/tasks/${concluida}/move`)
      .set('Cookie', ownerCookie)
      .send({ columnId: doneColumnId, position: 0 });

    const before = ((await listNotifications()).body as NotificationBody[]).length;

    await scanner.scan(new Date());

    const notifications = (await listNotifications()).body as NotificationBody[];

    expect(notifications).toHaveLength(before);
    expect(notifications.some((item) => item.body.includes('Vence semana que vem'))).toBe(false);
    expect(notifications.some((item) => item.body.includes('Sem responsável'))).toBe(false);
    expect(notifications.some((item) => item.body.includes('Já concluída'))).toBe(false);
  });

  it('marcar como lida tira o aviso da lista de não lidas', async () => {
    const unreadBefore = (await listNotifications(true)).body as NotificationBody[];

    expect(unreadBefore.length).toBeGreaterThan(0);

    const [first] = unreadBefore;

    expect(first).toBeDefined();

    const marked = await request(app.getHttpServer())
      .patch(`/api/me/notifications/${first?.id}/read`)
      .set('Cookie', ownerCookie);

    expect(marked.status).toBe(200);
    expect((marked.body as NotificationBody).readAt).not.toBeNull();

    const unread = (await listNotifications(true)).body as NotificationBody[];

    expect(unread.some((item) => item.id === first?.id)).toBe(false);
  });

  it('marcar todas como lidas zera a lista de não lidas', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/me/notifications/read-all')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect((await listNotifications(true)).body).toEqual([]);
  });

  it('recusa marcar um aviso inexistente, com mensagem em português', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/me/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).message).toBe('Notificação não encontrada.');
  });

  it('recusa acesso sem sessão', async () => {
    const response = await request(app.getHttpServer()).get('/api/me/notifications');

    expect(response.status).toBe(401);
  });
});
