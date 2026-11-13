import { Injectable, NotFoundException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { Action } from '../../common/authorization/action';
import { ModulePermissionResolver } from '../../common/authorization/module-permission.resolver';
import { ProjectModule } from '../../common/authorization/project-module';
import { PrismaService } from '../../common/database/prisma.service';

const LIMIT = 30;
const excerpt = (value: string | null) => value === null ? null :
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).slice(0, 500);

@Injectable()
export class NamiProjectContextService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: ModulePermissionResolver) {}

  async read(userId: string, projectId: string) {
    // All project READ policies currently require the same membership.
    await this.permissions.assert(projectId, userId, ProjectModule.TASKS, Action.READ);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }, select: { name: true, description: true, workspaceId: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');

    const scope = { projectId, workspaceId: project.workspaceId };
    const [tasks, columns, stages, notes, events, habits, documents, bookmarks, snippets] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId }, take: LIMIT,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        select: { title: true, description: true, shortDescription: true, priority: true, dueDate: true,
          assignee: { select: { name: true } }, kanbanColumn: { select: { name: true, status: true } } },
      }),
      this.prisma.kanbanColumn.findMany({
        where: { projectId }, take: LIMIT, orderBy: { position: 'asc' },
        select: { name: true, status: true, _count: { select: { tasks: true } } },
      }),
      this.prisma.roadmapStage.findMany({
        where: { roadmap: { projectId } }, take: LIMIT, orderBy: [{ roadmapId: 'asc' }, { position: 'asc' }],
        select: { title: true, goal: true, description: true, status: true, dueDate: true, roadmap: { select: { title: true } } },
      }),
      this.prisma.note.findMany({
        where: { ...scope, OR: [{ visibility: 'PROJECT' }, { authorId: userId }] },
        take: LIMIT, orderBy: { updatedAt: 'desc' }, select: { title: true, body: true },
      }),
      this.prisma.event.findMany({
        where: { ...scope, OR: [{ visibility: 'PROJECT' }, { authorId: userId }, { participants: { some: { userId } } }] },
        take: LIMIT, orderBy: { startsAt: 'desc' }, select: { title: true, description: true, startsAt: true, endsAt: true, allDay: true },
      }),
      this.prisma.habit.findMany({
        where: { ...scope, userId, archivedAt: null }, take: LIMIT, orderBy: { updatedAt: 'desc' },
        select: { name: true, frequency: true, targetPerPeriod: true,
          logs: { take: 7, orderBy: { date: 'desc' }, select: { date: true, value: true } } },
      }),
      this.prisma.document.findMany({
        where: { ...scope, OR: [{ scope: { in: ['PROJECT', 'WORKSPACE'] } }, { authorId: userId }] },
        take: LIMIT, orderBy: { updatedAt: 'desc' }, select: { name: true, folder: true },
      }),
      this.prisma.bookmark.findMany({
        where: { ...scope, OR: [{ scope: { in: ['PROJECT', 'WORKSPACE'] } }, { authorId: userId }] },
        take: LIMIT, orderBy: { updatedAt: 'desc' }, select: { name: true, folder: true },
      }),
      this.prisma.snippet.findMany({
        where: { ...scope, OR: [{ visibility: 'PUBLIC' }, { authorId: userId }] },
        take: LIMIT, orderBy: { updatedAt: 'desc' }, select: { name: true, folder: true, language: true },
      }),
    ]);

    return {
      dataEmUtc: new Date().toISOString(),
      limitePorCategoria: LIMIT,
      projeto: { nome: project.name, descricao: excerpt(project.description) },
      demandas: tasks.map(({ description, shortDescription, ...task }) => ({
        ...task, description: excerpt(description ?? shortDescription),
      })),
      colunasKanban: columns,
      etapasEMetas: stages.map(stage => ({ ...stage, description: excerpt(stage.description), goal: excerpt(stage.goal) })),
      anotacoes: notes.map(note => ({ title: note.title, body: excerpt(note.body) })),
      agenda: events.map(event => ({ ...event, description: excerpt(event.description) })),
      meusHabitos: habits,
      documentos: documents,
      links: bookmarks,
      snippets,
    };
  }
}
