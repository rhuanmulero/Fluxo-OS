import { createIcons, icons } from 'lucide';
import '../styles/pages/knowledge.css';
import { workspaceContext } from '../core/workspace-context.js';
import { regionLoader } from '../components/region-loader.js';
import { documentsPanel } from './knowledge/documents-panel.js';
import { bookmarksPanel } from './knowledge/bookmarks-panel.js';
import { snippetsPanel } from './knowledge/snippets-panel.js';

const LABELS = {
  documents: 'Documentos',
  bookmarks: 'Links',
  snippets: 'Snippets',
};

export default function KnowledgePage() {
  const container = document.createElement('div');
  container.className = 'knowledge-container';

  const state = { tab: 'documents', search: '', folder: 'all' };

  const panels = {
    documents: documentsPanel(),
    bookmarks: bookmarksPanel(),
    snippets: snippetsPanel(),
  };

  function render() {
    container.innerHTML = `
      <header class="knowledge-header">
        <div class="knowledge-tabs" role="tablist">
          ${Object.entries(LABELS)
            .map(
              ([tab, label]) => `
              <button type="button" role="tab" class="knowledge-tab" data-tab="${tab}"
                      aria-selected="${state.tab === tab}">${label}</button>`,
            )
            .join('')}
        </div>
        <input type="search" class="knowledge-search" placeholder="Buscar em ${LABELS[state.tab]}..."
               value="${state.search}" autocomplete="off">
      </header>
      <div class="knowledge-body"></div>
    `;

    bind();
    createIcons({ icons });

    return mountActive();
  }

  function mountActive() {
    const body = container.querySelector('.knowledge-body');
    const host = document.createElement('div');

    host.className = 'knowledge-panel-host';
    body.replaceChildren(host);

    return regionLoader.during(body, () => panels[state.tab].mount(host, state));
  }

  function bind() {
    container.querySelectorAll('.knowledge-tab').forEach((tab) =>
      tab.addEventListener('click', () => {
        if (state.tab === tab.dataset.tab) {
          return;
        }

        state.tab = tab.dataset.tab;
        state.folder = 'all';
        void render();
      }),
    );

    const search = container.querySelector('.knowledge-search');

    search.addEventListener('change', () => {
      state.search = search.value.trim();
      void mountActive();
    });
  }

  workspaceContext.onChange(() => void mountActive());

  void render();

  return container;
}
