import { ApiError } from './api-error.js';

const VISIBLE_MS = 5000;

export class PageFeedback {
  #element = null;
  #timer = null;

  mount(container) {
    this.#element = document.createElement('p');
    this.#element.className = 'page-feedback';
    this.#element.setAttribute('role', 'alert');
    this.#element.hidden = true;
    container.appendChild(this.#element);
  }

  follow(navigation) {
    navigation.onPlacement(({ mode, dock }) => {
      this.#element.dataset.placement = mode === 'sidebar' ? 'sidebar' : (dock ?? 'free');
    });
  }

  fail(error) {
    this.error(error instanceof ApiError ? error.message : 'Não foi possível concluir.');
  }

  error(message) {
    this.#element.textContent = message;
    this.#element.hidden = false;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.clear(), VISIBLE_MS);
  }

  clear() {
    clearTimeout(this.#timer);
    this.#element.hidden = true;
  }
}

export const pageFeedback = new PageFeedback();
