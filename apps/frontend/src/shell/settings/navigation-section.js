import { settings } from '../../core/settings-store.js';

export class NavigationSection {
  id = 'navigation';
  icon = 'panel-left';
  label = 'Navegação';

  #panel;
  #navigation;

  constructor(panel, navigation) {
    this.#panel = panel;
    this.#navigation = navigation;
  }

  render(content) {
    const sidebar = settings.navigationMode === 'sidebar';

    content.innerHTML = `
      <h3>Modo da barra</h3>
      <div class="settings-choices">
        <button class="settings-choice ${sidebar ? '' : 'active'}" data-mode="floating">
          <i data-lucide="move"></i><span>Flutuante</span>
        </button>
        <button class="settings-choice ${sidebar ? 'active' : ''}" data-mode="sidebar">
          <i data-lucide="panel-left"></i><span>Barra lateral fixa</span>
        </button>
      </div>
      <h3>Lado da barra lateral</h3>
      <div class="settings-choices">
        <button class="settings-choice ${settings.sidebarSide === 'left' ? 'active' : ''}" data-side="left">Esquerda</button>
        <button class="settings-choice ${settings.sidebarSide === 'right' ? 'active' : ''}" data-side="right">Direita</button>
      </div>
      <h3>Atalhos</h3>
      <ul class="settings-shortcuts">
        ${this.#navigation.routes
          .map((route) => `<li><span>${route.label}</span><kbd>${route.shortcut}</kbd></li>`)
          .join('')}
        <li><span>Configurações</span><kbd>Alt+,</kbd></li>
      </ul>
    `;

    content.insertAdjacentHTML(
      'beforeend',
      `
      <h3>Barra reduzida</h3>
      <div class="settings-choices">
        <button class="settings-choice ${settings.sidebarCollapsed ? '' : 'active'}" data-collapsed="false">Sempre larga</button>
        <button class="settings-choice ${settings.sidebarCollapsed ? 'active' : ''}" data-collapsed="true">Reduzir sozinha</button>
      </div>
      <p class="settings-hint">Reduzida, a barra mostra só os ícones e cresce quando o mouse passa por cima. Vale no modo barra lateral.</p>
    `,
    );

    for (const button of content.querySelectorAll('[data-mode]')) {
      button.addEventListener('click', () => {
        settings.navigationMode = button.dataset.mode;
        this.#navigation.applyMode();
        this.#panel.render();
      });
    }

    for (const button of content.querySelectorAll('[data-side]')) {
      button.addEventListener('click', () => {
        settings.sidebarSide = button.dataset.side;
        this.#navigation.applyMode();
        this.#panel.render();
      });
    }

    for (const button of content.querySelectorAll('[data-collapsed]')) {
      button.addEventListener('click', () => {
        settings.sidebarCollapsed = button.dataset.collapsed === 'true';
        this.#navigation.applyMode();
        this.#panel.render();
      });
    }
  }
}
