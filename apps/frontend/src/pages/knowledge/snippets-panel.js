import { createIcons, icons } from 'lucide';
import '../../styles/pages/knowledge.css';
import { snippetApi } from '../../api/snippet-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { session } from '../../core/session-store.js';
import { pageFeedback } from '../../core/page-feedback.js';
import { regionLoader } from '../../components/region-loader.js';
import { emptyStateHtml } from '../../components/empty-state.js';
import { Dropdown } from '../../components/dropdown.js';
import { FormFields } from '../../components/form-field.js';
import { PendingButton } from '../../components/pending-button.js';

const LANGUAGE_OPTIONS = [
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'TypeScript', label: 'TypeScript' },
  { value: 'Python', label: 'Python' },
  { value: 'HTML/CSS', label: 'HTML/CSS' },
  { value: 'SQL', label: 'SQL' },
  { value: 'Bash/Shell', label: 'Bash / Terminal' },
  { value: 'Outro', label: 'Outro' },
];

const STATUS_LABELS = {
  PUBLIC: 'Público',
  PENDING: 'Aguardando aprovação',
  REJECTED: 'Recusado',
  PRIVATE: 'Privado',
};

export function snippetsPanel() {
  let container = null;
  let state = { search: '', folder: 'all' };
  let snippetsData = [];
  let isCompactMode = readCompactPreference();

  const currentUserId = session.user?.id ?? null;

  function readCompactPreference() {
    try {
      return localStorage.getItem('fluxo_snippets_compact') === 'true';
    } catch {
      return false;
    }
  }

  function writeCompactPreference(value) {
    try {
      localStorage.setItem('fluxo_snippets_compact', String(value));
    } catch {
      return;
    }
  }

  async function reload() {
    snippetsData = await snippetApi.list(workspaceContext.workspaceId, {
      folder: state.folder === 'all' ? undefined : state.folder,
      q: state.search,
    });

    render();
  }

  function listRegion() {
    return container.querySelector('.snippets-grid');
  }

  async function load() {
    render();

    try {
      await regionLoader.during(listRegion(), reload);
    } catch (error) {
      pageFeedback.fail(error);
    }
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

  function getUniqueFolders() {
    return [...new Set(snippetsData.map((snippet) => snippet.folder).filter(Boolean))].sort();
  }

  function folderOptions(extra = null) {
    const names = new Set(getUniqueFolders());

    if (extra) {
      names.add(extra);
    }

    return [...names].sort().map((folder) => ({ value: folder, label: folder }));
  }

  function getLanguageMeta(lang) {
    switch (lang) {
      case 'JavaScript':
        return { icon: 'file-json', cls: 'lang-javascript' };
      case 'TypeScript':
        return { icon: 'file-code-2', cls: 'lang-typescript' };
      case 'Python':
        return { icon: 'file-terminal', cls: 'lang-python' };
      case 'HTML/CSS':
        return { icon: 'layout', cls: 'lang-html-css' };
      case 'SQL':
        return { icon: 'database', cls: 'lang-sql' };
      case 'Bash/Shell':
        return { icon: 'terminal', cls: 'lang-bash' };
      default:
        return { icon: 'file-text', cls: 'lang-default' };
    }
  }

  function statusOf(snippet) {
    if (snippet.visibility === 'PUBLIC') return 'PUBLIC';
    if (snippet.moderationStatus === 'PENDING') return 'PENDING';
    if (snippet.moderationStatus === 'REJECTED') return 'REJECTED';
    return 'PRIVATE';
  }

  function render() {
    const folders = getUniqueFolders();

    container.innerHTML = `
            <aside class="tasks-sidebar">
                <div class="sidebar-section">
                    <div class="sidebar-label">Tecnologia / Pasta</div>
                    <button class="filter-btn ${state.folder === 'all' ? 'active' : ''}" data-folder="all">
                        <i data-lucide="layers" style="width:16px;"></i> Todos os Snippets
                    </button>
                    ${folders
                      .map(
                        (folder) => `
                        <button class="filter-btn ${state.folder === folder ? 'active' : ''}" data-folder="${folder}">
                            <i data-lucide="folder" style="width:16px;"></i> ${folder}
                        </button>
                    `,
                      )
                      .join('')}
                </div>
            </aside>

            <main class="notes-main">
                <header class="tasks-header">
                    <div class="header-info">
                        <h1>Snippets de Código</h1>
                        <p>${snippetsData.length} trechos salvos no Vault</p>
                    </div>
                    <div style="display:flex; gap: 12px; align-items: center;">
                        <button class="btn-secondary" id="btn-toggle-compact" style="border: 1px solid var(--surface-border);" title="${isCompactMode ? 'Expandir Código' : 'Ocultar Código'}">
                            <i data-lucide="${isCompactMode ? 'layout-grid' : 'list'}" style="width:16px;"></i>
                        </button>

                        <button class="btn-create-task" id="btn-new-snippet">
                            <i data-lucide="plus" style="width:18px;"></i> Novo Snippet
                        </button>
                    </div>
                </header>

                <div class="snippets-grid ${isCompactMode ? 'compact-mode' : ''}">
                    ${
                      snippetsData.length === 0
                        ? emptyStateHtml({
                            icon: 'code-2',
                            title: 'Nenhum snippet encontrado',
                            message: 'Salve funções, queries e scripts que você usa com frequência.',
                          })
                        : snippetsData.map(renderSnippetCard).join('')
                    }
                </div>

                <div id="drawer-overlay" class="task-drawer-overlay"></div>

                <div id="snippet-drawer" class="task-drawer">
                    <div class="drawer-header">
                        <h2 id="drawer-title"><i data-lucide="code" style="width:18px;"></i> Editar Snippet</h2>
                        <button class="btn-icon-small" id="btn-close-drawer"><i data-lucide="x" style="width:20px;"></i></button>
                    </div>
                    <div class="drawer-content">
                        <input type="hidden" id="snippet-id-input">

                        <div class="form-group" data-field="name">
                            <label>Nome / Propósito</label>
                            <input type="text" id="snippet-title" placeholder="Ex: Componente Botão Padrão..." autocomplete="off" style="font-size: 16px; font-weight: 500;">
                        </div>

                        <div class="grid-2-col">
                            <div class="form-group" data-field="folder">
                                <label>Pasta (Contexto)</label>
                                <div id="snippet-folder"></div>
                            </div>
                            <div class="form-group">
                                <label>Linguagem</label>
                                <div id="snippet-language"></div>
                            </div>
                        </div>

                        <div class="form-group" data-field="code" style="flex: 1; display:flex; flex-direction:column;">
                            <label>Código-fonte</label>
                            <textarea id="snippet-code-editor" class="code-editor-textarea" placeholder="Cole seu código aqui..." spellcheck="false"></textarea>
                        </div>
                    </div>
                    <div class="drawer-footer">
                        <button id="btn-cancel-drawer" class="btn-secondary">Cancelar</button>
                        <button id="btn-save-drawer" class="btn-primary">Salvar Snippet</button>
                    </div>
                </div>
            </main>
        `;

    attachEventListeners();
    createIcons({ icons });
  }

  function renderSnippetCard(snippet) {
    const safeCode = snippet.code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const meta = getLanguageMeta(snippet.language);
    const status = statusOf(snippet);
    const isMine = snippet.authorId === currentUserId;

    const canRequest =
      isMine && snippet.visibility === 'PRIVATE' && snippet.moderationStatus !== 'PENDING';
    const canModerate = workspaceContext.isAdmin && snippet.moderationStatus === 'PENDING';
    const canWrite = isMine || workspaceContext.isAdmin;

    return `
            <div class="snippet-card" data-id="${snippet.id}">
                <div class="snippet-header">
                    <div class="snippet-title-group">
                        <span class="snippet-title">${snippet.name}</span>
                        <span class="snippet-folder"><i data-lucide="folder" style="width:10px; display:inline-block;"></i> ${snippet.folder || 'Geral'}</span>
                    </div>
                    <span class="snippet-lang-badge ${meta.cls}">
                        <i data-lucide="${meta.icon}" style="width:12px;"></i> ${snippet.language}
                    </span>
                </div>

                <pre class="snippet-code-preview"><code>${safeCode}</code></pre>

                <div class="snippet-actions">
                    <button class="btn-copy-snippet" data-id="${snippet.id}">
                        <i data-lucide="copy" style="width:12px;"></i> Copiar
                    </button>
                    <span class="snippet-status status-${status.toLowerCase()}">${STATUS_LABELS[status]}</span>
                    <div class="snippet-card-hover-actions">
                        ${canRequest ? `<button class="action-btn btn-request-publish" title="Pedir publicação"><i data-lucide="send" style="width:14px;"></i></button>` : ''}
                        ${canModerate ? `<button class="action-btn btn-approve-snippet" title="Aprovar"><i data-lucide="check" style="width:14px;"></i></button><button class="action-btn btn-reject-snippet" title="Recusar"><i data-lucide="x" style="width:14px;"></i></button>` : ''}
                        ${canWrite ? `<button class="action-btn btn-edit-snippet" title="Editar"><i data-lucide="edit-2" style="width:14px;"></i></button><button class="action-btn btn-delete-snippet" title="Excluir"><i data-lucide="trash-2" style="width:14px;"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `;
  }

  function snippetFromCard(element) {
    const id = element.closest('.snippet-card').dataset.id;
    return snippetsData.find((snippet) => snippet.id === id) ?? null;
  }

  function attachEventListeners() {
    const snippetLanguage = new Dropdown(container.querySelector('#snippet-language'), {
      options: LANGUAGE_OPTIONS,
      value: 'JavaScript',
    });

    const folderPicker = new Dropdown(container.querySelector('#snippet-folder'), {
      options: folderOptions(),
      value: null,
      placeholder: 'Escolha ou crie uma pasta',
      creatable: true,
      createLabel: 'Criar nova pasta…',
    });

    const snippetForm = new FormFields(container.querySelector('#snippet-drawer'), [
      { name: 'name', required: true, message: 'Informe o nome do snippet.' },
      {
        name: 'folder',
        required: true,
        message: 'Informe a pasta do snippet.',
        read: () => folderPicker.value ?? '',
      },
      { name: 'code', required: true, message: 'Cole o código-fonte do snippet.' },
    ]);

    const overlay = container.querySelector('#drawer-overlay');
    const drawer = container.querySelector('#snippet-drawer');

    container.querySelector('#btn-toggle-compact')?.addEventListener('click', () => {
      isCompactMode = !isCompactMode;
      writeCompactPreference(isCompactMode);
      render();
    });

    container.querySelectorAll('.filter-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        state.folder = e.currentTarget.dataset.folder;
        void refresh(listRegion());
      }),
    );

    container.querySelectorAll('.btn-copy-snippet').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);

        if (!snippet) {
          return;
        }

        const button = e.currentTarget;

        void navigator.clipboard.writeText(snippet.code).then(() => {
          const originalHtml = button.innerHTML;
          button.innerHTML = '<i data-lucide="check" style="width:12px;"></i> Copiado!';
          button.style.color = '#10b981';
          button.style.borderColor = '#10b981';
          createIcons({ icons });

          setTimeout(() => {
            button.innerHTML = originalHtml;
            button.style.color = '';
            button.style.borderColor = '';
            createIcons({ icons });
          }, 2000);
        });
      });
    });

    container.querySelectorAll('.btn-request-publish').forEach((btn) => {
      const pendingButton = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);

        if (!snippet) {
          return;
        }

        void pendingButton
          .during(() =>
            withFeedback(() =>
              snippetApi.requestPublication(workspaceContext.workspaceId, snippet.id),
            ),
          )
          .catch(() => undefined);
      });
    });

    container.querySelectorAll('.btn-approve-snippet').forEach((btn) => {
      const pendingButton = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);

        if (!snippet) {
          return;
        }

        void pendingButton
          .during(() => withFeedback(() => snippetApi.review(workspaceContext.workspaceId, snippet.id, true)))
          .catch(() => undefined);
      });
    });

    container.querySelectorAll('.btn-reject-snippet').forEach((btn) => {
      const pendingButton = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);

        if (!snippet) {
          return;
        }

        void pendingButton
          .during(() => withFeedback(() => snippetApi.review(workspaceContext.workspaceId, snippet.id, false)))
          .catch(() => undefined);
      });
    });

    function openDrawer(snippet = null) {
      snippetForm.clear();

      const sId = container.querySelector('#snippet-id-input');
      const sTitle = container.querySelector('#snippet-title');
      const sCode = container.querySelector('#snippet-code-editor');

      if (snippet) {
        container.querySelector('#drawer-title').innerHTML =
          `<i data-lucide="code" style="width:18px;"></i> Editar Snippet`;
        sId.value = snippet.id;
        sTitle.value = snippet.name;
        folderPicker.setOptions(folderOptions(snippet.folder), snippet.folder || null);
        snippetLanguage.setOptions(LANGUAGE_OPTIONS, snippet.language);
        sCode.value = snippet.code;
      } else {
        container.querySelector('#drawer-title').innerHTML =
          `<i data-lucide="plus" style="width:18px;"></i> Novo Snippet`;
        sId.value = '';
        sTitle.value = '';
        folderPicker.setOptions(folderOptions(), state.folder !== 'all' ? state.folder : null);
        snippetLanguage.setOptions(LANGUAGE_OPTIONS, 'JavaScript');
        sCode.value = '';
      }

      overlay.classList.add('active');
      drawer.classList.add('active');
      setTimeout(() => sTitle.focus(), 200);
    }

    container.querySelector('#btn-new-snippet')?.addEventListener('click', () => openDrawer());

    container.querySelectorAll('.snippet-card').forEach((card) =>
      card.addEventListener('click', (e) => {
        if (e.target.closest('.snippet-actions')) return;
        const snippet = snippetFromCard(card);
        if (snippet && (snippet.authorId === currentUserId || workspaceContext.isAdmin)) {
          openDrawer(snippet);
        }
      }),
    );

    container.querySelectorAll('.btn-edit-snippet').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);
        if (snippet) openDrawer(snippet);
      }),
    );

    container.querySelectorAll('.btn-delete-snippet').forEach((btn) => {
      const pendingButton = new PendingButton(btn);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snippet = snippetFromCard(e.currentTarget);

        if (!snippet) {
          return;
        }

        void pendingButton
          .during(() => withFeedback(() => snippetApi.remove(workspaceContext.workspaceId, snippet.id)))
          .catch(() => undefined);
      });
    });

    const closeDrawer = () => {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
    };
    container.querySelector('#btn-close-drawer')?.addEventListener('click', closeDrawer);
    container.querySelector('#btn-cancel-drawer')?.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    const saveDrawerButton = new PendingButton(container.querySelector('#btn-save-drawer'));

    container.querySelector('#btn-save-drawer')?.addEventListener('click', () => {
      if (!snippetForm.validate()) {
        return;
      }

      const { name, folder, code } = snippetForm.values();

      const payload = {
        name,
        folder,
        language: snippetLanguage.value,
        code,
      };

      const existingId = container.querySelector('#snippet-id-input').value;

      void saveDrawerButton
        .during(() =>
          withFeedback(async () => {
            if (existingId) {
              await snippetApi.update(workspaceContext.workspaceId, existingId, payload);
            } else {
              await snippetApi.create(workspaceContext.workspaceId, payload);
            }
            closeDrawer();
          }),
        )
        .catch(() => undefined);
    });
  }

  return {
    mount(mountPoint, sharedState) {
      state = sharedState;
      container = document.createElement('div');
      container.className = 'knowledge-panel-root snippets-panel';
      mountPoint.replaceChildren(container);

      return load();
    },
    refresh() {
      return refresh(listRegion() ?? container);
    },
  };
}
