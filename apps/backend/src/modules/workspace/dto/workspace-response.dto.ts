import { Workspace } from '@prisma/client';

export class WorkspaceResponseDto {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly slug: string,
    readonly createdAt: Date,
  ) {}

  static from(workspace: Workspace): WorkspaceResponseDto {
    return new WorkspaceResponseDto(
      workspace.id,
      workspace.name,
      workspace.slug,
      workspace.createdAt,
    );
  }
}
