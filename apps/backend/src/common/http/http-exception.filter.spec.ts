import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

interface CapturedResponse {
  status: number;
  body: unknown;
}

function hostWith(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
    },
  };

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/tasks/1' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  it('converte uma HttpException no envelope padrão', () => {
    const captured: CapturedResponse = { status: 0, body: null };

    new HttpExceptionFilter().catch(
      new NotFoundException('Tarefa não encontrada.'),
      hostWith(captured),
    );

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      statusCode: 404,
      error: 'NotFoundException',
      message: 'Tarefa não encontrada.',
    });
  });

  it('junta as mensagens do ValidationPipe em uma única string', () => {
    const captured: CapturedResponse = { status: 0, body: null };

    new HttpExceptionFilter().catch(
      new BadRequestException(['título é obrigatório', 'prioridade inválida']),
      hostWith(captured),
    );

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      statusCode: 400,
      error: 'BadRequestException',
      message: 'título é obrigatório; prioridade inválida',
    });
  });

  it('não vaza detalhe de erro desconhecido', () => {
    const captured: CapturedResponse = { status: 0, body: null };

    new HttpExceptionFilter().catch(
      new Error('conexão recusada em 10.0.0.7:5432'),
      hostWith(captured),
    );

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'Erro interno do servidor.',
    });
  });
});
