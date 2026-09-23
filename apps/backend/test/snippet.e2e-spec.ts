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

interface SnippetBody {
  id: string;
  visibility: string;
  moderationStatus: string;
}

describe('Snippet (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let snippetId: string;

  const password = 'senha-de-teste-123';
  const owner = `snip-owner-${Date.now()}@fluxo.local`;
  const member = `snip-member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace de Snippets' });

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

  it('MEMBER cria snippet privado', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets`)
      .set('Cookie', memberCookie)
      .send({
        name: 'Fetch wrapper',
        folder: 'Frontend',
        language: 'JavaScript',
        code: 'export async function fetchApi() {}',
      });

    expect(response.status).toBe(201);
    expect((response.body as SnippetBody).visibility).toBe('PRIVATE');
    snippetId = (response.body as SnippetBody).id;
  });

  it('esconde o snippet privado do dono do workspace', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/snippets`)
      .set('Cookie', ownerCookie);

    expect((response.body as SnippetBody[]).map((s) => s.id)).not.toContain(snippetId);
  });

  it('publica após pedido e aprovação', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets/${snippetId}/publish-request`)
      .set('Cookie', memberCookie);

    const approved = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets/${snippetId}/review`)
      .set('Cookie', ownerCookie)
      .send({ approve: true });

    expect(approved.status).toBe(201);
    expect((approved.body as SnippetBody).visibility).toBe('PUBLIC');

    const visible = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/snippets`)
      .set('Cookie', ownerCookie);

    expect((visible.body as SnippetBody[]).map((s) => s.id)).toContain(snippetId);
  });

  it('impede um MEMBER de moderar', async () => {
    const outro = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets`)
      .set('Cookie', memberCookie)
      .send({ name: 'Outro', folder: 'Backend', language: 'SQL', code: 'SELECT 1;' });

    const outroId = (outro.body as IdBody).id;

    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets/${outroId}/publish-request`)
      .set('Cookie', memberCookie);

    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets/${outroId}/review`)
      .set('Cookie', memberCookie)
      .send({ approve: true });

    expect(response.status).toBe(403);
  });

  it('mostra ao ADMIN o snippet que pediu publicação, para que possa moderar', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/snippets?q=SELECT`)
      .set('Cookie', ownerCookie);

    expect((response.body as SnippetBody[]).map((s) => s.moderationStatus)).toEqual([
      'PENDING',
    ]);
  });

  it('busca por termo sem vazar snippet privado alheio que não pediu publicação', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/snippets`)
      .set('Cookie', memberCookie)
      .send({
        name: 'Rascunho',
        folder: 'Backend',
        language: 'Bash/Shell',
        code: 'echo segredoprivadoquenaosaidaqui',
      });

    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/snippets?q=segredoprivadoquenaosaidaqui`)
      .set('Cookie', ownerCookie);

    expect(response.body).toHaveLength(0);
  });
});
