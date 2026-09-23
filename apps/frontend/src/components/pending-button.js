export class PendingButton {
  #element;
  #content = null;
  #current = null;

  constructor(element) {
    this.#element = element;
  }

  get isPending() {
    return this.#current !== null;
  }

  during(operation) {
    if (this.#current) {
      return this.#current;
    }

    this.#lock();
    this.#current = Promise.resolve()
      .then(operation)
      .finally(() => this.#unlock());

    return this.#current;
  }

  #lock() {
    this.#content = this.#element.innerHTML;
    this.#element.disabled = true;
    this.#element.setAttribute('aria-busy', 'true');
    this.#element.innerHTML = '<span class="btn-spinner"></span>';
  }

  #unlock() {
    this.#current = null;
    this.#element.disabled = false;
    this.#element.removeAttribute('aria-busy');
    this.#element.innerHTML = this.#content;
  }
}
