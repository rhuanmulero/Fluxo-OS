import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DiskFileStorage } from '../src/common/storage/disk-file-storage';
import { FILE_STORAGE } from '../src/common/storage/file-storage';

interface IdBody {
  id: string;
}

interface CodeBody {
  code: string;
}

interface DocumentBody {
  id: string;
  name: string;
  folder: string;
  scope: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface ErrorBody {
  message: string;
}

describe('Vault (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;

  const root = join(tmpdir(), `fluxo-vault-e2e-${randomUUID()}`);
  const password = 'senha-de-teste-123';
  const owner = `vault-owner-${Date.now()}@fluxo.local`;
  const member = `vault-member-${Date.now()}@fluxo.local`;

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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FILE_STORAGE)
      .useValue(new DiskFileStorage(root))
      .compile();

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

    ownerCookie = await signUpAndIn('Dono do Vault', owner);
    memberCookie = await signUpAndIn('Membro do Vault', member);

    const workspace = await request(app.getHttpServer())
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: 'Workspace do Vault' });

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
    await rm(root, { recursive: true, force: true });
  });

  it('envia um PDF, devolve os metadados e não devolve a chave de armazenamento', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie)
      .field('name', 'Arquitetura')
      .field('folder', 'Docs')
      .field('scope', 'PRIVATE')
      .attach('file', Buffer.from('conteudo do pdf'), {
        filename: 'arquitetura.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const body = response.body as DocumentBody;

    expect(body.name).toBe('Arquitetura');
    expect(body.fileName).toBe('arquitetura.pdf');
    expect(body.sizeBytes).toBe(15);
    expect(Object.keys(body)).not.toContain('storageKey');
    expect(JSON.stringify(body)).not.toContain(root);
  });

  it('grava o arquivo sob o diretório do workspace, com nome em UUID', async () => {
    const files = await readdir(join(root, workspaceId));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(file).toMatch(/^[0-9a-f-]{36}\.[a-z0-9]+$/);
    }
  });

  it('baixa o documento com o nome original no cabeçalho', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie);

    const [document] = list.body as DocumentBody[];

    expect(document).toBeDefined();

    const download = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents/${document?.id}/download`)
      .set('Cookie', ownerCookie)
      .expect(200);

    expect(download.headers['content-disposition']).toContain('arquitetura.pdf');
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(download.body as Buffer).toString()).toBe('conteudo do pdf');
  });

  it('recusa tipo fora da lista com 415 e mensagem em português', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie)
      .field('name', 'Binário')
      .field('folder', 'Docs')
      .field('scope', 'PRIVATE')
      .attach('file', Buffer.from('MZ'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(415);

    expect((response.body as ErrorBody).message).toBe('Tipo de arquivo não aceito no Vault.');
  });

  it('recusa arquivo acima de 10 MB com 413', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie)
      .field('name', 'Grande')
      .field('folder', 'Docs')
      .field('scope', 'PRIVATE')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(413);
  });

  it('recusa MEMBER criando documento de workspace', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', memberCookie)
      .field('name', 'Política')
      .field('folder', 'Docs')
      .field('scope', 'WORKSPACE')
      .attach('file', Buffer.from('politica'), {
        filename: 'politica.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });

  it('esconde o documento privado de outra pessoa na listagem e no download', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect(list.body).toEqual([]);

    const doOwner = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie);

    const [document] = doOwner.body as DocumentBody[];

    expect(document).toBeDefined();

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents/${document?.id}/download`)
      .set('Cookie', memberCookie)
      .expect(404);
  });

  it('a busca não abre acesso a documento privado de terceiro', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents?q=Arquitetura`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('documento de workspace criado pelo ADMIN aparece para o membro', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie)
      .field('name', 'Manual da Guilda')
      .field('folder', 'Institucional')
      .field('scope', 'WORKSPACE')
      .attach('file', Buffer.from('manual'), {
        filename: 'manual.md',
        contentType: 'text/markdown',
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', memberCookie)
      .expect(200);

    const names = (list.body as DocumentBody[]).map((document) => document.name);

    expect(names).toEqual(['Manual da Guilda']);
  });

  it('excluir tira da lista e apaga o arquivo do disco', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/documents`)
      .set('Cookie', ownerCookie);

    const alvo = (list.body as DocumentBody[]).find(
      (document) => document.name === 'Manual da Guilda',
    );

    const before = await readdir(join(root, workspaceId));

    await request(app.getHttpServer())
      .delete(`/api/workspaces/${workspaceId}/documents/${alvo?.id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    const after = await readdir(join(root, workspaceId));

    expect(after.length).toBe(before.length - 1);
  });
});
