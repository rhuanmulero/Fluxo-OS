const CREATE = '__create__';

export class Dropdown {
  #options;
  #value;
  #onChange;
  #placeholder;
  #creatable;
  #createLabel;
  #element;
  #trigger;
  #panel;
  #active = -1;
  #busy = false;
  #disabled = false;
  #outside;

  constructor(mount, {
    options = [],
    value = null,
    onChange = () => {},
    placeholder = 'Selecione',
    creatable = false,
    createLabel = 'Criar nova…',
  } = {}) {
    this.#options = options;
    this.#value = value;
    this.#onChange = onChange;
    this.#placeholder = placeholder;
    this.#creatable = creatable;
    this.#createLabel = createLabel;

    this.#element = document.createElement('div');
    this.#element.className = 'dropdown';
    this.#element.innerHTML = `
      <button type="button" class="dropdown-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="dropdown-value"></span>
      </button>
      <div class="dropdown-panel" role="listbox" hidden></div>
    `;

    this.#trigger = this.#element.querySelector('.dropdown-trigger');
    this.#panel = this.#element.querySelector('.dropdown-panel');

    mount.appendChild(this.#element);

    this.#outside = (event) => {
      if (!this.#element.contains(event.target)) this.close();
    };

    this.#bind();
    this.#paint();
  }

  get value() {
    return this.#value;
  }

  set disabled(disabled) {
    this.#disabled = disabled;

    if (disabled) this.close();

    this.#element.classList.toggle('is-disabled', disabled);
    this.#syncTrigger();
  }

  setOptions(options, value = this.#value) {
    this.#options = options;
    this.#value = value;
    this.#paint();
  }

  close() {
    this.#panel.hidden = true;
    this.#trigger.setAttribute('aria-expanded', 'false');
    this.#element.classList.remove('opens-up');
    this.#panel.removeAttribute('aria-activedescendant');
    this.#active = -1;
    document.removeEventListener('click', this.#outside);
  }

  destroy() {
    document.removeEventListener('click', this.#outside);
    this.#element.remove();
  }

  #open() {
    if (this.#busy || this.#disabled) return;

    this.#paint();
    this.#panel.hidden = false;
    this.#trigger.setAttribute('aria-expanded', 'true');
    this.#active = this.#options.findIndex((option) => option.value === this.#value);
    this.#highlight();
    document.addEventListener('click', this.#outside);

    const trigger = this.#trigger.getBoundingClientRect();
    const panel = this.#panel.getBoundingClientRect();
    const roomBelow = window.innerHeight - trigger.bottom;

    this.#element.classList.toggle('opens-up', roomBelow < panel.height && trigger.top > roomBelow);
  }

  #bind() {
    this.#trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      this.#panel.hidden ? this.#open() : this.close();
    });

    this.#trigger.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) && this.#panel.hidden) {
        event.preventDefault();
        this.#open();
      }
    });

    this.#element.addEventListener('keydown', (event) => this.#onKey(event));
  }

  #onKey(event) {
    if (this.#panel.hidden || this.#panel.querySelector('.dropdown-create')) return;

    const last = this.#items().length - 1;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.#trigger.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#active = this.#active >= last ? 0 : this.#active + 1;
      this.#highlight();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.#active = this.#active <= 0 ? last : this.#active - 1;
      this.#highlight();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.#active = 0;
      this.#highlight();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.#active = last;
      this.#highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.#items()[this.#active]?.click();
    } else if (event.key.length === 1) {
      this.#jumpTo(event.key);
    }
  }

  #jumpTo(character) {
    const target = character.toLowerCase();
    const index = this.#options.findIndex((option) =>
      String(option.label).toLowerCase().startsWith(target),
    );

    if (index === -1) return;

    this.#active = index;
    this.#highlight();
  }

  #items() {
    return [...this.#panel.querySelectorAll('.dropdown-option')];
  }

  #highlight() {
    this.#items().forEach((item, index) => {
      item.classList.toggle('is-active', index === this.#active);

      if (index === this.#active) {
        item.scrollIntoView({ block: 'nearest' });
        this.#panel.setAttribute('aria-activedescendant', item.id);
      }
    });
  }

  #label() {
    return this.#options.find((option) => option.value === this.#value)?.label ?? this.#placeholder;
  }

  #row(label, value, index) {
    const row = document.createElement('button');

    row.type = 'button';
    row.className = 'dropdown-option';
    row.id = `dropdown-option-${index}-${Math.random().toString(36).slice(2, 7)}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(value === this.#value));
    row.dataset.value = value;
    row.textContent = label;

    row.addEventListener('click', (event) => {
      event.stopPropagation();
      value === CREATE ? this.#askNew() : this.#select(value);
    });

    return row;
  }

  #paint() {
    this.#element.classList.toggle('is-empty', this.#value === null || this.#value === '');
    this.#trigger.querySelector('.dropdown-value').textContent = this.#label();

    const rows = this.#options.map((option, index) =>
      this.#row(option.label, option.value, index),
    );

    if (this.#creatable) {
      const create = this.#row(this.#createLabel, CREATE, rows.length);

      create.classList.add('is-create');
      rows.push(create);
    }

    this.#panel.replaceChildren(...rows);
  }

  #askNew() {
    this.#panel.innerHTML = `
      <div class="dropdown-create">
        <input type="text" class="settings-input" placeholder="Nome da nova pasta">
        <button type="button" class="btn-primary dropdown-create-confirm">Criar</button>
      </div>
    `;

    const input = this.#panel.querySelector('input');
    const confirm = this.#panel.querySelector('.dropdown-create-confirm');

    const submit = () => {
      const name = input.value.trim();

      if (name === '') {
        input.focus();
        return;
      }

      if (!this.#options.some((option) => option.value === name)) {
        this.#options = [...this.#options, { value: name, label: name }];
      }

      this.#select(name);
    };

    confirm.addEventListener('click', (event) => {
      event.stopPropagation();
      submit();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        this.#trigger.focus();
      }
    });

    input.focus();
  }

  #select(value) {
    this.#value = value;
    this.#paint();
    this.close();

    const result = this.#onChange(value);

    if (result instanceof Promise) {
      this.#setBusy(true);
      void result.finally(() => this.#setBusy(false));
    }
  }

  #setBusy(busy) {
    this.#busy = busy;
    this.#element.classList.toggle('is-busy', busy);
    this.#syncTrigger();
  }

  #syncTrigger() {
    this.#trigger.disabled = this.#busy || this.#disabled;
  }
}
