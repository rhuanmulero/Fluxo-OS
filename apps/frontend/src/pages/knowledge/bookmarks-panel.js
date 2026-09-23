import { createIcons, icons } from 'lucide';
import { bookmarkApi } from '../../api/bookmark-api.js';
import { workspaceContext } from '../../core/workspace-context.js';
import { session } from '../../core/session-store.js';
import { pageFeedback } from '../../core/page-feedback.js';
import { regionLoader } from '../../components/region-loader.js';
import { emptyStateHtml } from '../../components/empty-state.js';
import { Dropdown } from '../../components/dropdown.js';
import { FormFields } from '../../components/form-field.js';
import { PendingButton } from '../../components/pending-button.js';
import { confirmDialog } from '../../components/confirm-dialog.js';

const SCOPE_LABELS = {
  PRIVATE: 'Privado',
  PROJECT: 'Projeto',
  WORKSPACE: 'Workspace',
};

const ACCEPTED_PROTOCOLS = ['http:', 'https:'];

export function isSupported(url) {
  try {
    return ACCEPTED_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function bookmarksPanel() {
  let container = null;
  let state = { search: '', folder: 'all' };
  let bookmarks = [];
  let editingId = null;

  const currentUserId = session.user?.id ?? null;

  function scopeOptions() {
    const options = [
      { value: 'PRIVATE', label: 'Privado' },
      { value: 'PROJECT', label: 'Projeto' },
    ];

    if (workspaceContext.isAdmin) {
      options.push({ value: 'WORKSPACE', label: 'Workspace' });
    }

    return options;
  }

  function folderOptions(extra = null) {
    const names = new Set(
      bookmarks.map((bookmark) => bookmark.folder).filter(Boolean),
    );

    if (extra) {
      names.add(extra);
    }

    return [...names].sort().map((folder) => ({ value: folder, label: folder }));
  }

  function listRegion() {
    return container?.querySelector('#bookmark-list');
  }

  async function reload() {
    bookmarks = await bookmarkApi.list(workspaceContext.workspaceId, {
      folder: state.folder === 'all' ? undefined : state.folder,
      q: state.search,
    });

    render();
  }

  async function load() {
    try {
      await reload();
    } catch (error) {
      pageFeedback.fail(error);
    }
  }

  async function refresh(region = container) {
    await regionLoader.during(region, load);
  }

  function groupByFolder() {
    const groups = new Map();

    for (const bookmark of bookmarks) {
      const bucket = groups.get(bookmark.folder) ?? [];

      bucket.push(bookmark);
      groups.set(bookmark.folder, bucket);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function renderCard(bookmark) {
    const mine = bookmark.authorId === currentUserId;
    const canWrite = mine || (bookmark.scope === 'WORKSPACE' && workspaceContext.isAdmin);

    return `
      <article class="knowledge-card" data-bookmark="${bookmark.id}">
        <div class="knowledge-card-main">
          <a class="bookmark-link" href="${bookmark.url}" target="_blank" rel="noopener noreferrer">
            ${bookmark.name}
          </a>
          <span class="knowledge-card-meta">${domainOf(bookmark.url)}</span>
        </div>
        <span class="knowledge-scope">${SCOPE_LABELS[bookmark.scope]}</span>
        ${
          canWrite
            ? `<button class="action-btn btn-edit-bookmark" title="Editar">
                 <i data-lucide="pencil"></i>
               </button>
               <button class="action-btn btn-delete-bookmark" title="Excluir">
                 <i data-lucide="trash-2"></i>
               </button>`
            : ''
        }
      </article>
    `;
  }

  function render() {
    const groups = groupByFolder();

    container.innerHTML = `
      <section class="knowledge-panel">
        <header class="knowledge-panel-header">
          <p>${bookmarks.length} link${bookmarks.length === 1 ? '' : 's'} salvos</p>
          <button class="btn-create-task" id="btn-new-bookmark">
            <i data-lucide="plus" style="width:18px;"></i> Novo link
          </button>
        </header>

        <div class="knowledge-list" id="bookmark-list">
          ${
            bookmarks.length === 0
              ? emptyStateHtml({
                  icon: 'link',
                  title: 'Nenhum link por aqui',
                  message: 'Guarde a documentação e as referências que o time usa sempre.',
                })
              : groups
                  .map(
                    ([folder, items]) => `
                    <div class="knowledge-group">
                      <h3>${folder}</h3>
                      ${items.map(renderCard).join('')}
                    </div>`,
                  )
                  .join('')
          }
        </div>

        <div class="task-drawer-overlay" id="bookmark-overlay"></div>
        <aside class="task-drawer" id="bookmark-drawer">
          <header class="drawer-header">
            <h2 id="bookmark-drawer-title">Novo link</h2>
            <button class="btn-icon-small" id="btn-close-bookmark"><i data-lucide="x"></i></button>
          </header>
          <div class="drawer-content">
            <div class="form-group" data-field="name">
              <label>Nome</label>
              <input type="text" id="bookmark-name" maxlength="120" autocomplete="off">
            </div>
            <div class="form-group" data-field="url">
              <label>Endereço</label>
              <input type="url" id="bookmark-url" maxlength="2048" autocomplete="off"
                     placeholder="https://">
            </div>
            <div class="form-group" data-field="folder">
              <label>Pasta</label>
              <div id="bookmark-folder"></div>
            </div>
            <div class="form-group" data-field="scope">
              <label>Escopo</label>
              <div id="bookmark-scope"></div>
            </div>
          </div>
          <footer class="drawer-footer">
            <button class="btn-secondary" id="btn-cancel-bookmark">Cancelar</button>
            <button class="btn-primary" id="btn-save-bookmark">Salvar</button>
          </footer>
        </aside>
      </section>
    `;

    bind();
    createIcons({ icons });
  }

  function bind() {
    const overlay = container.querySelector('#bookmark-overlay');
    const drawer = container.querySelector('#bookmark-drawer');

    const folderPicker = new Dropdown(container.querySelector('#bookmark-folder'), {
      options: folderOptions(),
      value: null,
      placeholder: 'Escolha ou crie uma pasta',
      creatable: true,
      createLabel: 'Criar nova pasta…',
    });

    const scopePicker = new Dropdown(container.querySelector('#bookmark-scope'), {
      options: scopeOptions(),
      value: 'PRIVATE',
    });

    const form = new FormFields(drawer, [
      { name: 'name', required: true, message: 'Informe o nome do link.' },
      { name: 'url', required: true, message: 'Informe o endereço do link.' },
      {
        name: 'folder',
        required: true,
        message: 'Informe a pasta do link.',
        read: () => folderPicker.value ?? '',
      },
      { name: 'scope', required: true, message: 'Escolha o escopo.', read: () => scopePicker.value ?? '' },
    ]);

    const close = () => {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
    };

    const open = (bookmark) => {
      editingId = bookmark?.id ?? null;
      form.clear();

      container.querySelector('#bookmark-drawer-title').textContent = bookmark
        ? 'Editar link'
        : 'Novo link';
      container.querySelector('#bookmark-name').value = bookmark?.name ?? '';
      container.querySelector('#bookmark-url').value = bookmark?.url ?? '';
      folderPicker.setOptions(
        folderOptions(bookmark?.folder),
        bookmark?.folder ?? (state.folder === 'all' ? null : state.folder),
      );
      scopePicker.setOptions(scopeOptions(), bookmark?.scope ?? 'PRIVATE');

      overlay.classList.add('active');
      drawer.classList.add('active');
    };

    container.querySelector('#btn-new-bookmark').addEventListener('click', () => open(null));
    container.querySelector('#btn-close-bookmark').addEventListener('click', close);
    container.querySelector('#btn-cancel-bookmark').addEventListener('click', close);
    overlay.addEventListener('click', close);

    const saveButton = new PendingButton(container.querySelector('#btn-save-bookmark'));

    container.querySelector('#btn-save-bookmark').addEventListener('click', () => {
      if (!form.validate()) {
        return;
      }

      const url = container.querySelector('#bookmark-url').value.trim();

      if (!isSupported(url)) {
        form.showError('url', 'Informe um endereço que comece com http:// ou https://.');
        return;
      }

      const payload = {
        name: container.querySelector('#bookmark-name').value.trim(),
        folder: folderPicker.value,
        url,
        scope: scopePicker.value,
      };

      if (scopePicker.value === 'PROJECT' && workspaceContext.projectId) {
        payload.projectId = workspaceContext.projectId;
      }

      const operation = editingId
        ? () => bookmarkApi.update(workspaceContext.workspaceId, editingId, payload)
        : () => bookmarkApi.create(workspaceContext.workspaceId, payload);

      void saveButton
        .during(operation)
        .then(() => {
          close();

          return refresh(listRegion());
        })
        .catch((error) => pageFeedback.fail(error));
    });

    container.querySelectorAll('.btn-edit-bookmark').forEach((trigger) => {
      const id = trigger.closest('[data-bookmark]').dataset.bookmark;

      trigger.addEventListener('click', () =>
        open(bookmarks.find((bookmark) => bookmark.id === id)),
      );
    });

    container.querySelectorAll('.btn-delete-bookmark').forEach((trigger) => {
      const button = new PendingButton(trigger);
      const id = trigger.closest('[data-bookmark]').dataset.bookmark;

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Excluir link',
            message: 'O link sai da base de conhecimento.',
            confirmLabel: 'Excluir',
            danger: true,
          })
          .then((confirmed) =>
            confirmed
              ? button
                  .during(() => bookmarkApi.remove(workspaceContext.workspaceId, id))
                  .then(() => refresh(listRegion()))
              : null,
          )
          .catch((error) => pageFeedback.fail(error));
      });
    });
  }

  return {
    mount(mountPoint, sharedState) {
      state = sharedState;
      container = document.createElement('div');
      container.className = 'knowledge-panel-root';
      mountPoint.replaceChildren(container);

      return load();
    },
    refresh() {
      return refresh(listRegion() ?? container);
    },
  };
}
