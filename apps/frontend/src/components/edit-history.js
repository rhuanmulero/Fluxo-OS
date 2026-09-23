export class EditHistory {
  #past = [];
  #future = [];
  #present;

  constructor(initial = '') {
    this.#present = initial;
  }

  reset(snapshot) {
    this.#past = [];
    this.#future = [];
    this.#present = snapshot;
  }

  commit(snapshot) {
    if (snapshot === this.#present) {
      return;
    }

    this.#past.push(this.#present);
    this.#present = snapshot;
    this.#future = [];
  }

  undo(current) {
    this.commit(current);

    if (this.#past.length === 0) {
      return null;
    }

    this.#future.push(this.#present);
    this.#present = this.#past.pop();

    return this.#present;
  }

  redo() {
    if (this.#future.length === 0) {
      return null;
    }

    this.#past.push(this.#present);
    this.#present = this.#future.pop();

    return this.#present;
  }

  canUndo(current) {
    return this.#past.length > 0 || current !== this.#present;
  }

  get canRedo() {
    return this.#future.length > 0;
  }
}
