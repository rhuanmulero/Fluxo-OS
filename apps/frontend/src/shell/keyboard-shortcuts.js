const TYPING_TAGS = ['INPUT', 'TEXTAREA'];

export class KeyboardShortcuts {
  #bindings = new Map();

  register(combo, action) {
    this.#bindings.set(combo, action);
  }

  listen(target = document) {
    target.addEventListener('keydown', (event) => this.#dispatch(event));
  }

  #dispatch(event) {
    if (!event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (this.#isTyping(event.target)) {
      return;
    }

    const action = this.#bindings.get(`Alt+${event.code}`);

    if (!action) {
      return;
    }

    event.preventDefault();
    action();
  }

  #isTyping(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    return (
      element.isContentEditable ||
      TYPING_TAGS.includes(element.tagName) ||
      element.closest('.dropdown') !== null
    );
  }
}
