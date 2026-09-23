import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/database/prisma.service';
import { EnvironmentVariables } from '../../../common/config/environment-variables';
import { MailerService } from '../../../common/mail/mailer.service';
import { createAuth } from './auth.config';

export const BETTER_AUTH = Symbol('BetterAuth');

export const betterAuthProvider: Provider = {
  provide: BETTER_AUTH,
  inject: [PrismaService, ConfigService, MailerService],
  useFactory: (
    prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
    mailer: MailerService,
  ) =>
    createAuth(
      prisma,
      {
        baseURL: config.get('BETTER_AUTH_URL', { infer: true }),
        secret: config.get('BETTER_AUTH_SECRET', { infer: true }),
        trustedOrigin: config.get('FRONTEND_URL', { infer: true }),
        production: process.env.NODE_ENV === 'production',
      },
      mailer,
    ),
};
