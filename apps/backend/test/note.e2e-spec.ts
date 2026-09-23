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

interface NoteBody {
  id: string;
  visibility: string;
}

interface WorkspaceMemberBody {
  userId: string;
  email: string;
}

interface ErrorBody {
  message: string;
}

describe('Nota (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;
  let noteId: string;

  const password = 'senha-de-teste-123';
  const owner = `note-owner-${Date.now()}@fluxo.local`;
  const member = `note-member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace de Notas' });

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
      .send({ name: 'Projeto de Notas' });

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

  it('cria a nota privada', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/notes`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Decisões', body: 'Prisma como ORM.', projectId });

    expect(response.status).toBe(201);
    expect((response.body as NoteBody).visibility).toBe('PRIVATE');
    noteId = (response.body as NoteBody).id;
  });

  it('esconde a nota privada de outro membro', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/notes`)
      .set('Cookie', memberCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  it('mostra a nota depois de publicada no projeto', async () => {
    await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/notes/${noteId}/visibility`)
      .set('Cookie', ownerCookie)
      .send({ visibility: 'PROJECT' });

    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/notes`)
      .set('Cookie', memberCookie);

    expect(response.body).toHaveLength(1);
  });

  it('impede outro membro de editar a nota publicada', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/notes/${noteId}`)
      .set('Cookie', memberCookie)
      .send({ title: 'Sequestrada' });

    expect(response.status).toBe(403);
  });

  it('recusa corpo acima de 7000 caracteres', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/notes`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Longa', body: 'a'.repeat(7001) });

    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).message).toContain('7000');
  });

  it('a busca encontra pelo corpo e não vaza nota privada de terceiro', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/notes`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Reuniao', body: 'combinamos a arquitetura hexagonal' })
      .expect(201);

    const porCorpo = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/notes?q=hexagonal`)
      .set('Cookie', ownerCookie)
      .expect(200);

    expect((porCorpo.body as { title: string }[]).map((note) => note.title)).toEqual(['Reuniao']);

    const doMembro = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/notes?q=hexagonal`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect(doMembro.body).toEqual([]);
  });
});
