import { createIcons, icons } from 'lucide';

const CATEGORIES = [
  { id: 'account', label: 'Sua conta' },
  { id: 'workspace', label: 'Workspace' },
];

export class SettingsPanel {
  #sections = [];
  #element = null;
  #active = null;

  add(section, category = 'workspace') {
    this.#sections.push({ section, category });
    this.#active = this.#active ?? section.id;

    return this;
  }

  setDefaultSection(sectionId) {
    this.#active = sectionId;

    return this;
  }

  mount(container) {
    this.#element = document.createElement('div');
    this.#element.className = 'settings-overlay';
    this.#element.innerHTML = `
      <div class="settings-panel">
        <aside class="settings-rail">
          <h2>Configurações</h2>
          ${CATEGORIES.map((category) => this.#railSection(category)).join('')}
        </aside>
        <section class="settings-content"></section>
        <button class="settings-close" data-label="Fechar"><i data-lucide="x"></i></button>
      </div>
    `;

    container.appendChild(this.#element);
    this.#bind();
    this.render();
  }

  open(sectionId) {
    if (sectionId) this.#active = sectionId;
    this.#element.classList.add('active');
    this.render();
    if (sectionId) this.#element.querySelector('.settings-rail-item.active')?.focus();
  }

  close() {
    this.#element.classList.remove('active');
  }

  render() {
    const entry = this.#sections.find(({ section }) => section.id === this.#active) ?? this.#sections[0];

    if (!entry) {
      return;
    }

    this.#active = entry.section.id;

    for (const item of this.#element.querySelectorAll('[data-section]')) {
      item.classList.toggle('active', item.dataset.section === this.#active);
    }

    const content = this.#element.querySelector('.settings-content');

    content.innerHTML = '';
    entry.section.render(content);

    createIcons({ icons });
  }

  #railSection(category) {
    const entries = this.#sections.filter((entry) => entry.category === category.id);

    if (entries.length === 0) {
      return '';
    }

    return `
      <div class="settings-rail-section" data-category="${category.id}">
        <span class="settings-rail-group">${category.label}</span>
        ${entries.map(({ section }) => this.#railItem(section)).join('')}
      </div>
    `;
  }

  #railItem(section) {
    return `
      <button class="settings-rail-item" data-section="${section.id}">
        <i data-lucide="${section.icon}"></i><span>${section.label}</span>
      </button>
    `;
  }

  #bind() {
    this.#element.addEventListener('click', (event) => {
      if (event.target === this.#element) this.close();
    });

    this.#element.querySelector('.settings-close').addEventListener('click', () => this.close());

    for (const item of this.#element.querySelectorAll('[data-section]')) {
      item.addEventListener('click', () => {
        this.#active = item.dataset.section;
        this.render();
      });
    }
  }
}
