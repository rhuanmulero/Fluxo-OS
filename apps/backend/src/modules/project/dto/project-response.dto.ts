import { Project } from '@prisma/client';

export class ProjectResponseDto {
  constructor(
    readonly id: string,
    readonly workspaceId: string,
    readonly name: string,
    readonly description: string | null,
    readonly color: string | null,
    readonly createdAt: Date,
  ) {}

  static from(project: Project): ProjectResponseDto {
    return new ProjectResponseDto(
      project.id,
      project.workspaceId,
      project.name,
      project.description,
      project.color,
      project.createdAt,
    );
  }
}
