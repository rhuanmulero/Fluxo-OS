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
  position: number;
}

interface ModuleSettingBody {
  module: string;
  governance: string;
  configurable: boolean;
}

interface WorkspaceMemberBody {
  userId: string;
  email: string;
}

interface ErrorBody {
  message: string;
}

describe('Projeto (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;

  const password = 'senha-de-teste-123';
  const owner = `owner-${Date.now()}@fluxo.local`;
  const member = `member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace de Projetos' });

    workspaceId = (workspace.body as IdBody).id;

    const invite = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/invites`)
      .set('Cookie', ownerCookie)
      .send({ role: 'MEMBER' });

    await request(app.getHttpServer())
      .post(`/api/invites/${(invite.body as CodeBody).code}/accept`)
      .set('Cookie', memberCookie);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria o projeto com colunas padrão e configuração dos módulos', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', ownerCookie)
      .send({ name: 'API Backend' });

    expect(created.status).toBe(201);
    projectId = (created.body as IdBody).id;

    const columns = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', ownerCookie);

    const list = columns.body as ColumnBody[];

    expect(list).toHaveLength(3);
    expect(list.map((c) => c.status)).toEqual(['TODO', 'IN_PROGRESS', 'DONE']);

    const settings = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/module-settings`)
      .set('Cookie', ownerCookie);

    const settingsBody = settings.body as ModuleSettingBody[];

    expect(settingsBody.map((s) => s.module).sort()).toEqual([
      'AGENDA',
      'BOOKMARKS',
      'HABITS',
      'KANBAN',
      'NOTES',
      'POMODORO',
      'ROADMAP',
      'SNIPPETS',
      'TASKS',
      'VAULT',
    ]);
    expect(settingsBody.filter((s) => s.configurable).map((s) => s.module).sort()).toEqual([
      'BOOKMARKS',
      'KANBAN',
      'ROADMAP',
      'TASKS',
      'VAULT',
    ]);
  });

  it('impede um MEMBER de criar projeto no workspace', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set('Cookie', memberCookie)
      .send({ name: 'Não deveria existir' });

    expect(response.status).toBe(403);
  });

  it('esconde o projeto de um MEMBER que não participa dele', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', memberCookie);

    expect(response.status).toBe(404);
  });

  it('libera o MEMBER depois de adicionado ao projeto', async () => {
    const members = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', ownerCookie);

    const target = (members.body as WorkspaceMemberBody[]).find((m) => m.email === member);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Cookie', ownerCookie)
      .send({ userId: target?.userId });

    const response = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/columns`)
      .set('Cookie', memberCookie);

    expect(response.status).toBe(200);
  });

  it('recusa reconfigurar um módulo de regra fixa', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/module-settings/NOTES`)
      .set('Cookie', ownerCookie)
      .send({ governance: 'HIERARCHICAL' });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).message).toContain('regra de negócio fixa');
  });
});
