import { IncomingMessage, ServerResponse } from 'node:http';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { Auth } from './better-auth/auth.config';
import { BETTER_AUTH } from './better-auth/auth.handler';

@Controller('auth')
export class AuthController {
  private readonly handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

  constructor(@Inject(BETTER_AUTH) auth: Auth) {
    this.handler = toNodeHandler(auth);
  }

  @All('*path')
  async handle(@Req() req: IncomingMessage, @Res() res: ServerResponse): Promise<void> {
    await this.handler(req, res);
  }
}
