import { session } from '../core/session-store.js';
import { workspaceContext } from '../core/workspace-context.js';
import { PendingButton } from '../components/pending-button.js';
import { anchorTo } from './anchor.js';

export class UserMenu {
  #onOpenProfile;
  #element = null;
  #panel = null;

  constructor({ onOpenProfile }) {
    this.#onOpenProfile = onOpenProfile;
  }

  mount(navigation) {
    this.#element = document.createElement('div');
    this.#element.className = 'user-chip';
    this.#element.innerHTML = `
      <button class="user-chip-trigger" data-label="Conta e workspace">
        <span class="user-chip-avatar">${this.#initials()}</span>
        <span class="user-chip-text">
          <strong>${session.user?.name ?? ''}</strong>
          <span>${workspaceContext.workspaceName}</span>
        </span>
      </button>
      <div class="user-chip-menu">
        <button class="user-chip-item" data-action="switch">Trocar workspace</button>
        <button class="user-chip-item" data-action="profile">Meu perfil</button>
        <div class="user-chip-separator"></div>
        <button class="user-chip-item is-danger" data-action="signout">Sair</button>
      </div>
    `;

    navigation.append(this.#element);
    this.#panel = this.#element.querySelector('.user-chip-menu');
    document.body.appendChild(this.#panel);
    this.#bind();

    workspaceContext.onChange(() => {
      this.#element.querySelector('.user-chip-text span').textContent =
        workspaceContext.workspaceName;
    });
  }

  #bind() {
    this.#element.querySelector('.user-chip-trigger').addEventListener('click', (event) => {
      event.stopPropagation();

      if (this.#panel.classList.contains('open')) {
        this.#panel.classList.remove('open');
        return;
      }

      anchorTo(this.#panel, this.#element.querySelector('.user-chip-trigger'));
      this.#panel.classList.add('open');
    });

    document.addEventListener('click', () => this.#panel.classList.remove('open'));

    this.#panel.querySelector('[data-action="switch"]').addEventListener('click', () => {
      workspaceContext.clearActive();
      window.location.assign('/workspace.html');
    });

    this.#panel.querySelector('[data-action="profile"]').addEventListener('click', () => {
      this.#panel.classList.remove('open');
      this.#onOpenProfile();
    });

    const signOut = this.#panel.querySelector('[data-action="signout"]');
    const button = new PendingButton(signOut);

    signOut.addEventListener('click', () => {
      void button
        .during(() => session.signOut())
        .then(() => window.location.assign('/login.html'))
        .catch(() => window.location.assign('/login.html'));
    });
  }

  #initials() {
    const name = session.user?.name ?? '';

    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
}
