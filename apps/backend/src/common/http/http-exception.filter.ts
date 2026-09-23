import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const envelope = this.describe(exception);

    if (envelope.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const request = http.getRequest<Request>();
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Falha não tratada em ${request.url}`, stack);
    }

    http.getResponse<Response>().status(envelope.statusCode).json(envelope);
  }

  private describe(exception: unknown): ErrorEnvelope {
    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        error: exception.constructor.name,
        message: this.messageOf(exception),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Erro interno do servidor.',
    };
  }

  private messageOf(exception: HttpException): string {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return payload;
    }

    const message = (payload as { message?: string | string[] }).message;

    if (Array.isArray(message)) {
      return message.join('; ');
    }

    return message ?? exception.message;
  }
}
