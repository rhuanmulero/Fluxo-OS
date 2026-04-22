import { IncomingMessage, ServerResponse } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { PrismaService } from '../../../common/database/prisma.service';
import { createAuth } from './auth.config';

export function createAuthHandler(
  prisma: PrismaService,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const auth = createAuth(prisma);
  return toNodeHandler(auth);
}
