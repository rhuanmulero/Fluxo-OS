import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface SummaryBody {
  completedCycles: number;
  focusMinutes: number;
}

describe('Pomodoro (e2e)', () => {
  let app: INestApplication;
  let cookie: string;

  const password = 'senha-de-teste-123';
  const email = `pomo-${Date.now()}@fluxo.local`;

  async function signUpAndIn(name: string, address: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name, email: address, password });

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: address, password });

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

    cookie = await signUpAndIn('Focado', email);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra um ciclo concluído', async () => {
    const startedAt = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const endedAt = new Date().toISOString();

    const response = await request(app.getHttpServer())
      .post('/api/pomodoro/sessions')
      .set('Cookie', cookie)
      .send({ mode: 'FOCUS', startedAt, endedAt, durationMinutes: 25 });

    expect(response.status).toBe(201);
  });

  it('resume os ciclos do usuário', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/pomodoro/summary')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect((response.body as SummaryBody).completedCycles).toBe(1);
    expect((response.body as SummaryBody).focusMinutes).toBe(25);
  });

  it('não mostra a sessão de um usuário a outro', async () => {
    const outro = `outro-pomo-${Date.now()}@fluxo.local`;
    const outroCookie = await signUpAndIn('Outro', outro);

    const response = await request(app.getHttpServer())
      .get('/api/pomodoro/sessions')
      .set('Cookie', outroCookie);

    expect(response.body).toHaveLength(0);
  });

  it('recusa duração incompatível', async () => {
    const startedAt = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const endedAt = new Date().toISOString();

    const response = await request(app.getHttpServer())
      .post('/api/pomodoro/sessions')
      .set('Cookie', cookie)
      .send({ mode: 'FOCUS', startedAt, endedAt, durationMinutes: 90 });

    expect(response.status).toBe(400);
  });
});
