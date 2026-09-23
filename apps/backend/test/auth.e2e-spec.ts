import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from '../src/app.module';

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  const email = `teste-${Date.now()}@fluxo.local`;
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('cadastra um usuário', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ name: 'Usuário de Teste', email, password });

    expect(response.status).toBe(200);
  });

  it('autentica e devolve cookie de sessão httpOnly', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });

    expect(response.status).toBe(200);

    const cookies = response.get('Set-Cookie') ?? [];
    expect(cookies.join(';')).toMatch(/HttpOnly/i);
  });

  it('recusa senha errada', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'senha-errada' });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
