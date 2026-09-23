import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { Auth } from '../../modules/auth/better-auth/auth.config';
import { BETTER_AUTH } from '../../modules/auth/better-auth/auth.handler';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    request.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };

    return true;
  }
}
