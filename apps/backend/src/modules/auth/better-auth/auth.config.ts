import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../../../common/database/prisma.service';
import { MailerService } from '../../../common/mail/mailer.service';

const RESET_PASSWORD_TOKEN_SECONDS = 3600;

export interface AuthSettings {
  baseURL: string;
  secret: string;
  trustedOrigin: string;
  production: boolean;
}

function resetPasswordHtml(name: string, url: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111111; line-height: 1.6;">
      <p>Olá, ${name}.</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Fluxo.</p>
      <p><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111111;color:#ffffff;text-decoration:none;">Definir nova senha</a></p>
      <p>O link vale por uma hora. Se você não pediu isso, ignore esta mensagem: nada muda.</p>
    </div>
  `;
}

function resetPasswordText(name: string, url: string): string {
  return [
    `Olá, ${name}.`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no Fluxo.',
    `Abra este endereço para definir uma nova senha: ${url}`,
    '',
    'O link vale por uma hora. Se você não pediu isso, ignore esta mensagem.',
  ].join('\n');
}

export function createAuth(
  prisma: PrismaService,
  settings: AuthSettings,
  mailer: MailerService,
) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    basePath: '/api/auth',
    baseURL: settings.baseURL,
    secret: settings.secret,
    trustedOrigins: [settings.trustedOrigin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          subject: 'Redefinir sua senha no Fluxo',
          html: resetPasswordHtml(user.name, url),
          text: resetPasswordText(user.name, url),
        });
      },
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: settings.production,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
