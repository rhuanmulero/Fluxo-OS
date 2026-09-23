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

interface WorkspaceMemberBody {
  userId: string;
  email: string;
}

interface EventBody {
  id: string;
  title: string;
  participants: { id: string; name: string }[];
}

interface ErrorBody {
  message: string;
}

describe('Agenda (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;
  let projectId: string;
  let memberId: string;

  const password = 'senha-de-teste-123';
  const owner = `event-owner-${Date.now()}@fluxo.local`;
  const member = `event-member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace da Agenda' });

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
      .send({ name: 'Projeto da Agenda' });

    projectId = (project.body as IdBody).id;

    const members = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/members`)
      .set('Cookie', ownerCookie);

    const target = (members.body as WorkspaceMemberBody[]).find((m) => m.email === member);

    memberId = target?.userId ?? '';

    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set('Cookie', ownerCookie)
      .send({ userId: target?.userId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, publica para o projeto e deixa o time enxergar', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Planning', startsAt: '2026-09-10T14:00:00.000Z', projectId })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', memberCookie)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(0));

    await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/events/${(created.body as IdBody).id}/visibility`)
      .set('Cookie', ownerCookie)
      .send({ visibility: 'PROJECT' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', memberCookie)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));
  });

  it('recusa término antes do início com 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Impossível',
        startsAt: '2026-09-10T14:00:00.000Z',
        endsAt: '2026-09-10T13:00:00.000Z',
      })
      .expect(400);
  });

  it('recusa exclusão por quem não é o autor com 403', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Meu', startsAt: '2026-09-10T14:00:00.000Z' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/workspaces/${workspaceId}/events/${(created.body as IdBody).id}`)
      .set('Cookie', memberCookie)
      .expect(403);
  });

  it('participante enxerga o evento privado em que foi incluído', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Conversa reservada',
        startsAt: '2026-09-12T14:00:00.000Z',
        participantIds: [memberId],
      })
      .expect(201);

    const body = created.body as EventBody;

    expect(body.participants).toHaveLength(1);
    expect(body.participants[0]?.id).toBe(memberId);

    const doParticipante = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', memberCookie)
      .expect(200);

    const events = doParticipante.body as EventBody[];

    expect(events.some((event) => event.id === body.id)).toBe(true);
  });

  it('tirar o participante some com o evento da agenda dele', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Convite revogado',
        startsAt: '2026-09-13T14:00:00.000Z',
        participantIds: [memberId],
      })
      .expect(201);

    const eventId = (created.body as EventBody).id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/workspaces/${workspaceId}/events/${eventId}`)
      .set('Cookie', ownerCookie)
      .send({ participantIds: [] })
      .expect(200);

    expect((updated.body as EventBody).participants).toHaveLength(0);

    const doParticipante = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect((doParticipante.body as EventBody[]).some((event) => event.id === eventId)).toBe(
      false,
    );
  });

  it('recusa participante de fora do workspace com mensagem em português', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Convite indevido',
        startsAt: '2026-09-14T14:00:00.000Z',
        participantIds: ['pessoa-de-fora'],
      })
      .expect(400);

    expect((response.body as ErrorBody).message).toBe(
      'Só é possível convidar membros deste workspace.',
    );
  });
});
