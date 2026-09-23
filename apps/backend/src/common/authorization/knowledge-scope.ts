import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { KnowledgeScope } from '@prisma/client';
import { WorkspaceRole } from './workspace-role';

export function assertKnowledgeScope(
  entry: string,
  scope: KnowledgeScope,
  projectId: string | null | undefined,
  role: WorkspaceRole,
): void {
  if (scope === 'PROJECT' && !projectId) {
    throw new BadRequestException(`${entry} de projeto precisa de um projeto.`);
  }

  if (scope !== 'PROJECT' && projectId) {
    throw new BadRequestException(`Só ${entry.toLowerCase()} de projeto aceita um projeto.`);
  }

  if (scope === 'WORKSPACE' && !role.atLeast(WorkspaceRole.ADMIN)) {
    throw new ForbiddenException(
      `Só administradores gerenciam ${entry.toLowerCase()}s do workspace.`,
    );
  }
}
