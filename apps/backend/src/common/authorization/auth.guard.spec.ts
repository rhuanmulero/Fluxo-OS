import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { Auth } from '../../modules/auth/better-auth/auth.config';

interface RequestShape {
  headers: Record<string, string>;
  user?: unknown;
}

function contextWith(request: RequestShape): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function authReturning(session: unknown): Auth {
  return {
    api: { getSession: () => Promise.resolve(session) },
  } as unknown as Auth;
}

describe('AuthGuard', () => {
  it('libera e anexa o usuário quando há sessão', async () => {
    const request: RequestShape = { headers: { cookie: 'sessao=abc' } };
    const user = { id: 'u1', name: 'Thiago', email: 'thiago@fluxo.local' };
    const guard = new AuthGuard(authReturning({ user }));

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });

  it('recusa quando não há sessão', async () => {
    const guard = new AuthGuard(authReturning(null));

    await expect(guard.canActivate(contextWith({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
