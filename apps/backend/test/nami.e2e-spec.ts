import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GeminiService } from '../src/modules/nami/gemini.service';
import { PrismaService } from '../src/common/database/prisma.service';

interface ConversationBody { id: string; messages: { role: string; content: string }[] }

describe('Nami (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let otherCookie: string;
  let id: string;
  const emails: string[] = [];
  const gemini = { reply: jest.fn().mockResolvedValue('Olá! Posso ajudar.') };
  const key = 'chave-ficticia-apenas-para-teste';
  const settings = { apiKey: key, model: 'gemini-test' };
  beforeAll(async () => {
    process.env.NAMI_ENCRYPTION_KEY ??= 'ab'.repeat(32);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(GeminiService).useValue(gemini).compile();
    app = module.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    app.use((req: Request, res: Response, next: NextFunction) => req.originalUrl.startsWith('/api/auth') ? next() : json()(req, res, next));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    const signup = async (label: string) => {
      const email = `nami-${label}-${Date.now()}@fluxo.local`;
      emails.push(email);
      await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({ name: 'Nami Teste', email, password: 'senha-de-teste-123' }).expect(200);
      const response = await request(app.getHttpServer()).post('/api/auth/sign-in/email').send({ email, password: 'senha-de-teste-123' }).expect(200);
      return (response.get('Set-Cookie') ?? []).join('; ');
    };
    cookie = await signup('a'); otherCookie = await signup('b');
  });
  afterAll(async () => {
    if (app) {
      await app.get(PrismaService).user.deleteMany({ where: { email: { in: emails } } });
      await app.close();
    }
  });
  it('exige autenticação e chave configurada', async () => {
    await request(app.getHttpServer()).get('/api/me/nami/settings').expect(401);
    await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', cookie).send({ message: 'Olá' }).expect(400);
  });
  it('salva configuração sem devolver a chave e cifra o valor no banco', async () => {
    const response = await request(app.getHttpServer()).put('/api/me/nami/settings').set('Cookie', cookie).send(settings).expect(200);
    expect(response.body as unknown).toEqual({ configured: true, model: 'gemini-test' });
    const saved = await app.get(PrismaService).namiSettings.findFirst({ where: { user: { email: emails[0] } } });
    expect(saved?.encryptedKey).not.toContain(key);
    await request(app.getHttpServer()).put('/api/me/nami/settings').set('Cookie', cookie).send({ model: 'gemini-test' }).expect(200);
  });
  it('salva pares de mensagens e envia o histórico ao Gemini', async () => {
    const response = await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', cookie).send({ message: 'Olá' }).expect(201);
    const body = response.body as ConversationBody;
    id = body.id;
    expect(body.messages.map(message => message.role)).toEqual(['user', 'model']);
    await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', cookie).send({ message: 'Continue', conversationId: id }).expect(201);
    expect(gemini.reply).toHaveBeenLastCalledWith(key, 'gemini-test', [{ role: 'user', content: 'Olá' }, { role: 'model', content: 'Olá! Posso ajudar.' }, { role: 'user', content: 'Continue' }]);
  });
  it('isola histórico, consulta, envio e exclusão entre usuários', async () => {
    const list = await request(app.getHttpServer()).get('/api/me/nami/conversations').set('Cookie', otherCookie).expect(200);
    expect(list.body as unknown).toEqual([]);
    await request(app.getHttpServer()).get(`/api/me/nami/conversations/${id}`).set('Cookie', otherCookie).expect(404);
    await request(app.getHttpServer()).delete(`/api/me/nami/conversations/${id}`).set('Cookie', otherCookie).expect(404);
    await request(app.getHttpServer()).put('/api/me/nami/settings').set('Cookie', otherCookie).send(settings).expect(200);
    await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', otherCookie).send({ conversationId: id, message: 'Indevido' }).expect(404);
  });
  it('rejeita mensagens vazias e não salva interação quando o provedor falha', async () => {
    await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', cookie).send({ message: '   ' }).expect(400);
    gemini.reply.mockRejectedValueOnce(new Error('falha simulada'));
    await request(app.getHttpServer()).post('/api/me/nami/messages').set('Cookie', cookie).send({ conversationId: id, message: 'Falha' }).expect(500);
    const conversation = await request(app.getHttpServer()).get(`/api/me/nami/conversations/${id}`).set('Cookie', cookie).expect(200);
    expect((conversation.body as ConversationBody).messages).toHaveLength(4);
  });
  it('remove chave mantendo histórico e permite excluir conversa', async () => {
    await request(app.getHttpServer()).delete('/api/me/nami/settings').set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).get(`/api/me/nami/conversations/${id}`).set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).delete(`/api/me/nami/conversations/${id}`).set('Cookie', cookie).expect(204);
    await request(app.getHttpServer()).get(`/api/me/nami/conversations/${id}`).set('Cookie', cookie).expect(404);
  });
});
