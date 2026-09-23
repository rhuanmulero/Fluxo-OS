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

describe('Hábitos (e2e)', () => {
  let app: INestApplication;
  let ownerCookie: string;
  let memberCookie: string;
  let workspaceId: string;

  const password = 'senha-de-teste-123';
  const owner = `habit-owner-${Date.now()}@fluxo.local`;
  const member = `habit-member-${Date.now()}@fluxo.local`;

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
      .send({ name: 'Workspace dos Hábitos' });

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

  it('marca, desmarca e não duplica o log do dia', async () => {
    const habit = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/habits`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Ler 20 páginas' })
      .expect(201);

    const habitId = (habit.body as IdBody).id;

    await request(app.getHttpServer())
      .put(`/api/workspaces/${workspaceId}/habits/${habitId}/logs/2026-09-08`)
      .set('Cookie', ownerCookie)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/workspaces/${workspaceId}/habits/${habitId}/logs/2026-09-08`)
      .set('Cookie', ownerCookie)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/habits/${habitId}/logs?from=2026-09-01&to=2026-09-30`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));

    await request(app.getHttpServer())
      .delete(`/api/workspaces/${workspaceId}/habits/${habitId}/logs/2026-09-08`)
      .set('Cookie', ownerCookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/habits/${habitId}/logs?from=2026-09-01&to=2026-09-30`)
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(0));
  });

  it('não deixa um membro ver nem marcar o hábito de outro', async () => {
    const habit = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/habits`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Meditar' })
      .expect(201);

    const habitId = (habit.body as IdBody).id;

    await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/habits`)
      .set('Cookie', memberCookie)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(0));

    await request(app.getHttpServer())
      .put(`/api/workspaces/${workspaceId}/habits/${habitId}/logs/2026-09-08`)
      .set('Cookie', memberCookie)
      .send({})
      .expect(404);
  });

  it('recusa data fora do formato AAAA-MM-DD com 400', async () => {
    const habit = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/habits`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Correr' })
      .expect(201);

    const habitId = (habit.body as IdBody).id;

    await request(app.getHttpServer())
      .put(`/api/workspaces/${workspaceId}/habits/${habitId}/logs/08-09-2026`)
      .set('Cookie', ownerCookie)
      .send({})
      .expect(400);
  });
});
