import { createIcons, icons } from 'lucide';

export class RichTextToolbar {
  #element;
  #onCommand;
  #openMenu = null;
  #outside;

  constructor(mount, commands, { onCommand }) {
    this.#onCommand = onCommand;

    this.#element = document.createElement('div');
    this.#element.className = 'rt-commands';

    const groups = new Map();

    for (const command of commands) {
      if (!groups.has(command.group)) {
        groups.set(command.group, []);
      }

      groups.get(command.group).push(command);
    }

    for (const group of groups.values()) {
      const holder = document.createElement('div');

      holder.className = 'rt-group';
      holder.append(...group.map((command) => this.#control(command)));
      this.#element.appendChild(holder);
    }

    mount.appendChild(this.#element);

    this.#outside = (event) => {
      if (!this.#element.contains(event.target)) this.closeMenu();
    };

    createIcons({ icons });
  }

  setEnabled(id, enabled) {
    this.#button(id).disabled = !enabled;
  }

  closeMenu() {
    if (this.#openMenu === null) {
      return;
    }

    this.#openMenu.hidden = true;
    this.#openMenu.previousElementSibling.setAttribute('aria-expanded', 'false');
    this.#openMenu = null;
    document.removeEventListener('mousedown', this.#outside);
  }

  #button(id) {
    return this.#element.querySelector(`.rt-btn[data-command="${id}"]`);
  }

  #control(command) {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'rt-btn';
    button.dataset.command = command.id;
    button.title = command.label;
    button.setAttribute('aria-label', command.label);
    button.innerHTML = `<i data-lucide="${command.icon}" style="width:16px;"></i>`;
    button.addEventListener('mousedown', (event) => event.preventDefault());

    if (!command.choices) {
      button.addEventListener('click', () => {
        this.closeMenu();
        this.#onCommand(command.id);
      });

      return button;
    }

    const holder = document.createElement('div');
    const menu = this.#menu(command);

    holder.className = 'rt-choice-holder';
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => this.#toggleMenu(menu));
    holder.append(button, menu);

    return holder;
  }

  #menu(command) {
    const menu = document.createElement('div');

    menu.className = 'rt-choices';
    menu.hidden = true;

    for (const choice of command.choices) {
      const option = document.createElement('button');

      option.type = 'button';
      option.className = 'rt-choice';
      option.dataset.value = choice.value;
      option.title = choice.label;
      option.setAttribute('aria-label', choice.label);
      option.innerHTML = choice.icon
        ? `<i data-lucide="${choice.icon}" style="width:14px;"></i><span>${choice.label}</span>`
        : `<span class="rt-dot ${choice.value}"></span><span>${choice.label}</span>`;
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => {
        this.closeMenu();
        this.#onCommand(command.id, choice.value);
      });

      menu.appendChild(option);
    }

    return menu;
  }

  #toggleMenu(menu) {
    const wasOpen = this.#openMenu === menu;

    this.closeMenu();

    if (wasOpen) {
      return;
    }

    menu.hidden = false;
    menu.previousElementSibling.setAttribute('aria-expanded', 'true');
    this.#openMenu = menu;
    document.addEventListener('mousedown', this.#outside);
  }
}
