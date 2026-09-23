import { createIcons, icons } from 'lucide';
import '../styles/pages/kanban.css';
import { taskApi } from '../api/task-api.js';
import { projectApi } from '../api/project-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { session } from '../core/session-store.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyStateHtml } from '../components/empty-state.js';
import { Dropdown } from '../components/dropdown.js';
import { FormFields } from '../components/form-field.js';
import { PendingButton } from '../components/pending-button.js';

const PRIORITY_LABELS = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

const STATUS_LABELS = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em progresso',
  DONE: 'Concluída',
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Alta Prioridade' },
  { value: 'MEDIUM', label: 'Normal' },
  { value: 'LOW', label: 'Baixa Prioridade' },
];

export default function KanbanPage() {
  const container = document.createElement('div');
  container.className = 'kanban-wrapper';

  let currentFilter = 'all';
  const currentUserId = session.user?.id ?? null;
  let columns = [];
  let tasks = [];
  let members = [];

  async function reload() {
    const projectId = workspaceContext.projectId;

    if (!projectId) {
      columns = [];
      tasks = [];
      members = [];
      render();
      return;
    }

    const assigneeId = currentFilter === 'mine' ? currentUserId : undefined;

    [columns, tasks, members] = await Promise.all([
      taskApi.columns(projectId),
      taskApi.list(projectId, { assigneeId }),
      projectApi.members(projectId),
    ]);

    render();
  }

  function boardRegion() {
    return container.querySelector('#kanban-board');
  }

  async function refresh(region = container) {
    await regionLoader.during(region, async () => {
      try {
        await reload();
      } catch (error) {
        pageFeedback.fail(error);
      }
    });
  }

  async function withFeedback(action) {
    try {
      await action();
      await reload();
    } catch (error) {
      pageFeedback.fail(error);
    }
  }

  function memberName(userId) {
    return members.find((member) => member.user.id === userId)?.user.name ?? 'Sem responsável';
  }

  function render() {
    const projects = workspaceContext.projects;
    const activeProject = workspaceContext.project;
    const total = tasks.length;

    container.innerHTML = `
            <aside class="tasks-sidebar">
                <div class="sidebar-section">
                    <div class="sidebar-label">Filtros</div>
                    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                        <i data-lucide="layout-list" style="width:16px;"></i> Visão do Projeto
                    </button>
                    <button class="filter-btn ${currentFilter === 'mine' ? 'active' : ''}" data-filter="mine">
                        <i data-lucide="user" style="width:16px;"></i> Minhas Atribuições
                    </button>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-header-action">
                        <div class="sidebar-label" style="margin:0; padding:0;">Projetos</div>
                        ${workspaceContext.isSuperadmin ? '<button class="btn-icon-small" id="btn-open-proj-modal" title="Novo Projeto"><i data-lucide="plus" style="width:16px;"></i></button>' : ''}
                    </div>
                    <div class="project-list">
                        ${projects.length === 0 ? '<div style="font-size:12px; color:var(--text-muted); padding: 8px 12px;">Nenhum projeto.</div>' : ''}
                        ${projects
                          .map(
                            (project) => `
                            <button class="project-btn ${project.id === workspaceContext.projectId ? 'active' : ''}" data-id="${project.id}">
                                <div class="project-color" style="background-color: ${project.color ?? '#3b82f6'}"></div> ${project.name}
                            </button>
                        `,
                          )
                          .join('')}
                    </div>
                </div>
            </aside>

            <main class="kanban-main">
                <header class="tasks-header">
                    <div class="header-info">
                        <h1>${activeProject ? activeProject.name : 'Selecione um Projeto'}</h1>
                        <p>${activeProject ? `${total} tarefas distribuídas neste fluxo` : 'Kanban interativo'}</p>
                    </div>
                    <div style="display:flex; gap: 12px;">
                        <button class="btn-secondary" id="btn-add-col-modal" ${!activeProject ? 'disabled' : ''} style="border: 1px solid var(--surface-border);">
                            <i data-lucide="columns" style="width:16px;"></i> + Coluna
                        </button>
                        <button class="btn-create-task" id="btn-new-task" ${!activeProject ? 'disabled' : ''}>
                            <i data-lucide="plus" style="width:18px;"></i> Nova Demanda
                        </button>
                    </div>
                </header>

                <div class="kanban-board-scroll" id="kanban-board">
                    ${
                      !activeProject
                        ? emptyStateHtml({
                            icon: 'folder-dashed',
                            title: 'Nenhum Projeto Selecionado',
                            message:
                              'Crie ou selecione um projeto no menu lateral para visualizar o fluxo Kanban.',
                          })
                        : renderColumns()
                    }
                </div>

                <div id="drawer-overlay" class="task-drawer-overlay"></div>

                <div id="modal-new-column" class="custom-modal">
                    <h3>Nova Coluna Personalizada</h3>
                    <div class="form-group" data-field="name">
                        <label>Nome da Coluna</label>
                        <input type="text" id="input-col-name" placeholder="Ex: Code Review, QA, Homologação..." autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label>Status da Coluna</label>
                        <div id="input-col-status"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 8px;">
                        <label>Cor Indicativa</label>
                        <div class="color-picker" id="col-color-picker">
                            <div class="color-option selected" style="background: #a78bfa;" data-color="#a78bfa"></div>
                            <div class="color-option" style="background: #38bdf8;" data-color="#38bdf8"></div>
                            <div class="color-option" style="background: #fbbf24;" data-color="#fbbf24"></div>
                            <div class="color-option" style="background: #f87171;" data-color="#f87171"></div>
                            <div class="color-option" style="background: #34d399;" data-color="#34d399"></div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button id="btn-cancel-col" class="btn-secondary">Cancelar</button>
                        <button id="btn-save-col" class="btn-primary">Criar Coluna</button>
                    </div>
                </div>

                <div id="task-drawer" class="task-drawer">
                    <div class="drawer-header">
                        <h2 id="drawer-title"><i data-lucide="file-edit" style="width:18px;"></i> Detalhes da Demanda</h2>
                        <button class="btn-icon-small" id="btn-close-drawer"><i data-lucide="x" style="width:20px;"></i></button>
                    </div>
                    <div class="drawer-content">
                        <input type="hidden" id="task-id-input">
                        <div class="form-group">
                            <label>Pasta / Épico</label>
                            <input type="text" id="task-folder" placeholder="Ex: Sprint 1, Backlog, Core..." autocomplete="off">
                        </div>
                        <div class="form-group" data-field="title">
                            <label>Título da Demanda</label>
                            <input type="text" id="task-title" placeholder="Nome principal..." autocomplete="off" style="font-size: 16px; font-weight: 500;">
                        </div>
                        <div class="form-group">
                            <label>Visão Rápida (Resumo)</label>
                            <input type="text" id="task-short-desc" placeholder="Resumo que aparece no card do Kanban..." autocomplete="off" maxlength="100">
                        </div>
                        <div class="grid-2-col">
                            <div class="form-group">
                                <label>Responsável</label>
                                <div id="task-assignee"></div>
                            </div>
                            <div class="form-group">
                                <label>Prioridade</label>
                                <div id="task-priority"></div>
                            </div>
                        </div>
                        <div class="grid-2-col">
                            <div class="form-group">
                                <label>Prazo Final</label>
                                <input type="date" id="task-date">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <div id="task-column-select"></div>
                            </div>
                        </div>
                    </div>
                    <div class="drawer-footer">
                        <button id="btn-cancel-drawer" class="btn-secondary">Cancelar</button>
                        <button id="btn-save-drawer" class="btn-primary">Salvar Tarefa</button>
                    </div>
                </div>
            </main>
        `;

    attachEventListeners();
    createIcons({ icons });
  }

  function renderColumns() {
    const columnsHtml = columns
      .map((column) => {
        const columnTasks = tasks.filter((task) => task.columnId === column.id);

        return `
                <div class="kanban-column" data-column-id="${column.id}">
                    <div class="kanban-column-header">
                        <div class="column-title-wrapper">
                            <div class="column-color-dot" style="background-color: ${column.color || '#60a5fa'}"></div>
                            <span class="column-title">${column.name}</span>
                            <span class="column-count">${columnTasks.length}</span>
                        </div>
                        <div class="column-actions">
                            <button class="action-btn btn-delete-col" data-col-id="${column.id}" title="Excluir Coluna">
                                <i data-lucide="trash-2" style="width:14px;"></i>
                            </button>
                        </div>
                    </div>

                    <div class="kanban-column-body drop-zone" data-column-id="${column.id}">
                        ${columnTasks.map(renderCard).join('')}
                    </div>

                    <button class="btn-quick-add-task" data-column-id="${column.id}">
                        <i data-lucide="plus" style="width:14px;"></i> Adicionar Demanda
                    </button>
                </div>
            `;
      })
      .join('');

    return `${columnsHtml}
            <button class="btn-add-column" id="btn-add-column-card">
                <i data-lucide="plus" style="width:16px;"></i> Nova Coluna
            </button>
        `;
  }

  function renderCard(task) {
    const assignee = memberName(task.assigneeId);
    const avatarClass = task.assigneeId === currentUserId ? 'avatar-voce' : 'avatar-outro';

    return `
            <div class="kanban-card ${task.status === 'DONE' ? 'is-done' : ''}"
                 draggable="true"
                 data-id="${task.id}">

                <div class="card-top-row">
                    <span class="card-folder">${task.folder ? `[${task.folder}]` : 'Geral'}</span>
                    <span class="badge-priority p-${task.priority.toLowerCase()}" style="font-size:10px; padding:2px 8px;">
                        ${PRIORITY_LABELS[task.priority]}
                    </span>
                </div>

                <div class="card-title">${task.title}</div>

                ${task.shortDescription ? `<div class="card-desc">${task.shortDescription}</div>` : ''}

                <div class="card-footer-row">
                    <div class="card-assignee">
                        <div class="avatar-mini ${avatarClass}" style="width:20px; height:20px; font-size:9px;">
                            ${assignee.charAt(0)}
                        </div>
                        <span>${assignee}</span>
                    </div>

                    <div class="card-actions-hover">
                        <button class="action-btn btn-pin-task ${task.isPinned ? 'pinned' : ''}"
                                data-id="${task.id}" title="Fixar no Playground">
                            <i data-lucide="pin" style="width:14px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  async function onCardDrop(taskId, columnId, dropIndex) {
    const previous = tasks.map((task) => ({ ...task }));
    const card = container.querySelector(`.kanban-card[data-id="${taskId}"]`);

    card?.classList.add('is-saving');

    try {
      await taskApi.move(workspaceContext.projectId, taskId, columnId, dropIndex);
      await reload();
    } catch (error) {
      tasks = previous;
      render();
      pageFeedback.fail(error);
    }
  }

  function columnOptions() {
    return columns.map((column) => ({ value: column.id, label: column.name }));
  }

  function assigneeOptions() {
    return [
      { value: '', label: 'Sem responsável' },
      ...members.map((member) => ({ value: member.user.id, label: member.user.name })),
    ];
  }

  function attachEventListeners() {
    const overlay = container.querySelector('#drawer-overlay');
    const colModal = container.querySelector('#modal-new-column');
    const drawer = container.querySelector('#task-drawer');

    const columnStatus = new Dropdown(container.querySelector('#input-col-status'), {
      options: STATUS_OPTIONS,
      value: 'TODO',
    });

    const taskAssignee = new Dropdown(container.querySelector('#task-assignee'), {
      options: assigneeOptions(),
      value: '',
    });

    const taskPriority = new Dropdown(container.querySelector('#task-priority'), {
      options: PRIORITY_OPTIONS,
      value: 'MEDIUM',
    });

    const taskColumn = new Dropdown(container.querySelector('#task-column-select'), {
      options: columnOptions(),
      placeholder: 'Escolha o status',
    });

    const columnForm = new FormFields(container.querySelector('#modal-new-column'), [
      { name: 'name', required: true, message: 'Informe o nome da coluna.' },
    ]);

    const taskForm = new FormFields(container.querySelector('#task-drawer'), [
      { name: 'title', required: true, message: 'Informe o título da demanda.' },
    ]);

    function closeAllModals() {
      if (colModal) colModal.classList.remove('active');
      if (drawer) drawer.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
    }

    container.querySelectorAll('.project-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        workspaceContext.selectProject(e.currentTarget.dataset.id);
      });
    });

    container.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        currentFilter = e.currentTarget.dataset.filter;
        void refresh(boardRegion());
      });
    });

    container.querySelectorAll('.kanban-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-pin-task')) return;
        const task = tasks.find((item) => item.id === card.dataset.id);
        if (task) openDrawer(task);
      });
    });

    container.querySelectorAll('.drop-zone').forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.closest('.kanban-column').classList.add('drag-over');
      });

      zone.addEventListener('dragleave', () => {
        zone.closest('.kanban-column').classList.remove('drag-over');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.closest('.kanban-column').classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        const columnId = zone.dataset.columnId;
        const task = tasks.find((item) => item.id === taskId);

        if (!task || task.columnId === columnId) {
          return;
        }

        void onCardDrop(taskId, columnId, tasks.filter((item) => item.columnId === columnId).length);
      });
    });

    container.querySelectorAll('.btn-pin-task').forEach((btn) => {
      const button = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = tasks.find((item) => item.id === e.currentTarget.dataset.id);

        if (!task) {
          return;
        }

        void button
          .during(() =>
            withFeedback(() =>
              taskApi.update(workspaceContext.projectId, task.id, { isPinned: !task.isPinned }),
            ),
          )
          .catch(() => undefined);
      });
    });

    let selectedColColor = '#a78bfa';
    container.querySelectorAll('#col-color-picker .color-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        container
          .querySelectorAll('#col-color-picker .color-option')
          .forEach((c) => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        selectedColColor = e.currentTarget.dataset.color;
      });
    });

    const openColModal = () => {
      overlay.classList.add('active');
      colModal.classList.add('active');
      const input = container.querySelector('#input-col-name');
      input.value = '';
      setTimeout(() => input.focus(), 100);
    };

    container.querySelector('#btn-open-proj-modal')?.addEventListener('click', () => {
      container.dispatchEvent(
        new CustomEvent('navigate', { detail: 'tasks', bubbles: true }),
      );
    });

    container.querySelector('#btn-add-col-modal')?.addEventListener('click', openColModal);
    container.querySelector('#btn-add-column-card')?.addEventListener('click', openColModal);

    container.querySelector('#btn-cancel-col')?.addEventListener('click', closeAllModals);

    const saveColButton = new PendingButton(container.querySelector('#btn-save-col'));

    container.querySelector('#btn-save-col')?.addEventListener('click', () => {
      if (!columnForm.validate() || !workspaceContext.projectId) {
        return;
      }

      const { name } = columnForm.values();

      void saveColButton
        .during(() =>
          withFeedback(async () => {
            await taskApi.createColumn(workspaceContext.projectId, {
              name,
              status: columnStatus.value,
              color: selectedColColor,
            });
            closeAllModals();
          }),
        )
        .catch(() => undefined);
    });

    container.querySelectorAll('.btn-delete-col').forEach((btn) => {
      const button = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const columnId = e.currentTarget.dataset.colId;

        void button
          .during(() =>
            withFeedback(() => taskApi.removeColumn(workspaceContext.projectId, columnId)),
          )
          .catch(() => undefined);
      });
    });

    function openDrawer(task = null, defaultColumnId = null) {
      taskForm.clear();

      const tId = container.querySelector('#task-id-input');
      const tFolder = container.querySelector('#task-folder');
      const tTitle = container.querySelector('#task-title');
      const tShort = container.querySelector('#task-short-desc');
      const tDate = container.querySelector('#task-date');

      if (task) {
        container.querySelector('#drawer-title').innerHTML =
          `<i data-lucide="file-edit" style="width:18px;"></i> Editar Demanda`;
        tId.value = task.id;
        tFolder.value = task.folder || '';
        tTitle.value = task.title;
        tShort.value = task.shortDescription || '';
        taskAssignee.setOptions(assigneeOptions(), task.assigneeId || '');
        tDate.value = task.dueDate ? String(task.dueDate).slice(0, 10) : '';
        taskPriority.setOptions(PRIORITY_OPTIONS, task.priority);
        taskColumn.setOptions(columnOptions(), task.columnId);
        taskColumn.disabled = true;
      } else {
        container.querySelector('#drawer-title').innerHTML =
          `<i data-lucide="file-plus" style="width:18px;"></i> Nova Demanda`;
        tId.value = '';
        tFolder.value = '';
        tTitle.value = '';
        tShort.value = '';
        taskAssignee.setOptions(assigneeOptions(), '');
        tDate.value = '';
        taskPriority.setOptions(PRIORITY_OPTIONS, 'MEDIUM');
        taskColumn.setOptions(columnOptions(), defaultColumnId ?? columns[0]?.id ?? '');
        taskColumn.disabled = false;
      }

      overlay.classList.add('active');
      drawer.classList.add('active');
      setTimeout(() => tTitle.focus(), 200);
    }

    container.querySelector('#btn-new-task')?.addEventListener('click', () => openDrawer());
    container.querySelectorAll('.btn-quick-add-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        openDrawer(null, e.currentTarget.dataset.columnId);
      });
    });

    container.querySelector('#btn-close-drawer')?.addEventListener('click', closeAllModals);
    container.querySelector('#btn-cancel-drawer')?.addEventListener('click', closeAllModals);
    overlay?.addEventListener('click', closeAllModals);

    const saveDrawerButton = new PendingButton(container.querySelector('#btn-save-drawer'));

    container.querySelector('#btn-save-drawer')?.addEventListener('click', () => {
      if (!taskForm.validate()) {
        return;
      }

      const { title } = taskForm.values();

      const folder = container.querySelector('#task-folder').value.trim();
      const shortDescription = container.querySelector('#task-short-desc').value.trim();
      const dueDate = container.querySelector('#task-date').value;
      const assigneeId = taskAssignee.value;

      const payload = {
        title,
        priority: taskPriority.value,
      };

      if (folder) payload.folder = folder;
      if (shortDescription) payload.shortDescription = shortDescription;
      if (dueDate) payload.dueDate = dueDate;
      if (assigneeId) payload.assigneeId = assigneeId;

      const existingId = container.querySelector('#task-id-input').value;

      void saveDrawerButton
        .during(() =>
          withFeedback(async () => {
            if (existingId) {
              await taskApi.update(workspaceContext.projectId, existingId, payload);
            } else {
              await taskApi.create(workspaceContext.projectId, {
                ...payload,
                type: 'FEATURE',
                kanbanColumnId: taskColumn.value,
              });
            }
            closeAllModals();
          }),
        )
        .catch(() => undefined);
    });
  }

  workspaceContext.onChange(() => void refresh(boardRegion()));

  render();
  void refresh();

  return container;
}
