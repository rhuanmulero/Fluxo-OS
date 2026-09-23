import { createIcons, icons } from 'lucide';
import { documentApi } from '../../api/document-api.js';
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

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

export function humanSize(bytes) {
  if (bytes < KILOBYTE) return `${bytes} B`;
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`;

  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

export function documentsPanel() {
  let container = null;
  let state = { search: '', folder: 'all' };
  let documents = [];

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

  function folders() {
    return [...new Set(documents.map((document) => document.folder).filter(Boolean))].sort();
  }

  function folderOptions(extra = null) {
    const names = new Set(folders());

    if (extra) {
      names.add(extra);
    }

    return [...names].sort().map((folder) => ({ value: folder, label: folder }));
  }

  function listRegion() {
    return container?.querySelector('#document-list');
  }

  async function reload() {
    documents = await documentApi.list(workspaceContext.workspaceId, {
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

    for (const document of documents) {
      const bucket = groups.get(document.folder) ?? [];

      bucket.push(document);
      groups.set(document.folder, bucket);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function renderCard(document) {
    const mine = document.authorId === currentUserId;
    const canRemove = mine || (document.scope === 'WORKSPACE' && workspaceContext.isAdmin);

    return `
      <article class="knowledge-card" data-document="${document.id}">
        <div class="knowledge-card-main">
          <strong>${document.name}</strong>
          <span class="knowledge-card-meta">
            ${document.fileName} · ${humanSize(document.sizeBytes)}
          </span>
        </div>
        <span class="knowledge-scope">${SCOPE_LABELS[document.scope]}</span>
        <a class="action-btn btn-download-document"
           href="${documentApi.downloadUrl(workspaceContext.workspaceId, document.id)}"
           download title="Baixar">
          <i data-lucide="download"></i>
        </a>
        ${
          canRemove
            ? `<button class="action-btn btn-delete-document" title="Excluir">
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
          <p>${documents.length} documento${documents.length === 1 ? '' : 's'} no Vault</p>
          <button class="btn-create-task" id="btn-new-document">
            <i data-lucide="upload" style="width:18px;"></i> Enviar documento
          </button>
        </header>

        <div class="knowledge-list" id="document-list">
          ${
            documents.length === 0
              ? emptyStateHtml({
                  icon: 'folder-open',
                  title: 'Nenhum documento por aqui',
                  message: 'Envie o primeiro arquivo para a base de conhecimento do time.',
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

        <div class="task-drawer-overlay" id="document-overlay"></div>
        <aside class="task-drawer" id="document-drawer">
          <header class="drawer-header">
            <h2>Enviar documento</h2>
            <button class="btn-icon-small" id="btn-close-document"><i data-lucide="x"></i></button>
          </header>
          <div class="drawer-content">
            <div class="form-group" data-field="file">
              <label>Arquivo</label>
              <input type="file" id="document-file">
            </div>
            <div class="form-group" data-field="name">
              <label>Nome</label>
              <input type="text" id="document-name" maxlength="120" autocomplete="off">
            </div>
            <div class="form-group" data-field="folder">
              <label>Pasta</label>
              <div id="document-folder"></div>
            </div>
            <div class="form-group" data-field="scope">
              <label>Escopo</label>
              <div id="document-scope"></div>
            </div>
          </div>
          <footer class="drawer-footer">
            <button class="btn-secondary" id="btn-cancel-document">Cancelar</button>
            <button class="btn-primary" id="btn-save-document">Enviar</button>
          </footer>
        </aside>
      </section>
    `;

    bind();
    createIcons({ icons });
  }

  function bind() {
    const overlay = container.querySelector('#document-overlay');
    const drawer = container.querySelector('#document-drawer');

    const folderPicker = new Dropdown(container.querySelector('#document-folder'), {
      options: folderOptions(),
      value: null,
      placeholder: 'Escolha ou crie uma pasta',
      creatable: true,
      createLabel: 'Criar nova pasta…',
    });

    const scopePicker = new Dropdown(container.querySelector('#document-scope'), {
      options: scopeOptions(),
      value: 'PRIVATE',
    });

    const form = new FormFields(drawer, [
      {
        name: 'file',
        required: true,
        message: 'Escolha o arquivo a enviar.',
        read: (block) => (block.querySelector('input[type="file"]').files.length > 0 ? 'ok' : ''),
      },
      { name: 'name', required: true, message: 'Informe o nome do documento.' },
      {
        name: 'folder',
        required: true,
        message: 'Informe a pasta do documento.',
        read: () => folderPicker.value ?? '',
      },
      { name: 'scope', required: true, message: 'Escolha o escopo.', read: () => scopePicker.value ?? '' },
    ]);

    const close = () => {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
    };

    container.querySelector('#btn-new-document').addEventListener('click', () => {
      form.clear();
      container.querySelector('#document-file').value = '';
      container.querySelector('#document-name').value = '';
      folderPicker.setOptions(folderOptions(), state.folder === 'all' ? null : state.folder);
      scopePicker.setOptions(scopeOptions(), 'PRIVATE');
      overlay.classList.add('active');
      drawer.classList.add('active');
    });

    container.querySelector('#btn-close-document').addEventListener('click', close);
    container.querySelector('#btn-cancel-document').addEventListener('click', close);
    overlay.addEventListener('click', close);

    const saveButton = new PendingButton(container.querySelector('#btn-save-document'));

    container.querySelector('#btn-save-document').addEventListener('click', () => {
      if (!form.validate()) {
        return;
      }

      const data = new FormData();

      data.append('file', container.querySelector('#document-file').files[0]);
      data.append('name', container.querySelector('#document-name').value.trim());
      data.append('folder', folderPicker.value);
      data.append('scope', scopePicker.value);

      if (scopePicker.value === 'PROJECT' && workspaceContext.projectId) {
        data.append('projectId', workspaceContext.projectId);
      }

      void saveButton
        .during(() => documentApi.create(workspaceContext.workspaceId, data))
        .then(() => {
          close();

          return refresh(listRegion());
        })
        .catch((error) => pageFeedback.fail(error));
    });

    container.querySelectorAll('.btn-delete-document').forEach((trigger) => {
      const button = new PendingButton(trigger);
      const id = trigger.closest('[data-document]').dataset.document;

      trigger.addEventListener('click', () => {
        void confirmDialog
          .ask({
            title: 'Excluir documento',
            message: 'O arquivo sai do Vault e não pode ser recuperado.',
            confirmLabel: 'Excluir',
            danger: true,
          })
          .then((confirmed) =>
            confirmed
              ? button
                  .during(() => documentApi.remove(workspaceContext.workspaceId, id))
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
