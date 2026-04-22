import { IncomingMessage, ServerResponse } from 'node:http';
import { All, Controller, Req, Res } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { createAuthHandler } from './better-auth/auth.handler';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @All('*')
  async handler(
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const authHandler = createAuthHandler(this.prisma);
    await authHandler(req, res);
  }
}
