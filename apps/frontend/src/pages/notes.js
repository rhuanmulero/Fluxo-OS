import { createIcons, icons } from 'lucide';
import '../styles/components/note-content.css';
import '../styles/pages/notes.css';
import { noteApi } from '../api/note-api.js';
import { workspaceApi } from '../api/workspace-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { session } from '../core/session-store.js';
import { settings } from '../core/settings-store.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyStateHtml } from '../components/empty-state.js';
import { Dropdown } from '../components/dropdown.js';
import { FormFields } from '../components/form-field.js';
import { PendingButton } from '../components/pending-button.js';
import { RichTextEditor } from '../components/rich-text-editor.js';
import { formDialog } from '../components/form-dialog.js';
import { exportNote } from '../core/note-export.js';

const NOTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const DEFAULT_PROJECT_COLOR = '#3b82f6';
const TITLE_LIMIT = 120;
const COPY_SUFFIX = ' (cópia)';

export default function NotesPage() {
  const container = document.createElement('div');
  container.className = 'notes-container';

  let currentFilter = 'all';
  let currentProjectId = 'all';
  let currentSearch = '';
  let currentSort = settings.notesSort;
  let currentView = settings.notesView;
  let notesData = [];
  let members = null;

  const currentUserId = session.user?.id ?? null;

  async function reload() {
    const projectId = currentProjectId === 'all' ? undefined : currentProjectId;
    notesData = await noteApi.list(workspaceContext.workspaceId, { projectId, q: currentSearch });
    render();
  }

  function listRegion() {
    return container.querySelector('.notes-grid-scroll');
  }

  function projectOptions() {
    return [
      { value: '', label: 'Nenhum Projeto (Geral)' },
      ...workspaceContext.projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ];
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

  async function authorNameOf(note) {
    if (members === null) {
      members = await workspaceApi.members(workspaceContext.workspaceId);
    }

    return members.find((member) => member.userId === note.authorId)?.name ?? 'Ex-membro';
  }

  function visibleNotes() {
    const filtered =
      currentFilter === 'pinned' ? notesData.filter((note) => note.isPinned) : notesData;

    if (currentSort !== 'title') {
      return filtered;
    }

    return [...filtered].sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }),
    );
  }

  function copyTitleOf(note) {
    return `${note.title.slice(0, TITLE_LIMIT - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function render() {
    const projects = workspaceContext.projects;
    const filteredNotes = visibleNotes();

    container.innerHTML = `
            <aside class="tasks-sidebar">
                <div class="sidebar-section">
                    <div class="sidebar-label">Busca</div>
                    <input type="search" id="note-search" class="note-search"
                           placeholder="Buscar em título e corpo" value="${currentSearch}"
                           autocomplete="off">
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-label">Visualização</div>
                    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all"><i data-lucide="file-text" style="width:16px;"></i> Todas as Notas</button>
                    <button class="filter-btn ${currentFilter === 'pinned' ? 'active' : ''}" data-filter="pinned"><i data-lucide="pin" style="width:16px;"></i> Notas Fixadas</button>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-label">Ordenar</div>
                    <button class="filter-btn sort-btn ${currentSort === 'recent' ? 'active' : ''}" data-sort="recent"><i data-lucide="clock" style="width:16px;"></i> Recentes</button>
                    <button class="filter-btn sort-btn ${currentSort === 'title' ? 'active' : ''}" data-sort="title"><i data-lucide="arrow-down-a-z" style="width:16px;"></i> Título A–Z</button>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-label">Exibir</div>
                    <div class="view-toggle">
                        <button class="view-btn ${currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grade" aria-label="Grade"><i data-lucide="layout-grid" style="width:16px;"></i></button>
                        <button class="view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list" title="Lista" aria-label="Lista"><i data-lucide="rows-3" style="width:16px;"></i></button>
                    </div>
                </div>
                <div class="sidebar-section">
                    <div class="sidebar-label">Por Projeto</div>
                    <button class="project-btn ${currentProjectId === 'all' ? 'active' : ''}" data-id="all">
                        <i data-lucide="globe" style="width:16px;"></i> Todos
                    </button>
                    ${projects
                      .map(
                        (project) => `
                        <button class="project-btn ${currentProjectId === project.id ? 'active' : ''}" data-id="${project.id}">
                            <div class="project-color" style="background-color: ${project.color ?? DEFAULT_PROJECT_COLOR}"></div> ${project.name}
                        </button>
                    `,
                      )
                      .join('')}
                </div>
            </aside>

            <main class="notes-main">
                <header class="tasks-header">
                    <div class="header-info">
                        <h1>Anotações</h1>
                        <p>${filteredNotes.length} notas encontradas</p>
                    </div>
                    <button class="btn-create-task" id="btn-new-note">
                        <i data-lucide="plus" style="width:18px;"></i> Nova Nota
                    </button>
                </header>

                <div class="notes-grid-scroll ${currentView === 'list' ? 'is-list' : ''}">
                    ${
                      filteredNotes.length === 0
                        ? emptyStateHtml({
                            icon: 'file-dashed',
                            title: 'Nenhuma nota encontrada',
                            message: 'Crie anotações, salve trechos de código e fixe-as no Playground.',
                          })
                        : filteredNotes.map(renderNoteCard).join('')
                    }
                </div>

                <div id="drawer-overlay" class="task-drawer-overlay"></div>

                <div id="note-drawer" class="task-drawer">
                    <div class="drawer-header">
                        <h2 id="drawer-title"><i data-lucide="edit-3" style="width:18px;"></i> Editor de Nota</h2>
                        <div class="drawer-header-actions">
                            <button class="btn-icon-small" id="btn-expand-drawer" title="Expandir" aria-label="Expandir"><i data-lucide="maximize-2" style="width:18px;"></i></button>
                            <button class="btn-icon-small" id="btn-close-drawer" title="Fechar" aria-label="Fechar"><i data-lucide="x" style="width:20px;"></i></button>
                        </div>
                    </div>
                    <div class="drawer-content">
                        <input type="hidden" id="note-id-input">

                        <div class="note-form">
                            <div class="form-group" data-field="title">
                                <label>Título da Nota</label>
                                <input type="text" id="note-title" placeholder="Ex: Regras de negócio do Login..." autocomplete="off" style="font-size: 16px; font-weight: 500;">
                            </div>

                            <div class="grid-2-col">
                                <div class="form-group">
                                    <label>Vincular a um Projeto (Opcional)</label>
                                    <div id="note-project-select"></div>
                                </div>
                                <div class="form-group">
                                    <label>Cor</label>
                                    <div class="color-picker" id="note-color-picker">
                                        <div class="color-option color-option-none selected" data-color="" title="Sem cor"></div>
                                        ${NOTE_COLORS.map(
                                          (color) =>
                                            `<div class="color-option" style="background: ${color};" data-color="${color}"></div>`,
                                        ).join('')}
                                    </div>
                                </div>
                            </div>

                            <div class="form-group note-editor-group">
                                <label>Conteúdo</label>
                                <div id="note-editor-mount"></div>
                            </div>
                        </div>

                        <article class="note-reader" hidden>
                            <h1 class="note-reader-title"></h1>
                            <div class="note-reader-meta"></div>
                            <div class="note-reader-body note-content"></div>
                        </article>
                    </div>
                    <div class="drawer-footer">
                        <button id="btn-cancel-drawer" class="btn-secondary">Cancelar</button>
                        <button id="btn-save-drawer" class="btn-primary">Salvar Nota</button>
                    </div>
                </div>
            </main>
        `;

    attachEventListeners();
    createIcons({ icons });
  }

  function renderNoteCard(note) {
    const isMine = note.authorId === currentUserId;
    const project = workspaceContext.projects.find((item) => item.id === note.projectId);
    const projectColor = project?.color ?? DEFAULT_PROJECT_COLOR;

    const linkHtml = project
      ? `<div class="note-link-badge" style="color: ${projectColor}; border-color: ${projectColor};"><i data-lucide="folder" style="width:10px;"></i> ${project.name}</div>`
      : '';

    const publishHtml =
      isMine && note.projectId
        ? note.visibility === 'PROJECT'
          ? `<button class="btn-note-action btn-unpublish-note" title="Tornar privada"><i data-lucide="eye-off" style="width:14px;"></i></button>`
          : `<button class="btn-note-action btn-publish-note" title="Publicar no projeto"><i data-lucide="send" style="width:14px;"></i></button>`
        : '';

    const duplicateHtml = `<button class="btn-note-action btn-duplicate-note" title="Duplicar"><i data-lucide="copy" style="width:14px;"></i></button>`;

    const actions = isMine
      ? `<button class="btn-note-action btn-pin-note ${note.isPinned ? 'pinned' : ''}" title="Fixar no Playground"><i data-lucide="pin" style="width:14px;"></i></button>
                    ${publishHtml}
                    ${duplicateHtml}
                    <div class="note-export">
                      <button class="btn-note-action btn-download-note" title="Baixar"><i data-lucide="download" style="width:14px;"></i></button>
                      <div class="note-export-menu" hidden>
                        <button class="note-export-option" data-format="md">Markdown</button>
                        <button class="note-export-option" data-format="docx">Word (DOCX)</button>
                        <button class="note-export-option" data-format="pdf">PDF</button>
                      </div>
                    </div>
                    <button class="btn-note-action btn-delete-note" title="Excluir"><i data-lucide="trash-2" style="width:14px;"></i></button>`
      : duplicateHtml;

    const statusBadge =
      note.visibility === 'PROJECT'
        ? `<div class="note-link-badge"><i data-lucide="users" style="width:10px;"></i> Publicada</div>`
        : `<div class="note-link-badge"><i data-lucide="lock" style="width:10px;"></i> Privada</div>`;

    const colorAttributes = note.color ? `style="--note-color: ${note.color}"` : '';

    return `
            <div class="note-card ${isMine ? '' : 'is-readonly'} ${note.color ? 'has-color' : ''}" data-id="${note.id}" ${colorAttributes}>
                <div class="note-actions">${actions}</div>
                <div class="note-header">
                    <div>
                        <div class="note-title">${note.title}</div>
                        <div class="note-date">Modificado em ${formatDate(note.updatedAt)}</div>
                    </div>
                </div>
                <div class="note-content-preview">${note.body.replace(/<[^>]+>/g, ' ')}</div>
                <div class="note-links">${statusBadge}${linkHtml}</div>
            </div>
        `;
  }

  function noteFromCard(element) {
    const id = element.closest('.note-card').dataset.id;
    return notesData.find((note) => note.id === id) ?? null;
  }

  function attachEventListeners() {
    const overlay = container.querySelector('#drawer-overlay');
    const drawer = container.querySelector('#note-drawer');
    const drawerTitle = container.querySelector('#drawer-title');
    const noteFormElement = container.querySelector('.note-form');
    const reader = container.querySelector('.note-reader');
    const colorPicker = container.querySelector('#note-color-picker');
    const expandButton = container.querySelector('#btn-expand-drawer');
    const cancelButton = container.querySelector('#btn-cancel-drawer');
    const saveButton = container.querySelector('#btn-save-drawer');

    const rtEditor = new RichTextEditor(container.querySelector('#note-editor-mount'), {
      placeholder: 'Comece a digitar sua anotação...',
      onLink: (text) =>
        formDialog
          .ask({
            title: 'Inserir link',
            fields: [{ name: 'href', label: `Endereço para "${text}"`, required: true }],
          })
          .then((values) => values?.href ?? null),
    });
    const projSelect = new Dropdown(container.querySelector('#note-project-select'), {
      options: projectOptions(),
      value: '',
    });

    const noteForm = new FormFields(container.querySelector('#note-drawer'), [
      { name: 'title', required: true, message: 'Informe o título da nota.' },
    ]);

    function selectedColor() {
      return colorPicker.querySelector('.color-option.selected').dataset.color;
    }

    function selectColor(color) {
      for (const option of colorPicker.querySelectorAll('.color-option')) {
        option.classList.toggle('selected', option.dataset.color === color);
      }
    }

    colorPicker.querySelectorAll('.color-option').forEach((option) =>
      option.addEventListener('click', () => selectColor(option.dataset.color)),
    );

    container.querySelectorAll('.filter-btn:not(.sort-btn)').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        currentFilter = e.currentTarget.dataset.filter;
        render();
      }),
    );

    container.querySelectorAll('.sort-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        currentSort = e.currentTarget.dataset.sort;
        settings.notesSort = currentSort;
        render();
      }),
    );

    container.querySelectorAll('.view-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        currentView = e.currentTarget.dataset.view;
        settings.notesView = currentView;
        render();
      }),
    );

    const search = container.querySelector('#note-search');

    search?.addEventListener('change', () => {
      currentSearch = search.value.trim();
      void refresh(listRegion());
    });

    container.querySelectorAll('.btn-download-note').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const menu = e.currentTarget.parentElement.querySelector('.note-export-menu');

        for (const other of container.querySelectorAll('.note-export-menu')) {
          if (other !== menu) other.hidden = true;
        }

        menu.hidden = !menu.hidden;
      }),
    );

    container.querySelectorAll('.note-export-option').forEach((option) =>
      option.addEventListener('click', (e) => {
        e.stopPropagation();

        const note = noteFromCard(e.currentTarget);

        if (!note) {
          return;
        }

        e.currentTarget.closest('.note-export-menu').hidden = true;

        void exportNote(note, e.currentTarget.dataset.format).catch((error) =>
          pageFeedback.error(`Não foi possível exportar: ${error.message}`),
        );
      }),
    );

    container.querySelectorAll('.project-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        currentProjectId = e.currentTarget.dataset.id;
        currentFilter = 'all';
        void refresh(listRegion());
      }),
    );

    function bindCardAction(selector, request) {
      container.querySelectorAll(selector).forEach((btn) => {
        const pendingButton = new PendingButton(btn);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const note = noteFromCard(e.currentTarget);

          if (!note) {
            return;
          }

          void pendingButton
            .during(() => withFeedback(() => request(note)))
            .catch(() => undefined);
        });
      });
    }

    bindCardAction('.btn-pin-note', (note) =>
      noteApi.update(workspaceContext.workspaceId, note.id, { isPinned: !note.isPinned }),
    );

    bindCardAction('.btn-publish-note', (note) =>
      noteApi.setVisibility(workspaceContext.workspaceId, note.id, 'PROJECT'),
    );

    bindCardAction('.btn-unpublish-note', (note) =>
      noteApi.setVisibility(workspaceContext.workspaceId, note.id, 'PRIVATE'),
    );

    bindCardAction('.btn-duplicate-note', (note) =>
      noteApi.create(workspaceContext.workspaceId, {
        title: copyTitleOf(note),
        body: note.body,
        ...(note.projectId ? { projectId: note.projectId } : {}),
        ...(note.color ? { color: note.color } : {}),
      }),
    );

    bindCardAction('.btn-delete-note', (note) =>
      noteApi.remove(workspaceContext.workspaceId, note.id),
    );

    function showDrawer() {
      overlay.classList.add('active');
      drawer.classList.add('active');
    }

    function setReading(reading) {
      drawer.classList.toggle('is-reading', reading);
      noteFormElement.hidden = reading;
      reader.hidden = !reading;
      saveButton.hidden = reading;
      cancelButton.textContent = reading ? 'Fechar' : 'Cancelar';
    }

    function openDrawer(note = null) {
      noteForm.clear();
      setReading(false);

      const nId = container.querySelector('#note-id-input');
      const nTitle = container.querySelector('#note-title');

      if (note) {
        drawerTitle.innerHTML = `<i data-lucide="edit-3" style="width:18px;"></i> Editar Nota`;
        nId.value = note.id;
        nTitle.value = note.title;
        rtEditor.value = note.body;
        projSelect.setOptions(projectOptions(), note.projectId ?? '');
        selectColor(note.color ?? '');
      } else {
        drawerTitle.innerHTML = `<i data-lucide="plus" style="width:18px;"></i> Nova Nota`;
        nId.value = '';
        nTitle.value = '';
        rtEditor.value = '';
        projSelect.setOptions(
          projectOptions(),
          currentProjectId !== 'all' ? currentProjectId : '',
        );
        selectColor('');
      }

      createIcons({ icons });
      showDrawer();
      setTimeout(() => nTitle.focus(), 200);
    }

    function openReader(note) {
      const project = workspaceContext.projects.find((item) => item.id === note.projectId);
      const meta = reader.querySelector('.note-reader-meta');

      drawerTitle.innerHTML = `<i data-lucide="book-open" style="width:18px;"></i> Leitura`;
      reader.querySelector('.note-reader-title').textContent = note.title;
      reader.querySelector('.note-reader-body').innerHTML = note.body;
      meta.innerHTML = `
        <span class="note-reader-author"><i data-lucide="user" style="width:12px;"></i> <span class="note-reader-author-name"></span></span>
        ${project ? `<span><i data-lucide="folder" style="width:12px;"></i> ${project.name}</span>` : ''}
        <span><i data-lucide="clock" style="width:12px;"></i> Modificado em ${formatDate(note.updatedAt)}</span>
      `;

      setReading(true);
      createIcons({ icons });
      showDrawer();

      void authorNameOf(note)
        .then((name) => {
          meta.querySelector('.note-reader-author-name').textContent = name;
        })
        .catch((error) => pageFeedback.fail(error));
    }

    container.querySelector('#btn-new-note')?.addEventListener('click', () => openDrawer());
    container.querySelectorAll('.note-card').forEach((card) =>
      card.addEventListener('click', (e) => {
        if (e.target.closest('.note-actions')) return;

        const note = noteFromCard(card);

        if (!note) return;

        if (note.authorId === currentUserId) openDrawer(note);
        else openReader(note);
      }),
    );

    const closeDrawer = () => {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
    };
    container.querySelector('#btn-close-drawer')?.addEventListener('click', closeDrawer);
    cancelButton.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    expandButton.addEventListener('click', () => {
      const expanded = drawer.classList.toggle('is-expanded');

      expandButton.title = expanded ? 'Recolher' : 'Expandir';
      expandButton.setAttribute('aria-label', expandButton.title);
      expandButton.innerHTML = `<i data-lucide="${expanded ? 'minimize-2' : 'maximize-2'}" style="width:18px;"></i>`;
      createIcons({ icons });
    });

    const saveDrawerButton = new PendingButton(saveButton);

    saveButton.addEventListener('click', () => {
      if (!noteForm.validate()) {
        return;
      }

      const { title } = noteForm.values();
      const color = selectedColor();

      const payload = { title, body: rtEditor.value, color: color === '' ? null : color };
      const projectId = projSelect.value;

      if (projectId) {
        payload.projectId = projectId;
      }

      const existingId = container.querySelector('#note-id-input').value;

      void saveDrawerButton
        .during(() =>
          withFeedback(async () => {
            if (existingId) {
              await noteApi.update(workspaceContext.workspaceId, existingId, payload);
            } else {
              await noteApi.create(workspaceContext.workspaceId, payload);
            }
            closeDrawer();
          }),
        )
        .catch(() => undefined);
    });
  }

  workspaceContext.onChange(() => void refresh(listRegion()));

  render();
  void refresh();

  return container;
}
