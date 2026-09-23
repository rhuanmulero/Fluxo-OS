import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface WorkspaceBody {
  id: string;
}

interface MemberBody {
  role: string;
}

interface ErrorBody {
  message: string;
}

describe('Workspace (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let workspaceId: string;

  const email = `ws-${Date.now()}@fluxo.local`;
  const password = 'senha-de-teste-123';

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

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name: 'Dono', email, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });

    cookie = (signIn.get('Set-Cookie') ?? []).join('; ');
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa acesso sem sessão', async () => {
    const response = await request(app.getHttpServer()).get('/api/workspaces');

    expect(response.status).toBe(401);
  });

  it('cria o workspace com o criador como OWNER', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', cookie)
      .send({ name: 'Equipe do TCC' });

    expect(created.status).toBe(201);
    workspaceId = (created.body as WorkspaceBody).id;

    const members = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', cookie);

    const list = members.body as MemberBody[];

    expect(members.status).toBe(200);
    expect(list).toHaveLength(1);
    expect(list[0]?.role).toBe('OWNER');
  });

  it('rejeita campo não declarado no DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', cookie)
      .send({ name: 'Outro', isAdmin: true });

    expect(response.status).toBe(400);
  });

  it('rejeita nome curto com mensagem em português', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', cookie)
      .send({ name: 'ab' });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).message).toContain('ao menos 3 caracteres');
  });

  it('esconde workspace de quem não é membro', async () => {
    const outro = `outro-${Date.now()}@fluxo.local`;

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name: 'Outro', email: outro, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: outro, password });

    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', (signIn.get('Set-Cookie') ?? []).join('; '));

    expect(response.status).toBe(404);
  });
});
