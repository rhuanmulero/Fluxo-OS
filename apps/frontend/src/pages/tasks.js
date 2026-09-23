import { createIcons, icons } from 'lucide';
import '../styles/pages/tasks.css';
import { taskApi } from '../api/task-api.js';
import { projectApi } from '../api/project-api.js';
import { workspaceApi } from '../api/workspace-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { session } from '../core/session-store.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyStateHtml } from '../components/empty-state.js';
import { Dropdown } from '../components/dropdown.js';
import { FormFields } from '../components/form-field.js';
import { PendingButton } from '../components/pending-button.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { RichTextEditor } from '../components/rich-text-editor.js';
import { formDialog } from '../components/form-dialog.js';

const PRIORITY_LABELS = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Alta Prioridade' },
  { value: 'MEDIUM', label: 'Normal' },
  { value: 'LOW', label: 'Baixa Prioridade' },
];

const TYPE_LABELS = {
  FEATURE: 'Feature',
  BUG: 'Bug',
  DESIGN: 'Design',
  REFACTOR: 'Refactor',
  OTHER: 'Outro',
};

export default function TasksPage() {
  const container = document.createElement('div');
  container.className = 'tasks-container';

  let currentFilter = 'all';
  let currentTagsArray = [];
  let currentUserId = session.user?.id ?? null;
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

  async function withFeedback(action) {
    try {
      await action();
      await reload();
    } catch (error) {
      pageFeedback.fail(error);
    }
  }

  function getTagHTML(tagStr, withRemoveBtn = false) {
    const lower = String(tagStr).toLowerCase().trim();
    let type = 'default';

    if (lower.includes('feature')) type = 'feature';
    else if (lower.includes('bug')) type = 'bug';
    else if (lower.includes('design') || lower.includes('ui')) type = 'design';
    else if (lower.includes('refactor')) type = 'refactor';

    return `<span class="task-tag tag-${type}">
            ${tagStr}
            ${withRemoveBtn ? `<i data-lucide="x" class="btn-remove-tag" data-tag="${tagStr}" style="width:12px; margin-left:4px; cursor:pointer;"></i>` : ''}
        </span>`;
  }

  function doneColumn() {
    return columns.find((column) => column.status === 'DONE') ?? null;
  }

  function openColumn() {
    return columns.find((column) => column.status !== 'DONE') ?? columns[0] ?? null;
  }

  function memberName(userId) {
    return members.find((member) => member.user.id === userId)?.user.name ?? 'Sem responsável';
  }

  function render() {
    const projects = workspaceContext.projects;
    const activeProject = workspaceContext.project;
    const total = tasks.length;
    const pending = tasks.filter((task) => task.status !== 'DONE').length;

    container.innerHTML = `
            <aside class="tasks-sidebar">
                <div class="sidebar-section">
                    <div class="sidebar-label">Filtros</div>
                    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all"><i data-lucide="layout-list" style="width:16px;"></i> Visão do Projeto</button>
                    <button class="filter-btn ${currentFilter === 'mine' ? 'active' : ''}" data-filter="mine"><i data-lucide="user" style="width:16px;"></i> Minhas Atribuições</button>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-header-action">
                        <div class="sidebar-label" style="margin:0; padding:0;">Projetos</div>
                        ${workspaceContext.isSuperadmin ? '<button class="btn-icon-small" id="btn-open-proj-modal" data-action="new-project" title="Novo Projeto"><i data-lucide="plus" style="width:16px;"></i></button>' : ''}
                    </div>
                    <div class="project-list">
                        ${projects.length === 0 ? '<div style="font-size:12px; color:var(--text-muted); padding: 8px 12px;">Nenhum projeto.</div>' : ''}
                        ${projects
                          .map(
                            (project) => `
                            <div class="project-item">
                                <button class="project-btn ${project.id === workspaceContext.projectId ? 'active' : ''}" data-id="${project.id}">
                                    <div class="project-color" style="background-color: ${project.color ?? '#3b82f6'}"></div> ${project.name}
                                </button>
                                <button class="btn-icon-small project-edit" data-id="${project.id}" title="Editar projeto"><i data-lucide="pencil" style="width:14px;"></i></button>
                            </div>
                        `,
                          )
                          .join('')}
                    </div>
                </div>
            </aside>

            <main class="tasks-main">
                <header class="tasks-header">
                    <div class="header-info">
                        <h1>${activeProject ? activeProject.name : 'Selecione ou Crie um Projeto'}</h1>
                        <p>${activeProject ? `${pending} pendentes de ${total} totais` : 'Área de Gestão de Demandas'}</p>
                    </div>
                    ${
                      activeProject
                        ? `<button class="btn-create-task" id="btn-new-task">
                             <i data-lucide="plus" style="width:18px;"></i> Nova Demanda
                           </button>`
                        : workspaceContext.isSuperadmin
                          ? `<button class="btn-create-task" data-action="new-project">
                               <i data-lucide="folder-plus" style="width:18px;"></i> Novo Projeto
                             </button>`
                          : `<button class="btn-create-task" disabled
                                     title="Peça a um administrador para criar um projeto.">
                               <i data-lucide="plus" style="width:18px;"></i> Nova Demanda
                             </button>`
                    }
                </header>

                <div class="tasks-list-container">
                    ${
                      !activeProject
                        ? renderEmptyState(
                            'folder-dashed',
                            'Nenhum Projeto Selecionado',
                            'Crie um projeto no menu lateral.',
                          )
                        : tasks.length === 0
                          ? renderEmptyState(
                              'check-circle-2',
                              'Tudo limpo por aqui!',
                              'Nenhuma demanda cadastrada.',
                            )
                          : renderTasksTable(tasks)
                    }
                </div>

                <div id="drawer-overlay" class="task-drawer-overlay"></div>

                <div id="modal-generic" class="custom-modal" style="z-index: 1002;">
                    <h3 id="generic-modal-title" style="font-size: 16px; font-weight: 500;">Aviso</h3>
                    <p id="generic-modal-text" style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">Texto</p>
                    <input type="text" id="generic-modal-input" style="display:none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; color: #fff; outline:none; margin-top:8px;">
                    <div class="modal-actions" id="generic-modal-actions"></div>
                </div>

                <div id="modal-new-project" class="custom-modal">
                    <h3 class="modal-title">Criar Novo Projeto</h3>
                    <div class="modal-tabs">
                        <button class="modal-tab active" data-tab="data">Dados</button>
                        <button class="modal-tab" data-tab="members" hidden>Membros</button>
                    </div>
                    <div class="modal-tab-panel" data-panel="data">
                        <div class="form-group" data-field="name">
                            <label>Nome do Projeto</label>
                            <input type="text" id="input-proj-name" placeholder="Ex: Backend Node.js..." autocomplete="off">
                        </div>
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label>Cor do Projeto</label>
                            <div class="color-picker" id="proj-color-picker">
                                <div class="color-option selected" style="background: #3b82f6;" data-color="#3b82f6"></div>
                                <div class="color-option" style="background: #10b981;" data-color="#10b981"></div>
                                <div class="color-option" style="background: #f59e0b;" data-color="#f59e0b"></div>
                                <div class="color-option" style="background: #ef4444;" data-color="#ef4444"></div>
                                <div class="color-option" style="background: #8b5cf6;" data-color="#8b5cf6"></div>
                                <div class="color-option" style="background: #ec4899;" data-color="#ec4899"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-tab-panel" data-panel="members" hidden>
                        <div class="project-member-list" id="project-member-list"></div>
                        <div class="settings-row">
                            <div class="settings-row-grow" id="project-member-pick"></div>
                            <button class="btn-primary" id="project-member-add">Adicionar</button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        ${workspaceContext.isSuperadmin ? '<button id="btn-delete-proj" class="btn-secondary is-danger-text" style="display:none;">Excluir</button>' : ''}
                        <button id="btn-cancel-proj" class="btn-secondary">Cancelar</button>
                        <button id="btn-save-proj" class="btn-primary">Criar Projeto</button>
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
                            <input type="text" id="task-folder" list="folder-list" placeholder="Ex: Sprint 1, Backlog, Core..." autocomplete="off">
                            <datalist id="folder-list"><option value="Backlog"></option><option value="Sprint Atual"></option></datalist>
                        </div>

                        <div class="form-group" data-field="title">
                            <label>Título da Demanda</label>
                            <input type="text" id="task-title" placeholder="Nome principal..." autocomplete="off" style="font-size: 16px; font-weight: 500;">
                        </div>

                        <div class="form-group">
                            <label>Visão Rápida (Lista)</label>
                            <input type="text" id="task-short-desc" placeholder="Resumo curto que aparece na lista principal..." autocomplete="off" maxlength="100">
                        </div>

                        <div class="form-group">
                            <label>Visão Técnica (Critérios de Aceite)</label>
                            <div id="task-editor-mount"></div>
                        </div>

                        <div class="grid-2-col">
                            <div class="form-group">
                                <label>Status</label>
                                <div id="task-column"></div>
                            </div>
                            <div class="form-group">
                                <label>Tipo</label>
                                <div id="task-type"></div>
                            </div>
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
                                <label>Tags (Múltiplas)</label>
                                <div class="tags-input-container">
                                    <div id="tags-pills-wrapper" style="display:flex; gap:4px; flex-wrap:wrap;"></div>
                                    <input type="text" id="task-tag-input" list="tag-suggestions" placeholder="Adicionar tag..." autocomplete="off">
                                    <datalist id="tag-suggestions"><option value="Feature"></option><option value="Bugfix"></option><option value="Refactor"></option><option value="Design"></option></datalist>
                                </div>
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

  function renderEmptyState(icon, title, text) {
    return emptyStateHtml({ icon, title, message: text });
  }

  function renderTasksTable(list) {
    return `
            <div class="task-grid-header">
                <div></div><div>Demanda / Resumo Rápido</div><div>Responsável</div><div>Prioridade</div><div>Prazo</div><div>Ações</div>
            </div>
            <div class="task-list-body">${list.map(createTaskRow).join('')}</div>
        `;
  }

  function createTaskRow(task) {
    const isDone = task.status === 'DONE';
    const dateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : '-';
    const assignee = memberName(task.assigneeId);
    const avatarClass = task.assigneeId === currentUserId ? 'avatar-voce' : 'avatar-outro';

    const tagsHtml = [TYPE_LABELS[task.type], ...(task.tags || [])]
      .map((tag) => getTagHTML(tag))
      .join('');
    const folderHtml = task.folder ? `<span class="task-folder">[${task.folder}]</span>` : '';

    return `
            <div class="task-row ${isDone ? 'is-done' : ''}" data-id="${task.id}">
                <div class="task-cell"><div class="custom-checkbox btn-toggle-status">${isDone ? '<i data-lucide="check" style="width:12px;"></i>' : ''}</div></div>

                <div class="task-cell task-title-group btn-open-drawer">
                    <div class="title-line">
                        ${folderHtml}
                        <span class="task-title">${task.title}</span>
                        <div class="tag-container-row">${tagsHtml}</div>
                    </div>
                    <span class="task-desc">${task.shortDescription || 'Sem visão rápida definida.'}</span>
                </div>

                <div class="task-cell btn-open-drawer">
                    <div class="assignee-badge"><div class="avatar-mini ${avatarClass}">${assignee.charAt(0)}</div><span>${assignee}</span></div>
                </div>

                <div class="task-cell btn-open-drawer"><span class="badge-priority p-${task.priority.toLowerCase()}">${PRIORITY_LABELS[task.priority]}</span></div>
                <div class="task-cell btn-open-drawer" style="color:var(--text-muted);"><i data-lucide="calendar" style="width:14px; margin-right:4px;"></i>${dateStr}</div>

                <div class="task-cell actions-cell">
                    <button class="action-btn btn-pin ${task.isPinned ? 'pinned' : ''}" title="Fixar no Playground"><i data-lucide="pin" style="width:16px;"></i></button>
                    <button class="action-btn btn-delete" title="Excluir Definitivamente"><i data-lucide="trash-2" style="width:16px;"></i></button>
                </div>
            </div>
        `;
  }

  function taskFromRow(element) {
    const id = element.closest('.task-row').dataset.id;
    return tasks.find((task) => task.id === id) ?? null;
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

  function typeOptions() {
    return Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
  }

  function attachEventListeners() {
    const overlay = container.querySelector('#drawer-overlay');
    const genericModal = container.querySelector('#modal-generic');

    const taskColumn = new Dropdown(container.querySelector('#task-column'), {
      options: columnOptions(),
      placeholder: 'Escolha o status',
    });

    const taskType = new Dropdown(container.querySelector('#task-type'), {
      options: typeOptions(),
      value: 'FEATURE',
    });

    const taskAssignee = new Dropdown(container.querySelector('#task-assignee'), {
      options: assigneeOptions(),
      value: '',
    });

    const taskPriority = new Dropdown(container.querySelector('#task-priority'), {
      options: PRIORITY_OPTIONS,
      value: 'MEDIUM',
    });

    const memberPick = new Dropdown(container.querySelector('#project-member-pick'), {
      options: [],
      placeholder: 'Escolha quem entra',
    });

    const projectForm = new FormFields(container.querySelector('#modal-new-project'), [
      { name: 'name', required: true, message: 'Informe o nome do projeto.' },
    ]);

    const taskForm = new FormFields(container.querySelector('#task-drawer'), [
      { name: 'title', required: true, message: 'Informe o título da demanda.' },
    ]);

    function showModal(title, text, type = 'alert', onConfirm = null) {
      container.querySelector('#generic-modal-title').textContent = title;
      container.querySelector('#generic-modal-text').innerHTML = text;
      const inputField = container.querySelector('#generic-modal-input');
      const actionsDiv = container.querySelector('#generic-modal-actions');

      inputField.style.display = type === 'prompt' ? 'block' : 'none';
      inputField.value = '';

      if (type === 'confirm' || type === 'prompt') {
        actionsDiv.innerHTML = `<button id="btn-modal-cancel" class="btn-secondary">Cancelar</button>
                                        <button id="btn-modal-confirm" class="btn-primary">Confirmar</button>`;
        const confirmButton = new PendingButton(actionsDiv.querySelector('#btn-modal-confirm'));

        actionsDiv.querySelector('#btn-modal-confirm').addEventListener('click', () => {
          const val = inputField.value.trim();
          if (type === 'prompt' && !val) return;

          if (type === 'confirm') {
            if (onConfirm) void confirmButton.during(() => onConfirm()).catch(() => undefined);
          } else if (onConfirm) {
            onConfirm(val);
          }

          closeGenericModal();
        });
      } else {
        actionsDiv.innerHTML = `<button id="btn-modal-cancel" class="btn-primary">OK</button>`;
      }
      actionsDiv.querySelector('#btn-modal-cancel').addEventListener('click', closeGenericModal);

      overlay.classList.add('active');
      genericModal.classList.add('active');
      if (type === 'prompt') setTimeout(() => inputField.focus(), 100);
    }

    function closeAllOverlays() {
      const projModal = container.querySelector('#modal-new-project');
      const drawer = container.querySelector('#task-drawer');

      if (genericModal && genericModal.classList.contains('active')) {
        closeGenericModal();
      } else {
        if (projModal) projModal.classList.remove('active');
        if (drawer) drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    }

    function closeGenericModal() {
      genericModal.classList.remove('active');
      const projModal = container.querySelector('#modal-new-project');
      const drawer = container.querySelector('#task-drawer');

      if (
        (!projModal || !projModal.classList.contains('active')) &&
        (!drawer || !drawer.classList.contains('active'))
      ) {
        overlay.classList.remove('active');
      }
    }

    const projModal = container.querySelector('#modal-new-project');
    const projInput = container.querySelector('#input-proj-name');
    let selectedProjColor = '#3b82f6';
    let editingProjectId = null;

    container.querySelectorAll('.color-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        container.querySelectorAll('.color-option').forEach((c) => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        selectedProjColor = e.currentTarget.dataset.color;
      });
    });

    function openProjectModal(project) {
      editingProjectId = project?.id ?? null;

      projModal.querySelector('.modal-title').textContent = project ? 'Editar Projeto' : 'Criar Novo Projeto';
      container.querySelector('#btn-save-proj').textContent = project ? 'Salvar' : 'Criar Projeto';
      const deleteButton = container.querySelector('#btn-delete-proj');
      if (deleteButton) deleteButton.style.display = project ? '' : 'none';
      container.querySelector('[data-tab="members"]').hidden = !project;

      container.querySelectorAll('.modal-tab').forEach((tab) =>
        tab.classList.toggle('active', tab.dataset.tab === 'data'),
      );
      container.querySelectorAll('.modal-tab-panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== 'data';
      });

      projInput.value = project?.name ?? '';
      selectedProjColor = project?.color ?? '#3b82f6';
      container.querySelectorAll('.color-option').forEach((option) => {
        option.classList.toggle('selected', option.dataset.color === selectedProjColor);
      });

      overlay.classList.add('active');
      projModal.classList.add('active');
      setTimeout(() => projInput.focus(), 100);
    }

    container.querySelectorAll('[data-action="new-project"]').forEach((trigger) =>
      trigger.addEventListener('click', () => openProjectModal(null)),
    );

    container.querySelectorAll('.project-edit').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        openProjectModal(workspaceContext.projects.find((p) => p.id === trigger.dataset.id));
      });
    });

    container.querySelector('#btn-cancel-proj')?.addEventListener('click', closeAllOverlays);

    const saveProjButton = new PendingButton(container.querySelector('#btn-save-proj'));

    container.querySelector('#btn-save-proj')?.addEventListener('click', () => {
      if (!projectForm.validate()) {
        return;
      }

      const { name } = projectForm.values();

      const data = { name, color: selectedProjColor };

      void saveProjButton
        .during(() =>
          withFeedback(async () => {
            if (editingProjectId) {
              await projectApi.update(editingProjectId, data);
              closeAllOverlays();
              await workspaceContext.load();
            } else {
              const project = await projectApi.create(workspaceContext.workspaceId, data);
              closeAllOverlays();
              await workspaceContext.load();
              workspaceContext.selectProject(project.id);
            }
          }),
        )
        .catch(() => undefined);
    });

    const deleteProjButton = new PendingButton(container.querySelector('#btn-delete-proj'));

    container.querySelector('#btn-delete-proj')?.addEventListener('click', () => {
      const project = workspaceContext.projects.find((p) => p.id === editingProjectId);

      if (!project) return;

      void confirmDialog
        .ask({
          title: 'Excluir projeto',
          message: `Todas as tarefas, colunas e vínculos de ${project.name} serão apagados. Notas e snippets do projeto ficam sem projeto, mas não são apagados.`,
          confirmLabel: 'Excluir',
          danger: true,
        })
        .then((confirmed) => {
          if (!confirmed) return null;

          return deleteProjButton.during(() => projectApi.remove(editingProjectId)).then(() => {
            closeAllOverlays();
            return workspaceContext.load();
          });
        })
        .catch((error) => pageFeedback.fail(error));
    });

    async function loadProjectMembers() {
      const list = container.querySelector('#project-member-list');

      const [current, everyone] = await regionLoader.during(list, () =>
        Promise.all([
          projectApi.members(editingProjectId),
          workspaceApi.members(workspaceContext.workspaceId),
        ]),
      );
      const inProject = new Set(current.map((member) => member.userId));

      list.innerHTML = current.length
        ? current
            .map(
              (member) => `
                <div class="project-member-row" data-user="${member.userId}">
                  <span>${member.user.name}</span>
                  <button class="btn-icon-small project-member-remove" title="Tirar do projeto">
                    <i data-lucide="user-minus"></i>
                  </button>
                </div>`,
            )
            .join('')
        : '<p class="settings-hint">Ninguém atribuído a este projeto ainda.</p>';

      const available = everyone.filter((member) => !inProject.has(member.userId));

      memberPick.setOptions(
        available.length
          ? available.map((member) => ({ value: member.userId, label: member.name }))
          : [{ value: '', label: 'Todos já estão no projeto' }],
        available.length ? null : '',
      );

      bindProjectMemberEvents();
      createIcons({ icons });
    }

    function bindProjectMemberEvents() {
      const addTrigger = container.querySelector('#project-member-add');
      const addButton = new PendingButton(addTrigger);

      addTrigger.onclick = () => {
        const userId = memberPick.value;

        if (!userId) return;

        void addButton
          .during(() => projectApi.addMember(editingProjectId, userId))
          .then(() => loadProjectMembers())
          .catch((error) => pageFeedback.fail(error));
      };

      container.querySelectorAll('.project-member-remove').forEach((trigger) => {
        const button = new PendingButton(trigger);
        const userId = trigger.closest('[data-user]').dataset.user;

        trigger.addEventListener('click', () => {
          void confirmDialog
            .ask({
              title: 'Tirar do projeto',
              message: 'A pessoa continua no workspace, mas perde acesso a este projeto.',
              confirmLabel: 'Tirar',
              danger: true,
            })
            .then((confirmed) => {
              if (!confirmed) return null;

              return button
                .during(() => projectApi.removeMember(editingProjectId, userId))
                .then(() => loadProjectMembers());
            })
            .catch((error) => pageFeedback.fail(error));
        });
      });
    }

    container.querySelectorAll('.modal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.modal-tab').forEach((other) => {
          other.classList.toggle('active', other === tab);
        });

        container.querySelectorAll('.modal-tab-panel').forEach((panel) => {
          panel.hidden = panel.dataset.panel !== tab.dataset.tab;
        });

        if (tab.dataset.tab === 'members') {
          void loadProjectMembers().catch((error) => pageFeedback.fail(error));
        }
      });
    });

    container.querySelectorAll('.filter-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        currentFilter = e.currentTarget.dataset.filter;
        void refresh(listRegion());
      }),
    );

    container.querySelectorAll('.project-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        workspaceContext.selectProject(e.currentTarget.dataset.id);
      }),
    );

    container.querySelectorAll('.btn-toggle-status').forEach((btn) => {
      const button = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = taskFromRow(e.currentTarget);
        const target = task?.status === 'DONE' ? openColumn() : doneColumn();

        if (!task || !target) {
          return;
        }

        void button
          .during(() =>
            withFeedback(() => taskApi.move(workspaceContext.projectId, task.id, target.id, 0)),
          )
          .catch(() => undefined);
      });
    });

    container.querySelectorAll('.btn-pin').forEach((btn) => {
      const button = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = taskFromRow(e.currentTarget);

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

    container.querySelectorAll('.btn-delete').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = taskFromRow(e.currentTarget);

        if (!task) {
          return;
        }

        showModal(
          'Confirmar Exclusão',
          'Tem certeza que deseja apagar essa demanda definitivamente?',
          'confirm',
          () => withFeedback(() => taskApi.remove(workspaceContext.projectId, task.id)),
        );
      }),
    );

    const drawer = container.querySelector('#task-drawer');
    const rtEditor = new RichTextEditor(container.querySelector('#task-editor-mount'), {
      placeholder: 'Descreva regras de negócio, adicione links de API, etc...',
      onLink: (text) =>
        formDialog
          .ask({
            title: 'Inserir link',
            fields: [{ name: 'href', label: `Endereço para "${text}"`, required: true }],
          })
          .then((values) => values?.href ?? null),
    });
    const tagsPillsWrapper = container.querySelector('#tags-pills-wrapper');
    const tagInput = container.querySelector('#task-tag-input');

    function renderTagsInDrawer() {
      if (!tagsPillsWrapper) return;
      tagsPillsWrapper.innerHTML = currentTagsArray.map((tag) => getTagHTML(tag, true)).join('');
      tagsPillsWrapper.querySelectorAll('.btn-remove-tag').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const tagToRemove = e.currentTarget.dataset.tag;
          currentTagsArray = currentTagsArray.filter((t) => t !== tagToRemove);
          renderTagsInDrawer();
        });
      });
      createIcons({ icons });
    }

    tagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(',', '');
        if (val && !currentTagsArray.includes(val)) {
          currentTagsArray.push(val);
          renderTagsInDrawer();
        }
        e.target.value = '';
      }
    });

    function openDrawer(task = null) {
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
        rtEditor.value = task.description || '';
        taskColumn.setOptions(columnOptions(), task.columnId);
        taskColumn.disabled = true;
        taskType.setOptions(typeOptions(), task.type);
        taskAssignee.setOptions(assigneeOptions(), task.assigneeId || '');
        tDate.value = task.dueDate ? String(task.dueDate).slice(0, 10) : '';
        taskPriority.setOptions(PRIORITY_OPTIONS, task.priority);
        currentTagsArray = [...(task.tags || [])];
      } else {
        container.querySelector('#drawer-title').innerHTML =
          `<i data-lucide="file-plus" style="width:18px;"></i> Nova Demanda`;
        tId.value = '';
        tFolder.value = '';
        tTitle.value = '';
        tShort.value = '';
        rtEditor.value = '';
        taskColumn.setOptions(columnOptions(), openColumn()?.id ?? '');
        taskColumn.disabled = false;
        taskType.setOptions(typeOptions(), 'FEATURE');
        taskAssignee.setOptions(assigneeOptions(), '');
        tDate.value = '';
        taskPriority.setOptions(PRIORITY_OPTIONS, 'MEDIUM');
        currentTagsArray = [];
      }

      renderTagsInDrawer();
      overlay.classList.add('active');
      drawer.classList.add('active');
      createIcons({ icons });
      setTimeout(() => tTitle.focus(), 300);
    }

    container.querySelector('#btn-new-task')?.addEventListener('click', () => openDrawer());
    container.querySelectorAll('.btn-open-drawer').forEach((cell) =>
      cell.addEventListener('click', (e) => {
        const task = taskFromRow(e.currentTarget);
        if (task) openDrawer(task);
      }),
    );

    container.querySelector('#btn-close-drawer')?.addEventListener('click', closeAllOverlays);
    container.querySelector('#btn-cancel-drawer')?.addEventListener('click', closeAllOverlays);
    overlay?.addEventListener('click', closeAllOverlays);

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
        type: taskType.value,
        priority: taskPriority.value,
        description: rtEditor.value,
        tags: currentTagsArray,
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
                kanbanColumnId: taskColumn.value,
              });
            }
            closeAllOverlays();
          }),
        )
        .catch(() => undefined);
    });
  }

  function listRegion() {
    return container.querySelector('.tasks-list-container');
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

  workspaceContext.onChange(() => void refresh(listRegion()));

  render();
  void refresh();

  return container;
}
