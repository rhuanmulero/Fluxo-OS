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
  position: number;
}

interface ErrorBody {
  message: string;
}

describe('Kanban (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let workspaceId: string;
  let projectId: string;

  const password = 'senha-de-teste-123';
  const owner = `kanban-${Date.now()}@fluxo.local`;

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

    ownerCookie = await signUpAndIn('Dono do Kanban', owner);

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace do Kanban' });

    workspaceId = (workspace.body as IdBody).id;

    const project = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Quadro do TCC' });

    projectId = (project.body as IdBody).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('acrescenta coluna no fim do quadro', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Em Revisão', status: 'IN_PROGRESS', color: '#a855f7' });

    expect(response.status).toBe(201);
    expect((response.body as ColumnBody).position).toBe(3);
  });

  it('reordena o quadro', async () => {
    const columns = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie);

    const ids = (columns.body as ColumnBody[]).map((c) => c.id).reverse();

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/columns/order`)
      .set('Cookie', ownerCookie)
      .send({ orderedIds: ids });

    expect(response.status).toBe(200);
    expect((response.body as ColumnBody[]).map((c) => c.id)).toEqual(ids);
  });

  it('recusa status inválido com mensagem em português', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Inválida', status: 'PARADO' });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).message).toContain('TODO, IN_PROGRESS ou DONE');
  });
});
