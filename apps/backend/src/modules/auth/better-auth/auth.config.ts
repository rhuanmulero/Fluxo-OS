import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../../../common/database/prisma.service';

export function createAuth(prisma: PrismaService) {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    basePath: '/auth',
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
    emailAndPassword: {
      enabled: true,
    },
  });
}
