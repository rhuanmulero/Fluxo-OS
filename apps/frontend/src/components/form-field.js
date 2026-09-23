export class FormFields {
  #root;
  #definitions;

  constructor(root, definitions) {
    this.#root = root;
    this.#definitions = definitions;
    this.markRequired();
  }

  markRequired() {
    for (const definition of this.#definitions) {
      if (!definition.required) continue;

      const label = this.#block(definition.name)?.querySelector('label');

      if (label && !label.querySelector('.field-required')) {
        const mark = document.createElement('span');
        mark.className = 'field-required';
        mark.textContent = '*';
        mark.setAttribute('aria-hidden', 'true');
        label.appendChild(mark);
      }
    }
  }

  values() {
    const result = {};

    for (const definition of this.#definitions) {
      result[definition.name] = this.#read(definition);
    }

    return result;
  }

  validate() {
    this.clear();

    const missing = this.#definitions.filter(
      (definition) => definition.required && this.#read(definition) === '',
    );

    for (const definition of missing) {
      this.showError(definition.name, definition.message);
    }

    if (missing.length > 0) {
      this.#block(missing[0].name)?.scrollIntoView({ block: 'nearest' });
      this.#control(missing[0].name)?.focus();
    }

    return missing.length === 0;
  }

  showError(name, message) {
    const block = this.#block(name);

    if (!block) return;

    block.classList.add('has-error');

    const error = document.createElement('p');
    error.className = 'field-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    block.appendChild(error);
  }

  clear() {
    for (const block of this.#root.querySelectorAll('[data-field]')) {
      block.classList.remove('has-error');
      block.querySelector('.field-error')?.remove();
    }
  }

  #block(name) {
    return this.#root.querySelector(`[data-field="${name}"]`);
  }

  #control(name) {
    return this.#block(name)?.querySelector('input, textarea, .dropdown-trigger');
  }

  #read(definition) {
    const block = this.#block(definition.name);

    if (!block) return '';

    if (definition.read) return String(definition.read(block) ?? '').trim();

    const control = block.querySelector('input, textarea');

    return String(control?.value ?? '').trim();
  }
}
