import { createIcons, icons } from 'lucide';
import { notificationApi } from '../api/notification-api.js';
import { pageFeedback } from '../core/page-feedback.js';
import { regionLoader } from '../components/region-loader.js';
import { emptyState } from '../components/empty-state.js';
import { anchorTo } from './anchor.js';

const REFRESH_MS = 300000;

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export class NotificationBell {
  #onNavigate;
  #element = null;
  #trigger = null;
  #panel = null;
  #badge = null;
  #timer = null;
  #unread = 0;
  #outside = null;

  constructor({ onNavigate }) {
    this.#onNavigate = onNavigate;
  }

  mount(navigation) {
    this.#element = document.createElement('div');
    this.#element.className = 'notification-bell';
    this.#element.innerHTML = `
      <button class="icon-btn" data-label="Notificações">
        <i data-lucide="bell"></i>
        <span class="nav-label">Notificações</span>
        <span class="notification-badge" hidden>0</span>
      </button>
      <div class="notification-panel" hidden></div>
    `;

    navigation.append(this.#element);

    this.#trigger = this.#element.querySelector('.icon-btn');
    this.#panel = this.#element.querySelector('.notification-panel');
    this.#badge = this.#element.querySelector('.notification-badge');

    document.body.appendChild(this.#panel);

    this.#bind();
    void this.refresh();

    this.#timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  destroy() {
    clearInterval(this.#timer);
    document.removeEventListener('click', this.#outside);
    this.#panel.remove();
    this.#element.remove();
  }

  async refresh() {
    try {
      const items = await notificationApi.list(true);

      this.#showCount(items.length);
    } catch (error) {
      pageFeedback.fail(error);
    }
  }

  #showCount(count) {
    this.#unread = count;
    this.#badge.textContent = String(count);
    this.#badge.hidden = count === 0;
  }

  #bind() {
    this.#outside = (event) => {
      if (!this.#panel.contains(event.target) && !this.#element.contains(event.target)) {
        void this.#close();
      }
    };

    this.#trigger.addEventListener('click', (event) => {
      event.stopPropagation();

      if (this.#panel.hidden) {
        void this.#open();
        return;
      }

      void this.#close();
    });
  }

  async #open() {
    this.#panel.hidden = false;
    anchorTo(this.#panel, this.#trigger);
    document.addEventListener('click', this.#outside);

    await regionLoader.during(this.#panel, async () => {
      try {
        this.#render(await notificationApi.list(false));
      } catch (error) {
        pageFeedback.fail(error);
      }
    });

    anchorTo(this.#panel, this.#trigger);
  }

  async #close() {
    this.#panel.hidden = true;
    document.removeEventListener('click', this.#outside);

    if (this.#unread === 0) {
      return;
    }

    try {
      await notificationApi.markAllRead();
      this.#showCount(0);
    } catch (error) {
      pageFeedback.fail(error);
    }
  }

  #render(items) {
    if (items.length === 0) {
      this.#panel.replaceChildren(
        emptyState({ icon: 'bell-off', message: 'Nada por aqui. Você está em dia.' }),
      );
      createIcons({ icons });
      return;
    }

    this.#panel.replaceChildren(...items.map((item) => this.#row(item)));
  }

  #row(item) {
    const row = document.createElement('button');

    row.type = 'button';
    row.className = `notification-item${item.readAt === null ? ' is-unread' : ''}`;
    row.dataset.notification = item.id;

    const title = document.createElement('strong');
    title.textContent = item.title;

    const body = document.createElement('span');
    body.textContent = item.body;

    const when = document.createElement('time');
    when.textContent = DATE_FORMAT.format(new Date(item.createdAt));

    row.append(title, body, when);

    row.addEventListener('click', () => {
      void this.#close();
      this.#onNavigate('tasks');
    });

    return row;
  }
}
