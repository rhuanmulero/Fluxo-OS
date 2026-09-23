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

interface BookmarkBody {
  id: string;
  name: string;
  folder: string;
  url: string;
  scope: string;
}

interface ErrorBody {
  message: string;
}

describe('Bookmarks (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;

  const password = 'senha-de-teste-123';
  const owner = `bookmark-owner-${Date.now()}@fluxo.local`;
  const member = `bookmark-member-${Date.now()}@fluxo.local`;

  async function signUpAndIn(name: string, email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name, email, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });

    return (signIn.get('Set-Cookie') ?? []).join('; ');
  }

  function create(cookie: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/bookmarks`)
      .set('Cookie', cookie)
      .send(body);
  }

  function list(cookie: string, query = ''): request.Test {
    return request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/bookmarks${query}`)
      .set('Cookie', cookie);
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

    ownerCookie = await signUpAndIn('Dono dos Links', owner);
    memberCookie = await signUpAndIn('Membro dos Links', member);

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace dos Links' });

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
      .send({ name: 'Projeto dos Links' });

    projectId = (project.body as IdBody).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, edita e exclui um link privado', async () => {
    const created = await create(ownerCookie, {
      name: 'Documentação do Nest',
      folder: 'Backend',
      url: 'https://docs.nestjs.com',
      scope: 'PRIVATE',
    }).expect(201);

    const id = (created.body as BookmarkBody).id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/bookmarks/${id}`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Nest oficial', folder: 'Referências' })
      .expect(200);

    expect((updated.body as BookmarkBody).name).toBe('Nest oficial');
    expect((updated.body as BookmarkBody).folder).toBe('Referências');

    await request(app.getHttpServer())
      .delete(`/api/workspaces/${workspaceId}/bookmarks/${id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    expect((await list(ownerCookie)).body).toEqual([]);
  });

  it('recusa endereço com protocolo javascript, em português', async () => {
    const response = await create(ownerCookie, {
      name: 'Ruim',
      folder: 'Links',
      url: 'javascript:alert(1)',
      scope: 'PRIVATE',
    }).expect(400);

    expect((response.body as ErrorBody).message).toBe(
      'Informe um endereço que comece com http:// ou https://.',
    );
  });

  it('exige projeto no escopo PROJECT e recusa projeto no escopo WORKSPACE', async () => {
    await create(ownerCookie, {
      name: 'Sem projeto',
      folder: 'Links',
      url: 'https://exemplo.com',
      scope: 'PROJECT',
    }).expect(400);

    await create(ownerCookie, {
      name: 'Com projeto demais',
      folder: 'Links',
      url: 'https://exemplo.com',
      scope: 'WORKSPACE',
      projectId,
    }).expect(400);
  });

  it('MEMBER não cria link de workspace; o dono cria e todos enxergam', async () => {
    await create(memberCookie, {
      name: 'Do membro',
      folder: 'Links',
      url: 'https://exemplo.com',
      scope: 'WORKSPACE',
    }).expect(403);

    await create(ownerCookie, {
      name: 'Manual público',
      folder: 'Institucional',
      url: 'https://fluxo.exemplo/manual',
      scope: 'WORKSPACE',
    }).expect(201);

    const doMembro = (await list(memberCookie)).body as BookmarkBody[];

    expect(doMembro.map((bookmark) => bookmark.name)).toEqual(['Manual público']);
  });

  it('a busca encontra por nome e por endereço, sem vazar o privado de terceiro', async () => {
    await create(ownerCookie, {
      name: 'Só meu',
      folder: 'Pessoal',
      url: 'https://segredo.exemplo',
      scope: 'PRIVATE',
    }).expect(201);

    const porNome = (await list(ownerCookie, '?q=Manual')).body as BookmarkBody[];
    const porEndereco = (await list(ownerCookie, '?q=segredo')).body as BookmarkBody[];
    const doMembro = (await list(memberCookie, '?q=segredo')).body as BookmarkBody[];

    expect(porNome.map((bookmark) => bookmark.name)).toEqual(['Manual público']);
    expect(porEndereco.map((bookmark) => bookmark.name)).toEqual(['Só meu']);
    expect(doMembro).toEqual([]);
  });

  it('link de projeto aparece para quem participa do projeto', async () => {
    const created = await create(ownerCookie, {
      name: 'Board do time',
      folder: 'Projeto',
      url: 'https://board.exemplo',
      scope: 'PROJECT',
      projectId,
    }).expect(201);

    expect((created.body as BookmarkBody).scope).toBe('PROJECT');

    const doMembro = (await list(memberCookie)).body as BookmarkBody[];

    expect(doMembro.some((bookmark) => bookmark.name === 'Board do time')).toBe(false);
  });
});
